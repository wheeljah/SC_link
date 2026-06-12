import { useEffect, useRef } from 'react';

const BG    = '#92400e';
const MSG   = '엑셀로 공급사 그만 찾고, 비드바이브(BidVibe)';
const CTA_T = '지금 등록 →';
const CTA_U = 'https://ai-traffic.kr';
const NAME  = '비드바이브';

export default function TopAdBanner() {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 배너 실제 높이만큼 본문을 밀어 내용이 가려지지 않게 함 (줄바꿈으로 높아져도 대응)
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
      className="fixed top-0 left-0 right-0 z-[9999] flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 px-4 py-2.5 min-h-[60px] text-center"
      style={{ backgroundColor: BG }}
    >
      <span className="text-[10px] font-bold border border-white/40 text-white/60 rounded px-1 py-0.5 leading-none shrink-0">
        광고
      </span>
      <span className="text-white font-extrabold text-base sm:text-lg shrink-0">{NAME}</span>
      <span className="text-white/90 text-sm sm:text-base font-medium break-keep">{MSG}</span>
      <span className="text-amber-300 text-sm sm:text-base font-bold whitespace-nowrap shrink-0">{CTA_T}</span>
    </a>
  );
}
