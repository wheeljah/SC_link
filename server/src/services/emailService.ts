import nodemailer from 'nodemailer';

const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const IS_PROD = process.env.NODE_ENV === 'production';

// Gmail SMTP 설정 여부
const isGmailConfigured =
  !!process.env.SMTP_USER &&
  !!process.env.SMTP_PASS &&
  !process.env.SMTP_USER.includes('your_gmail') &&
  !process.env.SMTP_PASS.includes('your_gmail');

// 실제 Gmail transporter
const gmailTransporter = isGmailConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 10000,   // 10s: TCP 연결
      greetingTimeout:  10000,    // 10s: SMTP 핸드셰이크
      socketTimeout:    15000,    // 15s: 데이터 전송
    })
  : null;

// Ethereal 테스트 계정 캐시 (프로세스 재시작마다 1회 생성)
let etherealTransporter: nodemailer.Transporter | null = null;
let etherealUser = '';

async function getEtherealTransporter(): Promise<nodemailer.Transporter> {
  if (etherealTransporter) return etherealTransporter;
  const account = await nodemailer.createTestAccount();
  etherealUser = account.user;
  etherealTransporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user: account.user, pass: account.pass },
    connectionTimeout: 10000,
    greetingTimeout:  10000,
    socketTimeout:    15000,
  });
  console.log('\n📮 Ethereal 테스트 메일 계정 생성됨');
  console.log(`   ID: ${account.user}`);
  console.log(`   PW: ${account.pass}`);
  console.log(`   받은편지함: https://ethereal.email/messages\n`);
  return etherealTransporter;
}

const emailHtml = (title: string, body: string, btnText: string, btnUrl: string) => `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#fff;border-radius:12px;">
  <h2 style="color:#0f172a;margin-bottom:8px;">🔬 ScholarLink</h2>
  <h3 style="color:#1e40af;margin-top:0;">${title}</h3>
  <p style="color:#475569;">${body}</p>
  <a href="${btnUrl}"
     style="display:inline-block;background:#2563eb;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin:16px 0;">
    ${btnText}
  </a>
  <p style="margin-top:24px;color:#94a3b8;font-size:12px;">
    버튼이 작동하지 않으면 아래 URL을 복사해 브라우저에 붙여넣으세요:<br/>
    <a href="${btnUrl}" style="color:#94a3b8;">${btnUrl}</a>
  </p>
</div>`;

// 발신자 주소: SMTP_FROM 설정 시 해당 주소 사용, 없으면 SMTP_USER
const FROM_ADDRESS = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@scholarlink.dev';
const FROM_DISPLAY = `"ScholarLink" <${FROM_ADDRESS}>`;

/** 메일 발송 공통 함수 — Gmail 우선, 없으면 Ethereal 자동 사용 */
async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<string | null> {
  if (isGmailConfigured && gmailTransporter) {
    console.log(`\n📤 Gmail 발송 시작`);
    console.log(`   FROM : ${FROM_DISPLAY}`);
    console.log(`   TO   : ${opts.to}`);
    console.log(`   SUBJ : ${opts.subject}`);
    await gmailTransporter.sendMail({
      from: FROM_DISPLAY,
      ...opts,
    });
    console.log(`   ✅ 발송 완료 → ${opts.to}\n`);
    return null; // 실제 발송 — 미리보기 URL 없음
  }

  if (IS_PROD) throw new Error('SMTP 설정이 필요합니다. server/.env에 SMTP_USER, SMTP_PASS를 입력하세요.');

  // 개발 모드: Ethereal로 자동 발송
  const t = await getEtherealTransporter();
  const info = await t.sendMail({
    from: FROM_DISPLAY,
    ...opts,
  });
  const previewUrl = nodemailer.getTestMessageUrl(info) as string;
  console.log(`\n📧 Ethereal 메일 발송됨 → ${previewUrl}\n`);
  return previewUrl; // 미리보기 URL 반환
}

export async function sendVerificationEmail(email: string, token: string): Promise<string | null> {
  const link = `${APP_URL}/verify-email?token=${token}`;
  return sendMail({
    to: email,
    subject: '[ScholarLink] 이메일 인증을 완료해주세요',
    html: emailHtml(
      '이메일 인증',
      '아래 버튼을 클릭하여 인증을 완료하세요. 링크는 24시간 후 만료됩니다.',
      '이메일 인증하기',
      link,
    ),
  });
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<string | null> {
  const link = `${APP_URL}/reset-password?token=${token}`;
  return sendMail({
    to: email,
    subject: '[ScholarLink] 비밀번호 재설정 링크',
    html: emailHtml(
      '비밀번호 재설정',
      '아래 버튼을 클릭하여 새 비밀번호를 설정하세요. 링크는 1시간 후 만료됩니다.<br/>요청하지 않으셨다면 이 메일을 무시하세요.',
      '비밀번호 재설정하기',
      link,
    ),
  });
}
