// client/src/pages/CitationNetworkPage.tsx

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCitationGraph } from '../hooks/useCitationGraph';
import CitationGraph from '../components/citation/CitationGraph';
import CitationGraphControls from '../components/citation/CitationGraphControls';
import NodeDetailPanel from '../components/citation/NodeDetailPanel';
import CitationStats from '../components/citation/CitationStats';
import GraphLegend from '../components/citation/GraphLegend';
import type { GraphNode, GraphData } from '../types/citation';

function isValidDoi(s: string): boolean {
  return /^10\.\d{4,}(\.\d+)*\/\S+$/i.test(s.trim());
}

export default function CitationNetworkPage() {
  const params = useParams<{ doi?: string }>();
  const navigate = useNavigate();

  const doiFromUrl = params.doi ? decodeURIComponent(params.doi) : '';
  const [inputDoi, setInputDoi] = useState(doiFromUrl);
  const [activeDoi, setActiveDoi] = useState(doiFromUrl);
  const [depth, setDepth] = useState<1 | 2>(1);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filterOaOnly, setFilterOaOnly] = useState(false);

  const { data, isLoading, error, refetch, isRefetching } = useCitationGraph({
    seedDoi: activeDoi,
    depth,
    enabled: !!activeDoi && isValidDoi(activeDoi),
  });

  // ─── DOI 입력 폼 (URL에 DOI 없을 때) ───────────────────
  if (!doiFromUrl) {
    return (
      <div className="max-w-2xl mx-auto p-6 mt-12">
        <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">
          🔗 인용 네트워크
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          DOI를 입력하면 그 논문과 인용 관계가 있는 논문들의 관계도를 볼 수 있습니다.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const d = inputDoi.trim();
            if (isValidDoi(d)) {
              navigate(`/network/${encodeURIComponent(d)}`);
            }
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={inputDoi}
            onChange={(e) => setInputDoi(e.target.value)}
            placeholder="10.1038/nature14539"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          <button
            type="submit"
            disabled={!isValidDoi(inputDoi)}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            네트워크 보기
          </button>
        </form>
      </div>
    );
  }

  // ─── 로딩 ──────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-gray-600 dark:text-gray-400">인용 네트워크를 그리는 중...</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            처음 요청 시 10~30초 소요 (Render 무료 플랜 + OpenAlex 조회)
          </p>
        </div>
      </div>
    );
  }

  // ─── 에러 ──────────────────────────────────────────────
  if (error) {
    const msg = (error as Error).message;
    const notFound = msg.includes('찾을 수 없') || msg.includes('404');
    return (
      <div className="max-w-xl mx-auto p-6 mt-12">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
          <h2 className="font-bold text-red-700 dark:text-red-300 mb-1">
            {notFound ? 'DOI를 찾을 수 없어요' : '인용 네트워크를 불러올 수 없어요'}
          </h2>
          <p className="text-sm text-red-600 dark:text-red-400 mb-3">{msg}</p>
          <div className="flex gap-2">
            <button
              onClick={() => refetch()}
              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
            >
              다시 시도
            </button>
            <button
              onClick={() => navigate('/network')}
              className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded"
            >
              다른 DOI 입력
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data?.data) return null;

  // ─── 클라이언트 측 OA 필터 ──────────────────────────────
  const filteredData: GraphData = filterOaOnly
    ? {
        ...data.data,
        nodes: data.data.nodes.filter((n) => n.accessStatus !== 'paid_only'),
      }
    : data.data;

  // ─── 메인 화면 ──────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-200px)] gap-4 p-4">
      {/* 좌측 메인 영역 */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 min-w-0">
        {/* 헤더 */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
              인용 네트워크
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              시드: <span className="font-mono">{doiFromUrl}</span> · 깊이 {depth} · 노드 {filteredData.nodes.length}개
            </p>
          </div>
          <CitationStats data={filteredData} />
        </div>

        {/* 컨트롤 */}
        <CitationGraphControls
          depth={depth}
          onDepthChange={setDepth}
          filterOaOnly={filterOaOnly}
          onFilterOaOnlyChange={setFilterOaOnly}
          onRefresh={() => refetch()}
          isRefetching={isRefetching}
        />

        {/* 그래프 */}
        <div className="flex-1 relative overflow-hidden">
          {filteredData.nodes.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              필터링 결과가 없습니다.
            </div>
          ) : (
            <>
              <CitationGraph
                data={filteredData}
                onNodeClick={setSelectedNode}
                highlightSeed={true}
              />
              <GraphLegend />
              <div className="absolute top-2 right-2 text-xs text-gray-400 dark:text-gray-500 bg-white/80 dark:bg-gray-800/80 px-2 py-1 rounded">
                💡 더블클릭: 줌 리셋 · 휠: 줌 · 드래그: 노드 고정
              </div>
            </>
          )}
        </div>
      </div>

      {/* 우측 디테일 패널 */}
      {selectedNode && (
        <NodeDetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
      )}
    </div>
  );
}
