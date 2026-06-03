import { useState, useEffect } from 'react';
import { AdBanner } from '../types';
import api from '../services/api';

export function useAdBanner(position: 'TOP' | 'BOTTOM') {
  const [banner, setBanner] = useState<AdBanner | null>(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const storageKey = position === 'TOP' ? 'topBannerClosed' : null;
    const cookieKey = position === 'BOTTOM' ? 'bottomBannerClosed' : null;

    if (storageKey && localStorage.getItem(storageKey)) { setClosed(true); return; }
    if (cookieKey && document.cookie.includes(cookieKey)) { setClosed(true); return; }

    api.get(`/ads/banners?position=${position}`)
      .then(res => {
        if (res.data.data) {
          setBanner(res.data.data);
          api.post(`/ads/banners/${res.data.data.id}/impression`).catch(() => {});
        }
      })
      .catch(() => {});
  }, [position]);

  const close = () => {
    setClosed(true);
    if (banner) {
      if (position === 'TOP') localStorage.setItem('topBannerClosed', 'true');
      if (position === 'BOTTOM') {
        document.cookie = `bottomBannerClosed=1; max-age=86400; path=/`;
      }
    }
  };

  const handleCtaClick = () => {
    if (banner) api.post(`/ads/banners/${banner.id}/click`).catch(() => {});
  };

  return { banner, closed, close, handleCtaClick };
}
