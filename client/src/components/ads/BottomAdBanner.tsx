import { useEffect } from 'react';
import { useAdBanner } from '../../hooks/useAdBanner';

export default function BottomAdBanner() {
  const { banner, closed, close, handleCtaClick } = useAdBanner('BOTTOM');

  useEffect(() => {
    document.body.style.paddingBottom = (!closed && banner) ? '72px' : '0px';
    return () => { document.body.style.paddingBottom = '0px'; };
  }, [closed, banner]);

  if (closed || !banner) return null;

  return (
    <div
      role="complementary"
      aria-label="Advertisement"
      className="fixed bottom-0 left-0 right-0 z-[9998] h-[72px] bg-white border-t border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] flex items-center px-4 gap-4"
    >
      {/* 광고주 로고/이미지 */}
      {banner.image_url ? (
        <img
          src={banner.image_url}
          alt={banner.advertiser_name || '광고'}
          className="w-12 h-12 rounded-xl object-contain shrink-0 hidden sm:block border border-slate-100 p-1"
        />
      ) : banner.advertiser_name ? (
        <div className="w-12 h-12 rounded-xl bg-slate-900 flex flex-col items-center justify-center shrink-0 leading-none gap-0.5">
          <span className="text-white text-[11px] font-black tracking-tight block text-center">비드</span>
          <span className="text-white text-[11px] font-black tracking-tight block text-center">바이브</span>
        </div>
      ) : null}

      {/* 텍스트 영역 */}
      <div className="flex-1 min-w-0">
        {banner.advertiser_name && (
          <p className="text-xs font-bold text-slate-900">{banner.advertiser_name}</p>
        )}
        <p className="text-xs text-slate-600 leading-snug">{banner.message}</p>
      </div>

      {/* CTA 버튼 */}
      {banner.cta_text && banner.cta_url && (
        <a
          href={banner.cta_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleCtaClick}
          className="shrink-0 bg-slate-900 hover:bg-slate-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          {banner.cta_text}
        </a>
      )}

      {/* 광고 표시 + 닫기 */}
      <div className="shrink-0 flex flex-col items-center gap-1 ml-1">
        <span className="text-[9px] font-bold border border-slate-300 text-slate-400 rounded px-1 leading-tight">
          📢 광고
        </span>
        <button
          onClick={close}
          aria-label="배너 닫기"
          className="text-slate-300 hover:text-slate-600 transition-colors text-base leading-none"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
