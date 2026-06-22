// client/src/types/citation.ts
//
// 인용 네트워크 그래프 데이터 타입.
// 백엔드 server/src/services/citationService.ts 와 1:1 대응.

export interface GraphNode {
  /** OpenAlex Work ID (예: "W2741809807") */
  id: string;
  doi?: string;
  title: string;
  year?: number;
  authors?: string[];
  citationCount: number;
  accessStatus: 'downloadable' | 'partial' | 'paid_only' | 'unknown';
  oaStatus?: 'gold' | 'green' | 'hybrid' | 'bronze' | 'closed';
  isSeed: boolean;
  /** 사용자가 ScholarLink에서 이전에 다운로드한 논문인지 */
  inCollection: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: 'cites' | 'cited_by';
}

export interface GraphStats {
  totalFound: number;
  downloadableCount: number;
  partialCount: number;
  paidCount: number;
  inCollectionCount: number;
  buildTimeMs: number;
  fromCache: boolean;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  seedId: string;
  seedDoi: string;
  stats: GraphStats;
}

export interface CitationNetworkRequest {
  seedDoi: string;
  depth?: 1 | 2;
  maxNodes?: number;
  direction?: 'both' | 'cites' | 'cited_by';
}

export interface CitationNetworkResponse {
  success: boolean;
  data: GraphData;
  message?: string;
}
