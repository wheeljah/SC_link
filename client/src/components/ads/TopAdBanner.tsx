import { useEffect } from 'react';
import { useAdBanner } from '../../hooks/useAdBanner';

export default function TopAdBanner() {
  const { banner, closed, close, handleCtaClick } = useAdBanner('TOP');

  useEffect(() => {
    document.body.style.paddingTop = (!closed && banner) ? '40px' : '0px';
    return () => { document.body.style.paddingTop = '0px'; };
  }, [closed, banner]);

  if (closed || !banner) return null;

  const parts = banner.message.split(' | ');
  const left  = parts[0]?.trim() ?? '';
  const right = parts.slice(1).join(' | ').trim();
  const hasTwo = parts.length >= 2 && right;

  return (
    <div
      role="banner"
      aria-label="Advertisement"
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between px-3 gap-2 py-1 min-h-[40px]"
      style={{ backgroundColor: banner.bg_color, color: banner.text_color }}
    >
      {/* 중앙 콘텐츠 */}
      <div className="flex-1 flex items-center justify-center min-w-0">
        {/* 모바일: 브랜드명 + 메시지 두 줄 */}
        <div className="flex flex-col items-center sm:hidden leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold border border-white/40 text-white/70 rounded px-1 leading-none">
              광고
            </span>
            {banner.advertiser_name && (
              <span className="text-white font-bold text-sm">{banner.advertiser_name}</span>
            )}
          </div>
          <span className="text-white/90 text-xs">{hasTwo ? right : banner.message}</span>
        </div>

        {/* 데스크톱: 한 줄 */}
        <p className="hidden sm:block text-sm whitespace-nowrap overflow-hidden text-ellipsis text-center">
          <span className="inline-block text-[10px] font-bold border border-white/40 text-white/70 rounded px-1 py-0.5 mr-2 leading-none align-middle">
            📢 광고
          </span>
          {banner.advertiser_name && (
            <>
              <span className="text-white font-bold">{banner.advertiser_name}</span>
              <span className="mx-2 text-white/30">|</span>
            </>
          )}
          {hasTwo ? (
            <>
              <span className="text-white/70">{left}</span>
              <span className="mx-2 text-white/30">|</span>
              <span className="text-white font-medium">{right}</span>
            </>
          ) : (
            <span className="text-white/90">
              {banner.icon && <span className="mr-1.5">{banner.icon}</span>}
              {banner.message}
            </span>
          )}
          {banner.cta_text && banner.cta_url && (
            <>
              <span className="mx-2 text-white/30">—</span>
              <a
                href={banner.cta_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleCtaClick}
                className="text-amber-300 hover:text-amber-100 font-semibold underline underline-offset-2 transition-colors whitespace-nowrap"
              >
                {banner.cta_text}
              </a>
            </>
          )}
        </p>
      </div>

      {/* 닫기 */}
      <button
        onClick={close}
        aria-label="배너 닫기"
        className="shrink-0 text-white/40 hover:text-white transition-colors text-sm leading-none"
      >
        ✕
      </button>
    </div>
  );
}
