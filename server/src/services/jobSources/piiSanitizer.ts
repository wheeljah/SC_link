// server/src/services/jobSources/piiSanitizer.ts
// PII (개인식별정보) drop 정규식 — PIPA §22·§24 안전선
// 게시판·공고 본문에서 이메일·전화·담당자명 즉시 마스킹
//
// §2.4 쟁점 ②: 교수·연구원은 "공적 존재" 예외가 적용되지만,
// 마케팅·타겟팅 목적 사용 ❌. 우리는 "공고 검색" 목적이므로 PII drop만으로 충분.

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
// 한국 전화 (휴대폰·일반전화·대표번호·팩스), 다양한 구분자
const PHONE_KR_RE = /\b(01[0-9]|02|0[3-9][0-9])[-\s.]?\d{3,4}[-\s.]?\d{4}\b/g;
// 국제 전화 (선택)
const PHONE_INTL_RE = /\+\d{1,3}[\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}\b/g;
// 담당자/연락처 라벨 + 값
const CONTACT_LABEL_RE = /(담당|연락처|문의|책임자|교신저자|corresponding author|contact)[:：]?\s*[^\n\r,;]{0,80}/gi;
// 교수/박사 직함 + 한글 이름 (휴리스틱 — 2~4글자 한글, 직함 직후)
const KOREAN_NAME_RE = /(?:교수|박사|연구원|조교|교수님|박사님|님)(?=\s)([가-힣]{2,4})/g;

const REDACTED = '[redacted]';

/**
 * HTML / plain text 본문에서 PII를 마스킹한다.
 * 원본을 mutate하지 않고 새 문자열 반환.
 */
export function sanitizePII(input: string): string {
  if (!input) return input;
  let out = input;
  out = out.replace(EMAIL_RE, REDACTED);
  out = out.replace(PHONE_INTL_RE, REDACTED);
  out = out.replace(PHONE_KR_RE, REDACTED);
  out = out.replace(CONTACT_LABEL_RE, REDACTED);
  out = out.replace(KOREAN_NAME_RE, '$& ' + REDACTED);
  return out;
}

/**
 * sanitize 결과를 검증 (테스트용) — PII가 남아있는지 빠르게 검사
 */
export function hasPII(input: string): boolean {
  return EMAIL_RE.test(input) || PHONE_KR_RE.test(input) || PHONE_INTL_RE.test(input);
}

// ── 단위 테스트 (직접 실행: `tsx src/services/jobSources/piiSanitizer.ts`) ──
if (require.main === module) {
  const sample = `
2026년 KIST 박사후 연구원 모집
담당: 홍길동 교수 (hong@kist.re.kr, 02-958-6000)
문의: 김영희 박사 (010-1234-5678)
교수 연락처: yhkim@kaist.ac.kr, +82-42-350-2114
  `;
  console.log('원본:\n' + sample);
  const cleaned = sanitizePII(sample);
  console.log('\nPII drop 후:\n' + cleaned);
  console.log('\nPII 잔존?', hasPII(cleaned));
}