// lib/visitor-stats/server/geo.ts
// IP / User-Agent → 국가·지역·도시 정보 파싱
// Vercel, Cloudflare, 일반 호스팅 환경 모두 지원

import type { GeoInfo } from './types'

/** IP 추출 (프록시 헤더 체인 처리) */
export function extractIp(headers: Headers): string {
  // Vercel: x-forwarded-for 또는 x-real-ip
  const xff = headers.get('x-forwarded-for') || headers.get('X-Forwarded-For')
  if (xff) {
    return xff.split(',')[0]?.trim() || 'unknown'
  }
  return (
    headers.get('x-real-ip') ||
    headers.get('X-Real-IP') ||
    headers.get('cf-connecting-ip') ||
    headers.get('CF-Connecting-IP') ||
    'unknown'
  )
}

/** 플랫폼별 지리 정보 헤더 통합 추출 */
export function extractGeo(headers: Headers): GeoInfo {
  const ip = extractIp(headers)
  const userAgent = headers.get('user-agent') || headers.get('User-Agent') || 'unknown'

  // Vercel/Cloudflare 표준 헤더들 (둘 다 지원)
  const country = (
    headers.get('x-vercel-ip-country') ||
    headers.get('cf-ipcountry') ||
    headers.get('X-Country-Code') ||
    null
  )?.toUpperCase() || null

  const countryName = (
    headers.get('x-vercel-ip-country-name') ||
    headers.get('cf-ipcountry-name') ||
    null
  )

  const region = (
    headers.get('x-vercel-ip-country-region') ||
    headers.get('cf-region-code') ||
    headers.get('X-Region-Code') ||
    null
  )

  const city = (
    headers.get('x-vercel-ip-city') ||
    headers.get('cf-ipcity') ||
    null
  )

  return { country, country_name: countryName, region, city, ip, user_agent: userAgent }
}

/** IP를 32-bit hash로 변환 (원본 저장 안 함, GDPR 친화) */
export function hashIp(ip: string): string {
  let h = 0
  for (let i = 0; i < ip.length; i++) {
    h = ((h << 5) - h) + ip.charCodeAt(i)
    h |= 0
  }
  return `ip_${(h >>> 0).toString(16)}`
}

/** SHA-256 사용 가능한 경우 (Node.js crypto / Web Crypto) — 더 안전한 해시 */
export async function hashIpSecure(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip)

  // Node.js 환경
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof (globalThis as any).process !== 'undefined' && (globalThis as any).process?.versions?.node) {
    const nodeCrypto = await import('crypto')
    const hash = nodeCrypto.createHash('sha256')
    hash.update(data)
    return `ip_${hash.digest('hex').slice(0, 16)}`
  }

  // 브라우저 환경 (Web Crypto)
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', data)
    const arr = Array.from(new Uint8Array(buf))
    return `ip_${arr.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)}`
  }

  // 폴백
  return hashIp(ip)
}