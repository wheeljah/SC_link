// client/src/components/citation/NodeDetailPanel.tsx

import type { GraphNode } from '../../types/citation';

interface Props {
  node: GraphNode;
  onClose: () => void;
}

function buildDoiUrl(doi: string): string {
  return `https://doi.org/${doi}`;
}

function buildOpenAlexUrl(id: string): string {
  return `https://openalex.org/${id}`;
}

export default function NodeDetailPanel({ node, onClose }: Props) {
  return (
    <aside
      className="w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col"
      role="region"
      aria-label="선택한 논문 상세 정보"
    >
      {/* 헤더 */}
      <div className="flex items-start justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-750">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {node.isSeed && (
              <span className="px-2 py-0.5 text-xs font-bold rounded bg-black text-white">
                SEED
              </span>
            )}
            {node.inCollection && (
              <span className="px-2 py-0.5 text-xs font-bold rounded bg-purple-100 text-purple-700">
                ✓ 내 서재
              </span>
            )}
            <span
              className="px-2 py-0.5 text-xs font-medium rounded"
              style={{
                backgroundColor:
                  node.accessStatus === 'downloadable' ? '#d1fae5'
                    : node.accessStatus === 'partial' ? '#fef3c7'
                    : node.accessStatus === 'paid_only' ? '#fee2e2'
                    : '#e5e7eb',
                color:
                  node.accessStatus === 'downloadable' ? '#065f46'
                    : node.accessStatus === 'partial' ? '#92400e'
                    : node.accessStatus === 'paid_only' ? '#991b1b'
                    : '#374151',
              }}
            >
              {node.accessStatus === 'downloadable' ? '다운로드 가능'
                : node.accessStatus === 'partial' ? 'Preprint 가능'
                : node.accessStatus === 'paid_only' ? '유료'
                : '상태 불명'}
            </span>
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 line-clamp-3">
            {node.title}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="ml-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          aria-label="패널 닫기"
        >
          ✕
        </button>
      </div>

      {/* 메타데이터 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {node.year && (
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">연도</div>
            <div className="text-sm text-gray-900 dark:text-gray-100">{node.year}</div>
          </div>
        )}
        {node.authors && node.authors.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">저자</div>
            <div className="text-sm text-gray-900 dark:text-gray-100">
              {node.authors.join(', ')}
              {node.authors.length === 5 && ' 외'}
            </div>
          </div>
        )}
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400">인용 수</div>
          <div className="text-sm text-gray-900 dark:text-gray-100 font-medium">
            {node.citationCount.toLocaleString()}회 인용됨
          </div>
        </div>
        {node.doi && (
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">DOI</div>
            <a
              href={buildDoiUrl(node.doi)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 underline break-all"
            >
              {node.doi}
            </a>
          </div>
        )}
        {node.oaStatus && node.oaStatus !== 'closed' && (
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">OA 유형</div>
            <div className="text-sm text-gray-900 dark:text-gray-100 capitalize">{node.oaStatus}</div>
          </div>
        )}
      </div>

      {/* 액션 */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750 space-y-2">
        {node.accessStatus === 'downloadable' && node.doi && (
          <a
            href={`/?doi=${encodeURIComponent(node.doi)}`}
            className="block w-full px-4 py-2 text-sm font-medium text-center text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-colors"
          >
            📥 PDF 다운로드
          </a>
        )}
        {node.accessStatus === 'partial' && node.doi && (
          <a
            href={`/?doi=${encodeURIComponent(node.doi)}`}
            className="block w-full px-4 py-2 text-sm font-medium text-center text-white bg-amber-600 hover:bg-amber-700 rounded transition-colors"
          >
            📄 Preprint 받기
          </a>
        )}
        {node.accessStatus === 'paid_only' && node.doi && (
          <a
            href={buildDoiUrl(node.doi)}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full px-4 py-2 text-sm font-medium text-center text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
          >
            🔗 출판사 페이지 열기
          </a>
        )}
        <a
          href={buildOpenAlexUrl(node.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full px-4 py-2 text-sm text-center text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
        >
          OpenAlex에서 보기 ↗
        </a>
      </div>
    </aside>
  );
}
