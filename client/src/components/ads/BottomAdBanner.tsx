import { useEffect } from 'react';

const CTA_U = 'https://ai-traffic.kr';
const MSG1  = '시약/장비 일단 띡! 견적요청만 올리면 됨';
const MSG2  = '비드바이브(BidVibe)';

export default function BottomAdBanner() {
  useEffect(() => {
    document.body.style.paddingBottom = 'calc(80px + env(safe-area-inset-bottom, 0px))';
    return () => { document.body.style.paddingBottom = '0px'; };
  }, []);

  return (
    <a
      href={CTA_U}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-0 left-0 right-0 z-[9998] flex flex-col items-center justify-center px-4 shadow-[0_-4px_16px_rgba(0,0,0,0.24)]"
      style={{
        backgroundColor: '#1e1b4b',
        borderTop: '1px solid rgba(99,102,241,0.25)',
        minHeight: 80,
        paddingTop: 12,
        paddingBottom: 'env(safe-area-inset-bottom, 12px)',
        gap: 4,
      }}
    >
      <span className="text-[9px] font-bold rounded px-1 leading-tight self-center"
        style={{ border: '1px solid rgba(165,180,252,0.4)', color: 'rgba(165,180,252,0.7)' }}>
        광고
      </span>
      <p className="text-sm font-bold text-white text-center leading-snug break-keep">
        {MSG1}
      </p>
      <p className="text-xs font-semibold text-indigo-300 text-center leading-snug">
        {MSG2}
      </p>
    </a>
  );
}
