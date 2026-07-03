// server/src/services/visitorStats/geo.ts
// IP / User-Agent → 국가·지역·도시 정보 파싱
// Vercel, Cloudflare, Render 등 모든 호스팅 환경 지원

import crypto from 'crypto';
import type { GeoInfo } from './types';

/** IP 추출 (프록시 헤더 체인 처리) */
export function extractIp(headers: Record<string, string | string[] | undefined>): string {
  // 1) x-forwarded-for (콤마 구분, 첫 번째가 원본)
  const xff = headers['x-forwarded-for'];
  if (xff) {
    const first = Array.isArray(xff) ? xff[0] : xff.split(',')[0];
    return first?.trim() || 'unknown';
  }
  // 2) x-real-ip / cf-connecting-ip
  const xri = headers['x-real-ip'];
  if (xri) return Array.isArray(xri) ? xri[0] : xri;
  const cfci = headers['cf-connecting-ip'];
  if (cfci) return Array.isArray(cfci) ? cfci[0] : cfci;
  return 'unknown';
}

function header(headers: Record<string, string | string[] | undefined>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = headers[k.toLowerCase()];
    if (v) {
      const s = Array.isArray(v) ? v[0] : v;
      if (s && typeof s === 'string' && s.length > 0) return s;
    }
  }
  return null;
}

/** 플랫폼별 지리 정보 헤더 통합 추출 */
export function extractGeo(headers: Record<string, string | string[] | undefined>): GeoInfo {
  const ip = extractIp(headers);
  const userAgent = header(headers, 'user-agent') || 'unknown';

  const country = header(headers, 'x-vercel-ip-country', 'cf-ipcountry', 'x-country-code')?.toUpperCase() || null;
  const countryName = header(headers, 'x-vercel-ip-country-name', 'cf-ipcountry-name');
  const region = header(headers, 'x-vercel-ip-country-region', 'cf-region-code', 'x-region-code');
  const city = header(headers, 'x-vercel-ip-city', 'cf-ipcity');

  return { country, country_name: countryName, region, city, ip, user_agent: userAgent };
}

/** SHA-256 IP 해시 (16자리 — GDPR 친화) */
export function hashIp(ip: string): string {
  if (!ip || ip === 'unknown') return 'ip_unknown';
  const h = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
  return `ip_${h}`;
}