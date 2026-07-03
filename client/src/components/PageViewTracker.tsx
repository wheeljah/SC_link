// client/src/components/PageViewTracker.tsx
// 클라이언트 페이지 추적 컴포넌트 — Layout에 한 번만 마운트
// pathname 변경 시 자동으로 POST /api/v1/track-view 호출
// 봇 / admin / api 경로 자동 제외

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { getApiBaseURL } from '../services/api';

export interface PageViewTrackerProps {
  /** API endpoint (기본 '/track-view') */
  endpoint?: string;
  /** 추적 제외할 pathname prefix 배열 */
  excludePrefixes?: string[];
  /** 디버그 로그 출력 */
  debug?: boolean;
}

const SESSION_KEY = 'visitor_stats_sid';

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  let sid: string | null = null;
  try { sid = window.sessionStorage.getItem(SESSION_KEY); } catch { /* ignore */ }
  if (!sid) {
    sid = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'sid_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    try { window.sessionStorage.setItem(SESSION_KEY, sid); } catch { /* ignore */ }
  }
  return sid;
}

export function PageViewTracker({
  endpoint = '/track-view',
  excludePrefixes = ['/admin', '/jobs', '/community', '/history', '/profile', '/network'],
  debug = false,
}: PageViewTrackerProps) {
  const location = useLocation();
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    const pathname = location.pathname;
    if (!pathname) return;
    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;

    if (excludePrefixes.some(p => pathname.startsWith(p))) {
      if (debug) console.log('[visitor-stats] skip:', pathname);
      return;
    }

    const sid = getOrCreateSessionId();
    if (!sid) return;

    const api = getApiBaseURL();
    if (debug) console.log('[visitor-stats] track:', pathname);

    fetch(`${api}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathname, sessionId: sid }),
      keepalive: true,
    }).catch((err) => {
      if (debug) console.warn('[visitor-stats] track failed:', err);
    });
  }, [location.pathname, endpoint, excludePrefixes, debug]);

  return null;
}