// client/src/components/citation/CitationGraphControls.tsx

interface Props {
  depth: 1 | 2;
  onDepthChange: (d: 1 | 2) => void;
  filterOaOnly: boolean;
  onFilterOaOnlyChange: (v: boolean) => void;
  onRefresh: () => void;
  isRefetching: boolean;
}

export default function CitationGraphControls({
  depth,
  onDepthChange,
  filterOaOnly,
  onFilterOaOnlyChange,
  onRefresh,
  isRefetching,
}: Props) {
  return (
    <div className="flex items-center gap-4 p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      {/* 깊이 */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">깊이</label>
        <div className="flex gap-1">
          {[1, 2].map((d) => (
            <button
              key={d}
              onClick={() => onDepthChange(d as 1 | 2)}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                depth === d
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* OA 필터 */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={filterOaOnly}
          onChange={(e) => onFilterOaOnlyChange(e.target.checked)}
          className="w-4 h-4 text-blue-600 rounded"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">OA만 표시</span>
      </label>

      {/* 새로고침 */}
      <button
        onClick={onRefresh}
        disabled={isRefetching}
        className="ml-auto px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
      >
        {isRefetching ? '⟳ 새로고침 중' : '↻ 새로고침'}
      </button>
    </div>
  );
}
