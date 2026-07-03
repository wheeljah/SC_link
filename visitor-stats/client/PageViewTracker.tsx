// lib/visitor-stats/client/PageViewTracker.tsx
// 클라이언트 페이지 추적 컴포넌트 — 레이아웃에 한 번만 마운트
// pathname 변경 시 자동으로 /api/visitor-stats/track 호출
'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

export interface PageViewTrackerProps {
  /** API endpoint (기본 '/api/visitor-stats/track') */
  endpoint?: string
  /** 추적 제외할 pathname prefix 배열 (예: ['/admin', '/api/']) */
  excludePrefixes?: string[]
  /** 디버그 로그 출력 */
  debug?: boolean
}

const SESSION_KEY = 'visitor_stats_sid'

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return ''
  const storage = window.sessionStorage
  let sid = storage.getItem(SESSION_KEY)
  if (!sid) {
    sid = generateId()
    storage.setItem(SESSION_KEY, sid)
  }
  return sid
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'sid_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

export function PageViewTracker({
  endpoint = '/api/visitor-stats/track',
  excludePrefixes = ['/admin', '/api/'],
  debug = false,
}: PageViewTrackerProps) {
  const pathname = usePathname()
  const lastPathRef = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname) return
    if (lastPathRef.current === pathname) return
    lastPathRef.current = pathname

    if (excludePrefixes.some(p => pathname.startsWith(p))) {
      if (debug) console.log('[visitor-stats] skip:', pathname)
      return
    }

    const sid = getOrCreateSessionId()
    if (!sid) return

    if (debug) console.log('[visitor-stats] track:', pathname)

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathname, sessionId: sid }),
      keepalive: true,
    }).catch((err) => {
      if (debug) console.warn('[visitor-stats] track failed:', err)
    })
  }, [pathname, endpoint, excludePrefixes, debug])

  return null
}