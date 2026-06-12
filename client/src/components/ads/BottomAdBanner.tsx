import { useEffect, useRef } from 'react';

const CTA_U = 'https://ai-traffic.kr';
const MSG1  = '시약/장비 일단 띡! 견적요청만 올리면 됨';
const MSG2  = '비드바이브(BidVibe)';

export default function BottomAdBanner() {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 배너 실제 높이(안전영역 패딩 포함)만큼 본문 하단을 띄움
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
      className="fixed bottom-0 left-0 right-0 z-[9998] flex flex-col items-center justify-center px-4 shadow-[0_-4px_16px_rgba(0,0,0,0.24)]"
      style={{
        backgroundColor: '#1e1b4b',
        borderTop: '1px solid rgba(99,102,241,0.25)',
        minHeight: 104,
        paddingTop: 14,
        paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
        gap: 6,
      }}
    >
      <span className="text-[10px] font-bold rounded px-1.5 py-0.5 leading-tight self-center"
        style={{ border: '1px solid rgba(165,180,252,0.4)', color: 'rgba(165,180,252,0.7)' }}>
        광고
      </span>
      <p className="text-base sm:text-lg font-bold text-white text-center leading-snug break-keep">
        {MSG1}
      </p>
      <p className="text-sm sm:text-base font-semibold text-indigo-300 text-center leading-snug break-keep">
        {MSG2}
      </p>
    </a>
  );
}
