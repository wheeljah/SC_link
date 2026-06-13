import { useEffect } from 'react';

const BG    = '#92400e';
const MSG   = '엑셀로 공급사 그만 찾고, 비드바이브(BidVibe)';
const CTA_T = '지금 등록 →';
const CTA_U = 'https://ai-traffic.kr';
const NAME  = '비드바이브';

export default function TopAdBanner() {
  useEffect(() => {
    document.body.style.paddingTop = '48px';
    return () => { document.body.style.paddingTop = '0px'; };
  }, []);

  return (
    <a
      href={CTA_U}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 px-4 min-h-[48px] text-center"
      style={{ backgroundColor: BG }}
    >
      <span className="text-[9px] font-bold border border-white/40 text-white/60 rounded px-1 leading-none shrink-0">
        광고
      </span>
      <span className="text-white font-bold text-sm shrink-0">{NAME}</span>
      <span className="text-white/80 text-sm truncate">{MSG}</span>
      <span className="text-amber-300 text-sm font-semibold whitespace-nowrap shrink-0">{CTA_T}</span>
    </a>
  );
}
