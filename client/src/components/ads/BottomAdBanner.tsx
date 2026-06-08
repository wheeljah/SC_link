import { useEffect } from 'react';

const CTA_T = '무료로 시작하기';
const CTA_U = 'https://ai-traffic.kr';
const MSG   = '엑셀로 공급사 그만 찾고, 비드바이브(BidVibe)';

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
      className="fixed bottom-0 left-0 right-0 z-[9998] flex items-center gap-2 px-3 bg-white border-t border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
      style={{
        minHeight: 64,
        paddingTop: 10,
        paddingBottom: 'env(safe-area-inset-bottom, 10px)',
      }}
    >
      {/* 왼쪽: 광고 뱃지 + 메시지 2줄 */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
        <span className="w-fit text-[9px] font-bold border border-slate-300 text-slate-400 rounded px-1 leading-tight">
          광고
        </span>
        <p className="text-sm font-bold text-slate-800 leading-snug">{MSG}</p>
      </div>

      {/* 오른쪽: CTA 버튼 — shrink-0으로 항상 표시 */}
      <span className="shrink-0 bg-slate-900 text-white text-[11px] font-semibold px-3 py-2 rounded-lg whitespace-nowrap">
        {CTA_T}
      </span>
    </a>
  );
}
