import nodemailer from 'nodemailer';
import { Resend } from 'resend';

const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const IS_PROD = process.env.NODE_ENV === 'production';

// Resend (1순위: HTTPS API, SMTP 포트/인증 문제 없음)
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const resendClient = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// Gmail SMTP (2순위 폴백)
// 주의: SMTP_FROM은 반드시 SMTP_USER와 동일한 Gmail 계정이어야 합니다.
// 다른 도메인 FROM -> Gmail이 발송 거부
const isGmailConfigured =
  !!process.env.SMTP_USER &&
  !!process.env.SMTP_PASS &&
  !process.env.SMTP_USER.includes('your_gmail') &&
  !process.env.SMTP_PASS.includes('your_gmail');

const gmailTransporter = isGmailConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    })
  : null;

// Ethereal 테스트 계정 (개발 모드 전용)
let etherealTransporter: nodemailer.Transporter | null = null;

async function getEtherealTransporter(): Promise<nodemailer.Transporter> {
  if (etherealTransporter) return etherealTransporter;
  const account = await nodemailer.createTestAccount();
  etherealTransporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user: account.user, pass: account.pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  console.log('\n[Email] Ethereal test account created');
  console.log('   ID: ' + account.user);
  console.log('   Inbox: https://ethereal.email/messages\n');
  return etherealTransporter;
}

const emailHtml = (title: string, body: string, btnText: string, btnUrl: string) => `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#fff;border-radius:12px;">
  <h2 style="color:#0f172a;margin-bottom:8px;">ScholarLink</h2>
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

function getFromAddress(provider: 'resend' | 'gmail'): string {
  if (provider === 'resend') {
    return process.env.RESEND_FROM || 'ScholarLink <onboarding@resend.dev>';
  }
  // Gmail: FROM must match authenticated account (SMTP_FROM ignored)
  return `"ScholarLink" <${process.env.SMTP_USER || ''}>`;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<string | null> {
  // 1순위: Resend
  if (resendClient) {
    console.log('[Email] Sending via Resend -> ' + opts.to);
    const { error } = await resendClient.emails.send({
      from: getFromAddress('resend'),
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    if (error) throw new Error('Resend error: ' + error.message);
    console.log('[Email] Resend sent OK');
    return null;
  }

  // 2순위: Gmail SMTP
  if (isGmailConfigured && gmailTransporter) {
    console.log('[Email] Sending via Gmail SMTP -> ' + opts.to);
    await gmailTransporter.sendMail({
      from: getFromAddress('gmail'),
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    console.log('[Email] Gmail sent OK');
    return null;
  }

  if (IS_PROD) {
    throw new Error(
      'RESEND_API_KEY 또는 SMTP_USER/SMTP_PASS 환경변수가 설정되지 않았습니다. ' +
      'Render 대시보드 -> Environment에서 설정하세요.'
    );
  }

  // 개발 모드: Ethereal
  const t = await getEtherealTransporter();
  const info = await t.sendMail({
    from: '"ScholarLink" <noreply@scholarlink.dev>',
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
  const previewUrl = nodemailer.getTestMessageUrl(info) as string;
  console.log('[Email] Ethereal preview: ' + previewUrl);
  return previewUrl;
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

export function getEmailProviderStatus(): {
  provider: 'resend' | 'gmail' | 'ethereal' | 'none';
  from: string;
  configured: boolean;
} {
  if (resendClient) {
    return { provider: 'resend', from: getFromAddress('resend'), configured: true };
  }
  if (isGmailConfigured) {
    return { provider: 'gmail', from: getFromAddress('gmail'), configured: true };
  }
  if (!IS_PROD) {
    return { provider: 'ethereal', from: 'noreply@scholarlink.dev', configured: true };
  }
  return { provider: 'none', from: '', configured: false };
}
