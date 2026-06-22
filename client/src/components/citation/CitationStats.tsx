// client/src/components/citation/CitationStats.tsx

import type { GraphData } from '../../types/citation';

interface Props {
  data: GraphData;
}

export default function CitationStats({ data }: Props) {
  const { stats } = data;
  const pct = stats.totalFound > 0
    ? Math.round((stats.downloadableCount / stats.totalFound) * 100)
    : 0;

  return (
    <div className="flex items-center gap-3 text-sm">
      {pct > 0 && (
        <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium">
          📥 이 네트워크의 {pct}%는 지금 바로 다운로드할 수 있어요
        </span>
      )}

      <span className="text-gray-600 dark:text-gray-400">
        노드 {stats.totalFound} · 엣지 {data.edges.length}
      </span>

      {stats.fromCache && (
        <span className="text-xs text-gray-400 dark:text-gray-500">⚡ 캐시</span>
      )}
    </div>
  );
}
