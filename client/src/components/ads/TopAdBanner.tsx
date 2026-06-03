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
      className="fixed top-0 left-0 right-0 z-[9999] h-10 flex items-center justify-between px-4 gap-2"
      style={{ backgroundColor: banner.bg_color, color: banner.text_color }}
    >
      {/* 중앙 콘텐츠 */}
      <div className="flex-1 flex items-center justify-center min-w-0 overflow-hidden">
        <p className="text-sm whitespace-nowrap overflow-hidden text-ellipsis text-center">

          {/* 광고 표시 배지 */}
          <span className="inline-block text-[10px] font-bold border border-white/40 text-white/70 rounded px-1 py-0.5 mr-2 leading-none align-middle">
            📢 광고
          </span>

          {/* ① 브랜드명 — 맨 앞, 흰 굵은 폰트 */}
          {banner.advertiser_name && (
            <>
              <span className="text-white font-bold">{banner.advertiser_name}</span>
              <span className="mx-2 text-white/30 hidden sm:inline">|</span>
            </>
          )}

          {hasTwo ? (
            <>
              {/* 모바일: 오른쪽 메시지만 표시 */}
              <span className="sm:hidden text-white/90">{right}</span>

              {/* 데스크톱: 좌 | 우 전체 */}
              <span className="hidden sm:inline">
                <span className="text-white/70">{left}</span>
                <span className="mx-2 text-white/30">|</span>
                <span className="text-white font-medium">{right}</span>
              </span>
            </>
          ) : (
            <span className="text-white/90">
              {banner.icon && <span className="mr-1.5">{banner.icon}</span>}
              {banner.message}
            </span>
          )}

          {/* CTA 링크 */}
          {banner.cta_text && banner.cta_url && (
            <>
              <span className="mx-2 text-white/30 hidden sm:inline">—</span>
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
