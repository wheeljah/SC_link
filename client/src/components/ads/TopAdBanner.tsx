import { useEffect, useRef } from 'react';
import bidvibeLogo from '../../assets/bidvibe-logo.svg';

const MSG   = '엑셀로 공급사 그만 찾기';
const CTA_T = '지금 등록 →';
const CTA_U = 'https://ai-traffic.kr';

export default function TopAdBanner() {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => { document.body.style.paddingTop = `${el.offsetHeight}px`; };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    window.addEventListener('resize', apply);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', apply);
      document.body.style.paddingTop = '0px';
    };
  }, []);

  return (
    <a
      ref={ref}
      href={CTA_U}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center gap-3 px-3 py-2 min-h-[60px]"
      style={{ backgroundColor: '#ffffff', borderBottom: '2px solid #1AACDA' }}
    >
      {/* 좌측: BidVibe 로고 (원본 그대로, 투명 배경) */}
      <img src={bidvibeLogo} alt="BidVibe" className="h-8 sm:h-9 w-auto shrink-0 block" />

      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0 flex-1">
        <span className="text-[10px] font-bold border border-slate-300 text-slate-400 rounded px-1 py-0.5 leading-none shrink-0">
          광고
        </span>
        <span className="text-sm sm:text-base font-semibold break-keep" style={{ color: '#132B43' }}>
          {MSG}
        </span>
        <span className="text-sm sm:text-base font-bold whitespace-nowrap shrink-0" style={{ color: '#0E7490' }}>
          {CTA_T}
        </span>
      </div>
    </a>
  );
}
