import { useState, useEffect, useRef } from 'react';
import { AdBanner } from '../types';
import api, { initPromise } from '../services/api';

const TOP_CLOSED_KEY    = 'topBannerClosedAt';
const BOTTOM_CLOSED_KEY = 'bottomBannerClosedAt';
const TOP_TTL_MS    = 7  * 24 * 60 * 60 * 1000; // 7일
const BOTTOM_TTL_MS = 1  * 24 * 60 * 60 * 1000; // 1일

function isClosed(key: string, ttl: number): boolean {
  const val = localStorage.getItem(key);
  if (!val) return false;
  return Date.now() - parseInt(val, 10) < ttl;
}

export function useAdBanner(position: 'TOP' | 'BOTTOM') {
  const [banner, setBanner] = useState<AdBanner | null>(null);
  const [closed, setClosed] = useState(false);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const key = position === 'TOP' ? TOP_CLOSED_KEY : BOTTOM_CLOSED_KEY;
    const ttl = position === 'TOP' ? TOP_TTL_MS    : BOTTOM_TTL_MS;

    if (isClosed(key, ttl)) { setClosed(true); return; }

    let cancelled = false;

    async function fetchBanner(attempt = 0) {
      if (cancelled) return;
      try {
        await initPromise;
        const res = await api.get(`/ads/banners?position=${position}`);
        if (!cancelled && res.data.data) {
          setBanner(res.data.data);
          api.post(`/ads/banners/${res.data.data.id}/impression`).catch(() => {});
        }
      } catch {
        // Render 슬립 중일 수 있음 — 최대 2회 재시도 (10s, 30s 후)
        if (!cancelled && attempt < 2) {
          const delay = attempt === 0 ? 10_000 : 30_000;
          retryRef.current = setTimeout(() => fetchBanner(attempt + 1), delay);
        }
      }
    }

    fetchBanner();
    return () => {
      cancelled = true;
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [position]);

  const close = () => {
    setClosed(true);
    const key = position === 'TOP' ? TOP_CLOSED_KEY : BOTTOM_CLOSED_KEY;
    localStorage.setItem(key, String(Date.now()));
  };

  const handleCtaClick = () => {
    if (banner) api.post(`/ads/banners/${banner.id}/click`).catch(() => {});
  };

  return { banner, closed, close, handleCtaClick };
}
