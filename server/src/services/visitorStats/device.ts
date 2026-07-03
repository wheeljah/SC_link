// server/src/services/visitorStats/device.ts
// User-Agent 기반 디바이스/봇 분류 — 외부 라이브러리 없이 가벼운 regex 사용

import type { DeviceType } from './types';

const BOT_PATTERNS = [
  /bot/i, /crawl/i, /spider/i, /slurp/i, /yandex/i, /baiduspider/i,
  /bingpreview/i, /facebookexternalhit/i, /twitterbot/i, /linkedinbot/i,
  /discordbot/i, /telegrambot/i, /whatsapp/i, /googlebot/i, /applebot/i,
  /semrush/i, /ahrefs/i, /mj12bot/i, /dotbot/i, /petalbot/i, /naverbot/i,
  /kakao/i, /headlesschrome/i, /phantomjs/i, /wget/i, /curl/i, /python-requests/i,
  /preview/i, /monitor/i, /scanner/i, /archiver/i, /mediapartners/i,
];

/** UA에서 디바이스 타입 분류 */
export function detectDevice(userAgent: string): DeviceType {
  if (!userAgent || userAgent === 'unknown') return 'unknown';

  // 봇 감지 (가장 먼저)
  if (BOT_PATTERNS.some(re => re.test(userAgent))) {
    return 'bot';
  }

  // 태블릿
  if (/tablet|ipad|playbook|silk|kindle/i.test(userAgent)) return 'tablet';

  // 모바일
  if (/mobile|iphone|ipod|android.*mobile|blackberry|opera mini|opera mobi|webos|windows phone/i.test(userAgent)) {
    return 'mobile';
  }

  // 데스크탑 (기본)
  return 'desktop';
}

/** 브라우저 이름 (간단 추출) */
export function detectBrowser(userAgent: string): string {
  if (/edg\//i.test(userAgent)) return 'Edge';
  if (/opr\/|opera/i.test(userAgent)) return 'Opera';
  if (/chrome/i.test(userAgent) && !/chromium/i.test(userAgent)) return 'Chrome';
  if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) return 'Safari';
  if (/firefox/i.test(userAgent)) return 'Firefox';
  if (/msie|trident/i.test(userAgent)) return 'IE';
  return 'Unknown';
}

/** OS 이름 */
export function detectOS(userAgent: string): string {
  if (/windows nt 10/i.test(userAgent)) return 'Windows 10/11';
  if (/windows nt 6\.3/i.test(userAgent)) return 'Windows 8.1';
  if (/windows nt 6\.2/i.test(userAgent)) return 'Windows 8';
  if (/windows nt 6\.1/i.test(userAgent)) return 'Windows 7';
  if (/windows/i.test(userAgent)) return 'Windows';
  if (/mac os x|macintosh/i.test(userAgent)) return 'macOS';
  if (/iphone os|ipad os/i.test(userAgent)) return 'iOS';
  if (/android/i.test(userAgent)) return 'Android';
  if (/linux/i.test(userAgent)) return 'Linux';
  if (/cros/i.test(userAgent)) return 'ChromeOS';
  return 'Unknown';
}