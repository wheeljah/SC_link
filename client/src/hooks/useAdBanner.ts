import { useState, useEffect, useRef } from 'react';
import { AdBanner } from '../types';
import api, { initPromise } from '../services/api';

const TOP_CLOSED_KEY    = 'topBannerClosedAt';
const BOTTOM_CLOSED_KEY = 'bottomBannerClosedAt';
const TOP_TTL_MS    = 7  * 24 * 60 * 60 * 1000; // 7일
const BOTTOM_TTL_MS = 1  * 24 * 60 * 60 * 1000; // 1일

// API 응답 전(Render 슬립 등) 표시할 fallback 배너 — 서버 데이터로 교체됨
const FALLBACK_BANNERS: Record<'TOP' | 'BOTTOM', AdBanner> = {
  TOP: {
    id: 0, position: 'TOP', type: 'TEXT', icon: null,
    message: '엑셀로 공급사 그만 찾고, 비드바이브(BidVibe)',
    cta_text: '지금 등록 →', cta_url: 'https://ai-traffic.kr',
    image_url: null, advertiser_name: '비드바이브(BidVibe)',
    bg_color: '#0f172a', text_color: '#ffffff',
  },
  BOTTOM: {
    id: 0, position: 'BOTTOM', type: 'IMAGE_TEXT', icon: null,
    message: '엑셀로 공급사 그만 찾고, 비드바이브(BidVibe)',
    cta_text: '무료로 시작하기', cta_url: 'https://ai-traffic.kr',
    image_url: null, advertiser_name: 'BidVibe',
    bg_color: '#ffffff', text_color: '#0f172a',
  },
};

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

    // fallback 즉시 표시 (API 응답 전에도 배너 보임)
    setBanner(FALLBACK_BANNERS[position]);

    let cancelled = false;

    async function fetchBanner(attempt = 0) {
      if (cancelled) return;
      try {
        await initPromise;
        const res = await api.get(`/ads/banners?position=${position}`);
        if (!cancelled && res.data.data) {
          setBanner(res.data.data);
          // fallback(id=0)은 impression 전송 스킵
          if (res.data.data.id > 0) {
            api.post(`/ads/banners/${res.data.data.id}/impression`).catch(() => {});
          }
        }
      } catch {
        // Render 슬립 중 — 최대 4회 재시도 (10s, 20s, 30s, 60s)
        const delays = [10_000, 20_000, 30_000, 60_000];
        if (!cancelled && attempt < delays.length) {
          retryRef.current = setTimeout(() => fetchBanner(attempt + 1), delays[attempt]);
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
