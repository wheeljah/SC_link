// client/src/components/citation/GraphLegend.tsx

export default function GraphLegend() {
  return (
    <div className="absolute bottom-4 right-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 text-xs space-y-1.5">
      <div className="font-bold text-gray-700 dark:text-gray-200 mb-1.5">범례</div>
      <div className="flex items-center gap-2">
        <svg width="14" height="14" viewBox="-7 -7 14 14">
          <circle cx="0" cy="0" r="6" fill="#10b981" stroke="#fff" strokeWidth="1.5" />
        </svg>
        <span className="text-gray-700 dark:text-gray-300">다운로드 가능 (OA)</span>
      </div>
      <div className="flex items-center gap-2">
        <svg width="14" height="14" viewBox="-7 -7 14 14">
          <path d="M0,-6 L6,0 L0,6 L-6,0 Z" fill="#f59e0b" stroke="#fff" strokeWidth="1.5" />
        </svg>
        <span className="text-gray-700 dark:text-gray-300">Preprint 가능</span>
      </div>
      <div className="flex items-center gap-2">
        <svg width="14" height="14" viewBox="-7 -7 14 14">
          <rect x="-6" y="-6" width="12" height="12" fill="#4b5563" stroke="#fff" strokeWidth="1.5" />
        </svg>
        <span className="text-gray-700 dark:text-gray-300">유료 (출판사 페이지 안내)</span>
      </div>
      <div className="flex items-center gap-2">
        <svg width="14" height="14" viewBox="-7 -7 14 14">
          <circle cx="0" cy="0" r="6" fill="#6b7280" stroke="#000" strokeWidth="3" />
        </svg>
        <span className="text-gray-700 dark:text-gray-300">시드 논문</span>
      </div>
      <div className="flex items-center gap-2">
        <svg width="14" height="14" viewBox="-7 -7 14 14">
          <circle cx="0" cy="0" r="6" fill="#10b981" stroke="#8b5cf6" strokeWidth="2.5" />
        </svg>
        <span className="text-gray-700 dark:text-gray-300">내 서재에 있음</span>
      </div>
      <hr className="border-gray-200 dark:border-gray-700 my-1.5" />
      <div className="flex items-center gap-2">
        <svg width="20" height="3">
          <line x1="0" y1="1.5" x2="20" y2="1.5" stroke="#3b82f6" strokeWidth="1.5" />
        </svg>
        <span className="text-gray-700 dark:text-gray-300">인용함</span>
      </div>
      <div className="flex items-center gap-2">
        <svg width="20" height="3">
          <line x1="0" y1="1.5" x2="20" y2="1.5" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 3" />
        </svg>
        <span className="text-gray-700 dark:text-gray-300">인용당함</span>
      </div>
    </div>
  );
}
