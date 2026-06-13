import { useEffect, useRef } from 'react';
import bidvibeLogo from '../../assets/bidvibe-logo.svg';
import { getLang } from '../../i18n/translate';

const CTA_U    = 'https://ai-traffic.kr';
const MSG_KO   = '엑셀로 공급사 그만 찾기';
const MSG_EN   = 'Researchers private. Quotes public. Suppliers confidential..';
const CTA_KO   = '지금 등록 →';
const CTA_EN   = 'Sign up now →';
const LABEL_KO = '광고';
const LABEL_EN = 'Ad';

export default function TopAdBanner() {
  const ref = useRef<HTMLAnchorElement>(null);
  const isEn = getLang() === 'en';

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
      {/* 좌측: BidVibe 로고 (메시지 공간 확보 위해 약간 축소) */}
      <img src={bidvibeLogo} alt="BidVibe" className="h-7 sm:h-8 w-auto shrink-0 block" />

      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0 flex-1">
        <span className="text-[10px] font-bold border border-slate-300 text-slate-400 rounded px-1 py-0.5 leading-none shrink-0">
          {isEn ? LABEL_EN : LABEL_KO}
        </span>
        <span className="text-sm sm:text-base font-semibold break-keep" style={{ color: '#132B43' }}>
          {isEn ? MSG_EN : MSG_KO}
        </span>
        <span className="text-sm sm:text-base font-bold whitespace-nowrap shrink-0" style={{ color: '#0E7490' }}>
          {isEn ? CTA_EN : CTA_KO}
        </span>
      </div>
    </a>
  );
}
