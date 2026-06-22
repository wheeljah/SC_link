// client/src/hooks/useCitationGraph.ts
//
// TanStack Query 기반 인용 네트워크 데이터 훅.
// 서버의 7일 DB 캐시 + 클라이언트의 1시간 메모리 캐시로 이중 캐싱.

import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import type { CitationNetworkResponse } from '../types/citation';

interface UseCitationGraphParams {
  seedDoi: string;
  depth: 1 | 2;
  maxNodes?: number;
  direction?: 'both' | 'cites' | 'cited_by';
  enabled?: boolean;
}

export function useCitationGraph({
  seedDoi,
  depth,
  maxNodes = 200,
  direction = 'both',
  enabled = true,
}: UseCitationGraphParams) {
  return useQuery<CitationNetworkResponse>({
    queryKey: ['citation-network', seedDoi, depth, maxNodes, direction],
    queryFn: async () => {
      const { data } = await api.post<CitationNetworkResponse>('/citations/network', {
        seedDoi,
        depth,
        maxNodes,
        direction,
      });
      return data;
    },
    enabled: !!seedDoi && enabled,
    staleTime: 60 * 60 * 1000,     // 1시간 — 백엔드 DB 캐시(7일)와 별개로 클라이언트 메모리 보존
    gcTime: 30 * 60 * 1000,        // 30분 후 메모리 해제
    retry: 1,                       // OpenAlex 일시 장애 시 1회만 재시도 (Render 0.1 CPU 보호)
    refetchOnWindowFocus: false,    // 포커스 복귀 시 재요청 안 함
    refetchOnMount: false,          // 마운트 시 재요청 안 함 (캐시 우선)
  });
}
