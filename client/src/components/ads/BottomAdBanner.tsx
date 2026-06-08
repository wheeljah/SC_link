import { useEffect } from 'react';
import { useAdBanner } from '../../hooks/useAdBanner';

export default function BottomAdBanner() {
  const { banner, handleCtaClick } = useAdBanner('BOTTOM');

  useEffect(() => {
    if (banner) {
      // iOS safe-area-inset-bottom 보상 (홈 인디케이터 아래까지 확보)
      const safeBottom = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--sab') || '0',
        10
      ) || 0;
      document.body.style.paddingBottom = `${64 + safeBottom}px`;
    } else {
      document.body.style.paddingBottom = '0px';
    }
    return () => { document.body.style.paddingBottom = '0px'; };
  }, [banner]);

  if (!banner) return null;

  return (
    <div
      role="complementary"
      aria-label="Advertisement"
      className="fixed bottom-0 left-0 right-0 z-[9998] bg-white border-t border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] flex items-center px-3 gap-2"
      style={{ minHeight: 64, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* 광고주 로고 — 데스크탑만 */}
      {banner.advertiser_name && (
        <div className="hidden sm:flex w-10 h-10 rounded-xl bg-slate-900 flex-col items-center justify-center shrink-0 leading-none gap-0.5">
          <span className="text-white text-[10px] font-black tracking-tight">비드</span>
          <span className="text-white text-[10px] font-black tracking-tight">바이브</span>
        </div>
      )}

      {/* 광고 태그 */}
      <span className="shrink-0 text-[9px] font-bold border border-slate-300 text-slate-400 rounded px-1 leading-tight">
        광고
      </span>

      {/* 메시지 */}
      <p className="flex-1 min-w-0 text-sm font-bold text-slate-800 break-keep leading-snug">
        {banner.message}
      </p>

      {/* CTA 버튼 */}
      {banner.cta_text && banner.cta_url && (
        <a
          href={banner.cta_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleCtaClick}
          className="shrink-0 bg-slate-900 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          {banner.cta_text}
        </a>
      )}
    </div>
  );
}
