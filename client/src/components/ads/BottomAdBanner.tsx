import { useEffect, useRef } from 'react';
import bidvibeLogo from '../../assets/bidvibe-logo.svg';

const CTA_U = 'https://ai-traffic.kr';
const MSG1  = '시약/장비 일단 띡! 견적요청만 올리면 됨';

export default function BottomAdBanner() {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => { document.body.style.paddingBottom = `${el.offsetHeight}px`; };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    window.addEventListener('resize', apply);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', apply);
      document.body.style.paddingBottom = '0px';
    };
  }, []);

  return (
    <a
      ref={ref}
      href={CTA_U}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-0 left-0 right-0 z-[9998] flex items-center justify-between gap-3 px-4 shadow-[0_-4px_16px_rgba(19,43,67,0.12)]"
      style={{
        background: 'linear-gradient(180deg, #ffffff 0%, #e6f6fb 100%)',
        borderTop: '2px solid #1AACDA',
        minHeight: 104,
        paddingTop: 14,
        paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="flex flex-col items-start gap-1 min-w-0 flex-1">
        <span className="text-[10px] font-bold rounded px-1.5 py-0.5 leading-tight"
          style={{ border: '1px solid rgba(26,172,218,0.5)', color: '#0E7490' }}>
          광고
        </span>
        <p className="text-base sm:text-lg font-bold leading-snug break-keep" style={{ color: '#132B43' }}>
          {MSG1}
        </p>
      </div>

      {/* 우측: BidVibe 로고 (원본 그대로, 투명 배경) */}
      <img src={bidvibeLogo} alt="BidVibe" className="h-9 sm:h-11 w-auto shrink-0 block" />
    </a>
  );
}
