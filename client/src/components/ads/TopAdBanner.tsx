import { useEffect, useRef } from 'react';
import bidvibeLogo from '../../assets/bidvibe-logo.svg';
import { getLang } from '../../i18n/translate';

const CTA_U    = 'https://ai-traffic.kr';
const MSG_KO   = '엑셀로 공급사 그만 찾기';
const MSG_EN   = 'Researchers private. Quotes public. Suppliers confidential.';
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
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center gap-2 px-3 sm:px-4 shadow-[0_2px_12px_rgba(19,43,67,0.08)]"
      style={{
        background: 'linear-gradient(180deg, #ffffff 0%, #e6f6fb 100%)',
        borderBottom: '2px solid #1AACDA',
        minHeight: 56,
        paddingTop: 10,
        paddingBottom: 10,
      }}
    >
      {/* 로고 */}
      <img
        src={bidvibeLogo}
        alt="BidVibe"
        className="h-7 sm:h-8 w-auto shrink-0 block"
      />

      {/* 광고 라벨 */}
      <span
        className="text-[10px] font-bold rounded px-1.5 py-0.5 leading-tight shrink-0"
        style={{ border: '1px solid rgba(26,172,218,0.5)', color: '#0E7490' }}
      >
        {isEn ? LABEL_EN : LABEL_KO}
      </span>

      {/* 메시지 — flex-1로 공간 채우되 overflow 시 말줄임 */}
      <span
        className="font-semibold break-keep truncate flex-1 min-w-0"
        style={{ color: '#132B43', fontSize: 'clamp(0.7rem, 2.8vw, 0.9375rem)' }}
      >
        {isEn ? MSG_EN : MSG_KO}
      </span>

      {/* CTA */}
      <span
        className="font-bold whitespace-nowrap shrink-0"
        style={{ color: '#0E7490', fontSize: 'clamp(0.7rem, 2.8vw, 0.9375rem)' }}
      >
        {isEn ? CTA_EN : CTA_KO}
      </span>
    </a>
  );
}
