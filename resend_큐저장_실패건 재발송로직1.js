resend 쪽에서 큐가 쌓이지 않아서 403에러 보고 재발송하고 싶은데, 재발송 스크립트 와 에러 핸들링 코드를 어떻게 적용하나

Resend에서 403 에러가 발생했다는 것은 인증 실패(잘못된 API Key) 또는 도메인 검증 미완료(위에서 설정한 DNS 미반영 등) 상태를 의미합니다. 이 상태에서는 Resend 내부 큐에 요청이 쌓이지 않고 즉시 거절됩니다.

이 문제를 해결하려면 1) 에러가 발생했을 때 로컬(또는 본인 서버)의 큐에 실패한 메일을 저장하고, 2) DNS 수정 등이 완료된 후 403 원인이 해결되면 다시 큐를 읽어 재발송(Retry)하는 스크립트가 필요합니다.

Node.js (JavaScript) 기준으로 안정적인 에러 핸들링과 재발송 큐 코드를 구현하는 방법을 정리해 드립니다.

1. 에러 핸들링 및 로컬 큐 저장 코드 (발송 로직)
메일을 보낼 때 403 에러가 나면, 버려지지 않도록 failed_queue.json이라는 로컬 파일(큐 역할을 할 파일)에 메일 본문과 에러 사유를 저장하는 코드입니다.

JavaScript
import { Resend } from 'resend';
import fs from 'fs/promises';

const resend = new Resend('re_YourApiKeyHere'); // 발송 전 API Key와 DNS 상태 꼭 확인!
const QUEUE_FILE = './failed_queue.json';

// 실패한 메일을 로컬 큐(파일)에 저장하는 함수
async function saveToQueue(mailData, errorMessage) {
  let queue = [];
  try {
    const data = await fs.readFile(QUEUE_FILE, 'utf-8');
    queue = JSON.parse(data);
  } catch (error) {
    // 파일이 없으면 새로 생성
    queue = [];
  }

  queue.push({
    ...mailData,
    failedAt: new Date().toISOString(),
    reason: errorMessage
  });

  await fs.writeFile(QUEUE_FILE, JSON.stringify(queue, null, 2));
  console.log(`⚠️ 발송 실패 메일이 큐에 저장되었습니다. 사유: ${errorMessage}`);
}

// 메일 발송 함수 (에러 핸들링 포함)
async function sendEmail(mailData) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev', // 도메인 인증 후에는 본인 도메인 주소로 변경
      to: mailData.to,
      subject: mailData.subject,
      html: mailData.html,
    });

    if (error) {
      // Resend API가 에러를 반환한 경우 (403 포함)
      console.error(`Resend API Error (${error.name}): ${error.message}`);
      await saveToQueue(mailData, `${error.name}: ${error.message}`);
      return;
    }

    console.log(`✅ 메일 발송 성공: ${data.id}`);
  } catch (unknownError) {
    // 네트워크 단절 등 예상치 못한 시스템 에러
    console.error('네트워크 또는 시스템 에러:', unknownError.message);
    await saveToQueue(mailData, unknownError.message);
  }
}

// 실행 예시
const testMail = { to: 'user@example.com', subject: '테스트 메일', html: '<p>안녕하세요</p>' };
sendEmail(testMail);
2. 큐에 쌓인 메일 재발송 스크립트 (Retry Script)
DNS 설정이 정상화되고 403 에러 원인이 해결되었다면, 아래 스크립트를 독립적으로 실행하여 큐(failed_queue.json)에 있는 메일들을 꺼내어 재발송합니다. 성공한 메일은 큐에서 제거됩니다.

JavaScript
import { Resend } from 'resend';
import fs from 'fs/promises';

const resend = new Resend('re_YourApiKeyHere');
const QUEUE_FILE = './failed_queue.json';

async function processRetryQueue() {
  let queue = [];
  try {
    const data = await fs.readFile(QUEUE_FILE, 'utf-8');
    queue = JSON.parse(data);
  } catch (error) {
    console.log('📂 재발송할 큐 파일이 없거나 비어 있습니다.');
    return;
  }

  if (queue.length === 0) {
    console.log('✅ 재발송할 메일이 없습니다.');
    return;
  }

  console.log(`🔄 총 ${queue.length}개의 메일 재발송을 시작합니다...`);
  const stillFailed = [];

  for (const mail of queue) {
    try {
      // 큐에 저장할 때 넣었던 메타데이터(failedAt, reason) 제외하고 발송 데이터만 추출
      const { to, subject, html } = mail;

      const { data, error } = await resend.emails.send({
        from: 'onboarding@resend.dev',
        to,
        subject,
        html,
      });

      if (error) {
        console.error(`❌ 재발송 실패 (이메일: ${to}): ${error.message}`);
        stillFailed.push(mail); // 실패하면 다시 유지
      } else {
        console.log(`✨ 재발송 성공 (이메일: ${to}) - ID: ${data.id}`);
      }
    } catch (err) {
      console.error(`❌ 시스템 에러로 인한 재발송 실패 (이메일: ${mail.to})`);
      stillFailed.push(mail);
    }
    
    // API Rate Limit(초당 발송 제한)을 방지하기 위해 0.2초 정도 간격을 둡니다.
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // 남은 실패 메일이 있다면 파일 갱신, 다 성공했다면 파일 삭제 또는 비우기
  if (stillFailed.length > 0) {
    await fs.writeFile(QUEUE_FILE, JSON.stringify(stillFailed, null, 2));
    console.log(`⚠️ ${stillFailed.length}개의 메일이 여전히 실패하여 큐에 남았습니다.`);
  } else {
    await fs.unlink(QUEUE_FILE); // 파일 삭제
    console.log('🎉 모든 메일이 성공적으로 재발송되어 큐가 비워졌습니다.');
  }
}

// 재발송 스크립트 실행
processRetryQueue();