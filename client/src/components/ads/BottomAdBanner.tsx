import { useEffect } from 'react';

const CTA_T = '무료로 시작하기';
const CTA_U = 'https://ai-traffic.kr';
const MSG   = '요청하면 견적이 다~ 온다 — 수수료 없는 연구자-공급사 매칭';

export default function BottomAdBanner() {
  useEffect(() => {
    document.body.style.paddingBottom = 'calc(64px + env(safe-area-inset-bottom, 0px))';
    return () => { document.body.style.paddingBottom = '0px'; };
  }, []);

  return (
    <a
      href={CTA_U}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-0 left-0 right-0 z-[9998] flex items-center gap-3 px-4 bg-white border-t border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
      style={{ minHeight: 64, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <span className="shrink-0 text-[9px] font-bold border border-slate-300 text-slate-400 rounded px-1 leading-tight">
        광고
      </span>
      <p className="flex-1 min-w-0 text-sm font-bold text-slate-800 truncate">{MSG}</p>
      <span className="shrink-0 bg-slate-900 text-white text-xs font-semibold px-3 py-2 rounded-lg whitespace-nowrap">
        {CTA_T}
      </span>
    </a>
  );
}
