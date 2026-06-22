// server/src/services/citationService.ts
//
// OpenAlex 기반 인용 네트워크 빌드 서비스.
//
// 핵심 기능:
//   1. DOI → OpenAlex Work ID 변환
//   2. Work의 references (forward) + cited_by (backward) 메타데이터 수집
//   3. depth/maxNodes/maxPerNode 제한 그래프 빌드
//   4. DB 캐시 (citation_cache 테이블, 7일 TTL)
//   5. 사용자 다운로드 이력과 연동 (inCollection 마킹)
//
// OpenAlex API (https://api.openalex.org):
//   - DOI → Work:        GET /works/doi:{doi}
//   - 단건 Work 조회:     GET /works/{openalex_id}  (referenced_works 필드 포함)
//   - Batch 조회:        GET /works?filter=openalex_id:W1|W2|...&select=...
//   - Cited-by 페이징:   GET /works?filter=cites:W{id}&per_page=200&cursor=*
//
// 비용 추정 (OpenAlex 무료):
//   - depth=1, maxNodes=200: ~2 reqs (cited_by 1 + batch 1) — 매우 쌈
//   - depth=2, maxNodes=100: ~102 reqs (50 fetchCitedBy + 50 batch + 2 base) — 적당
//   - depth=2, maxNodes=200: 비추천 (Render 무료에서 5분+ 소요)

import axios from 'axios';
import NodeCache from 'node-cache';
import { pool } from '../db/pool';

// ─── Types ─────────────────────────────────────────────────

export interface GraphNode {
  id: string;             // OpenAlex Work ID (예: "W2741809807")
  doi?: string;
  title: string;
  year?: number;
  authors?: string[];
  citationCount: number;
  accessStatus: 'downloadable' | 'partial' | 'paid_only' | 'unknown';
  oaStatus?: 'gold' | 'green' | 'hybrid' | 'bronze' | 'closed';
  isSeed: boolean;
  inCollection: boolean;  // ScholarLink에서 사용자가 이미 다운로드한 논문
}

export interface GraphEdge {
  source: string;
  target: string;
  type: 'cites' | 'cited_by';
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  seedId: string;
  seedDoi: string;
  stats: {
    totalFound: number;
    downloadableCount: number;
    partialCount: number;
    paidCount: number;
    inCollectionCount: number;
    buildTimeMs: number;
    fromCache: boolean;
  };
}

export interface BuildOptions {
  seedDoi: string;
  depth: number;                                     // 1 or 2
  maxNodes?: number;                                 // default 200
  direction?: 'both' | 'cites' | 'cited_by';         // default 'both'
  maxPerNode?: number;                               // 한 노드당 인접 확장 수, default 30
}

// ─── 상수 ─────────────────────────────────────────────────

const OPENALEX_BASE = 'https://api.openalex.org';
const USER_AGENT = 'ScholarLink/1.0 (mailto:support@scholarlink.app)';
const REQUEST_TIMEOUT = 12_000;

const DEFAULT_MAX_NODES = 200;
const HARD_MAX_NODES = 500;
const DEFAULT_MAX_PER_NODE = 30;

const CACHE_TTL_HOURS = 24 * 7;  // 7일

// L1: in-memory (같은 process 안에서 1시간 캐시)
const memoryCache = new NodeCache({ stdTTL: 3600, checkperiod: 600, maxKeys: 500 });

// ─── Helper ───────────────────────────────────────────────

function normalizeDoi(doi: string): string {
  return doi
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .toLowerCase();
}

function extractOpenAlexId(value: any): string | null {
  if (!value) return null;
  // "https://openalex.org/W2741809807" 또는 그냥 "W2741809807" 둘 다 허용
  const str = typeof value === 'string' ? value : value.id || value;
  if (typeof str !== 'string') return null;
  const m = str.match(/W\d+/);
  return m ? m[0] : null;
}

function buildAccessStatus(work: any): {
  status: GraphNode['accessStatus'];
  oaStatus?: GraphNode['oaStatus'];
} {
  const oa = work?.open_access;
  if (!oa) return { status: 'unknown' };
  const oaStatus = oa.oa_status as GraphNode['oaStatus'] | undefined;
  const isOa = oa.is_oa === true;

  if (!isOa || !oaStatus || oaStatus === 'closed') {
    return { status: 'paid_only', oaStatus: 'closed' };
  }

  switch (oaStatus) {
    case 'gold':
    case 'green':
    case 'hybrid':
      return { status: 'downloadable', oaStatus };
    case 'bronze':
      // Bronze: 출판사 사이트 무료지만 라이선스 불명확 → preprint 가능성 표시
      return { status: 'partial', oaStatus };
    default:
      return { status: 'paid_only', oaStatus: 'closed' };
  }
}

function workToNode(work: any, isSeed: boolean): GraphNode | null {
  const id = extractOpenAlexId(work);
  if (!id) return null;

  const doi = work?.doi?.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '') || undefined;
  const title = (work?.title || work?.display_name || 'Untitled').toString().trim();
  const year = work?.publication_year || undefined;
  const authors = (work?.authorships || [])
    .map((a: any) => a?.author?.display_name)
    .filter(Boolean)
    .slice(0, 5) as string[] | undefined;
  const citationCount = typeof work?.cited_by_count === 'number' ? work.cited_by_count : 0;
  const { status, oaStatus } = buildAccessStatus(work);

  return {
    id,
    doi,
    title,
    year,
    authors: authors && authors.length > 0 ? authors : undefined,
    citationCount,
    accessStatus: status,
    oaStatus,
    isSeed,
    inCollection: false,
  };
}

// ─── OpenAlex 호출 ────────────────────────────────────────

interface OpenAlexWork {
  id: string;
  doi?: string;
  title?: string;
  display_name?: string;
  publication_year?: number;
  authorships?: Array<{ author?: { display_name?: string } }>;
  cited_by_count?: number;
  referenced_works?: string[];
  open_access?: {
    is_oa?: boolean;
    oa_status?: string;
    oa_url?: string;
  };
}

/**
 * DOI → 단일 Work 조회. 404면 null.
 */
async function fetchWorkByDoi(doi: string): Promise<OpenAlexWork | null> {
  const norm = normalizeDoi(doi);
  const cacheKey = `doi:${norm}`;
  const hit = memoryCache.get<OpenAlexWork | null>(cacheKey);
  if (hit !== undefined) return hit;

  try {
    const res = await axios.get(`${OPENALEX_BASE}/works/doi:${encodeURIComponent(norm)}`, {
      timeout: REQUEST_TIMEOUT,
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
      validateStatus: (s) => s === 200 || s === 404,
    });
    if (res.status === 404) {
      memoryCache.set(cacheKey, null, 3600);
      return null;
    }
    const work = res.data as OpenAlexWork;
    memoryCache.set(cacheKey, work, 3600);
    return work;
  } catch (e) {
    console.warn(`[citation] DOI lookup failed: ${doi} — ${(e as Error).message}`);
    return null;
  }
}

/**
 * OpenAlex ID → 단일 Work 조회. referenced_works까지 가져옴.
 */
async function fetchWorkById(id: string, includeRefs = true): Promise<OpenAlexWork | null> {
  const cacheKey = `id:${id}:${includeRefs ? 'full' : 'lite'}`;
  const hit = memoryCache.get<OpenAlexWork | null>(cacheKey);
  if (hit !== undefined) return hit;

  try {
    const res = await axios.get(`${OPENALEX_BASE}/works/${id}`, {
      params: includeRefs
        ? { select: 'id,doi,title,display_name,publication_year,authorships,cited_by_count,referenced_works,open_access' }
        : { select: 'id,referenced_works' },
      timeout: REQUEST_TIMEOUT,
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
    });
    const work = res.data as OpenAlexWork;
    memoryCache.set(cacheKey, work, 3600);
    return work;
  } catch (e) {
    if ((e as any)?.response?.status === 404) {
      memoryCache.set(cacheKey, null, 3600);
      return null;
    }
    console.warn(`[citation] work fetch failed ${id}: ${(e as Error).message}`);
    return null;
  }
}

/**
 * Batch 조회: OpenAlex ID 배열 → 메타데이터 배열.
 * 50개씩 끊어서 호출.
 */
async function batchFetchWorks(ids: string[]): Promise<OpenAlexWork[]> {
  if (ids.length === 0) return [];

  const cacheKey = `batch:${ids.slice(0, 30).join(',')}:${ids.length}`;
  const hit = memoryCache.get<OpenAlexWork[]>(cacheKey);
  if (hit) return hit;

  const results: OpenAlexWork[] = [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 50) {
    chunks.push(ids.slice(i, i + 50));
  }

  for (const chunk of chunks) {
    const filter = chunk.join('|');
    try {
      const res = await axios.get(`${OPENALEX_BASE}/works`, {
        params: {
          filter: `openalex_id:${filter}`,
          select: 'id,doi,title,display_name,publication_year,authorships,cited_by_count,open_access',
          per_page: 50,
        },
        timeout: REQUEST_TIMEOUT,
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
      });
      const works = (res.data?.results || []) as OpenAlexWork[];
      results.push(...works);
    } catch (e) {
      console.warn(`[citation] batch fetch failed (${chunk.length} ids): ${(e as Error).message}`);
    }
  }

  memoryCache.set(cacheKey, results, 3600);
  return results;
}

/**
 * Work의 cited_by 목록을 OpenAlex ID 배열로 반환.
 * OpenAlex의 /works?filter=cites:W{id} 엔드포인트 + cursor 페이징.
 */
async function fetchCitedBy(workId: string, limit: number): Promise<string[]> {
  const cacheKey = `citedby:${workId}:${limit}`;
  const hit = memoryCache.get<string[]>(cacheKey);
  if (hit) return hit;

  const ids: string[] = [];
  let cursor: string | null = '*';

  try {
    while (ids.length < limit && cursor) {
      const cbRes: { data?: { results?: Array<{ id: string }>; meta?: { next_cursor?: string | null } } } =
        await axios.get(`${OPENALEX_BASE}/works`, {
          params: {
            filter: `cites:${workId}`,
            select: 'id',
            per_page: Math.min(200, limit - ids.length),
            cursor,
          },
          timeout: REQUEST_TIMEOUT,
          headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
        });
      const results = (cbRes.data?.results || []) as Array<{ id: string }>;
      for (const r of results) {
        const id = extractOpenAlexId(r);
        if (id) ids.push(id);
        if (ids.length >= limit) break;
      }
      cursor = cbRes.data?.meta?.next_cursor || null;
    }
  } catch (e) {
    console.warn(`[citation] cited_by fetch failed for ${workId}: ${(e as Error).message}`);
  }

  memoryCache.set(cacheKey, ids, 3600);
  return ids;
}

// ─── 사용자 다운로드 이력 매칭 ────────────────────────────

async function markInCollection(nodes: GraphNode[]): Promise<void> {
  const dois = nodes.map((n) => n.doi).filter(Boolean) as string[];
  if (dois.length === 0) return;

  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT LOWER(normalized_doi) AS doi
       FROM paper_requests
       WHERE status = 'completed'
         AND LOWER(normalized_doi) = ANY($1)`,
      [dois.map((d) => d.toLowerCase())]
    );
    const owned = new Set(rows.map((r: any) => r.doi));
    for (const node of nodes) {
      if (node.doi && owned.has(node.doi.toLowerCase())) {
        node.inCollection = true;
      }
    }
  } catch (e) {
    console.warn(`[citation] inCollection lookup failed: ${(e as Error).message}`);
  }
}

// ─── DB 캐시 (L2) ─────────────────────────────────────────

function buildCacheKey(seedDoi: string, depth: number, direction: string, maxNodes: number): string {
  return `cite:${normalizeDoi(seedDoi)}:${depth}:${direction}:${maxNodes}`;
}

async function loadFromDbCache(cacheKey: string): Promise<GraphData | null> {
  try {
    const { rows } = await pool.query(
      `SELECT graph_data FROM citation_cache
       WHERE cache_key = $1 AND expires_at > NOW()`,
      [cacheKey]
    );
    if (rows.length === 0) return null;
    const data = rows[0].graph_data as GraphData;
    data.stats.fromCache = true;
    return data;
  } catch (e) {
    console.warn(`[citation] cache load failed: ${(e as Error).message}`);
    return null;
  }
}

async function saveToDbCache(
  cacheKey: string,
  seedDoi: string,
  depth: number,
  direction: string,
  maxNodes: number,
  data: GraphData
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO citation_cache
        (cache_key, seed_doi, depth, direction, max_nodes, graph_data, node_count, edge_count, build_time_ms, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() + INTERVAL '${CACHE_TTL_HOURS} hours')
       ON CONFLICT (cache_key) DO UPDATE SET
         graph_data = EXCLUDED.graph_data,
         node_count = EXCLUDED.node_count,
         edge_count = EXCLUDED.edge_count,
         build_time_ms = EXCLUDED.build_time_ms,
         created_at = NOW(),
         expires_at = EXCLUDED.expires_at`,
      [
        cacheKey,
        normalizeDoi(seedDoi),
        depth,
        direction,
        maxNodes,
        JSON.stringify(data),
        data.nodes.length,
        data.edges.length,
        data.stats.buildTimeMs,
      ]
    );
  } catch (e) {
    console.warn(`[citation] cache save failed: ${(e as Error).message}`);
  }
}

// ─── 메인: 그래프 빌드 ────────────────────────────────────

interface FrontierItem {
  id: string;
  depth: number;
}

export async function buildCitationGraph(options: BuildOptions): Promise<GraphData> {
  const start = Date.now();
  const {
    seedDoi,
    depth,
    maxNodes = DEFAULT_MAX_NODES,
    direction = 'both',
    maxPerNode = DEFAULT_MAX_PER_NODE,
  } = options;

  // 입력 검증
  if (depth < 1 || depth > 2) {
    throw new Error('depth는 1 또는 2만 지원합니다.');
  }
  const cappedMaxNodes = Math.min(maxNodes, HARD_MAX_NODES);

  // depth=2에서는 무료 티어 보호를 위해 더 보수적
  const effectiveMaxNodes = depth === 2 ? Math.min(cappedMaxNodes, 100) : cappedMaxNodes;

  // 1) 캐시 조회
  const cacheKey = buildCacheKey(seedDoi, depth, direction, effectiveMaxNodes);
  const cached = await loadFromDbCache(cacheKey);
  if (cached) {
    console.log(`[citation] DB cache hit: ${cacheKey}`);
    await markInCollection(cached.nodes);
    cached.stats.inCollectionCount = cached.nodes.filter((n) => n.inCollection).length;
    return cached;
  }

  // 2) 시드 Work 조회
  const seedWork = await fetchWorkByDoi(seedDoi);
  if (!seedWork) {
    throw new Error(`DOI에 해당하는 논문을 OpenAlex에서 찾을 수 없습니다: ${seedDoi}`);
  }
  const seedId = extractOpenAlexId(seedWork);
  if (!seedId) {
    throw new Error('OpenAlex 응답에서 Work ID를 추출할 수 없습니다.');
  }

  // 3) BFS로 그래프 확장 (메타데이터는 일단 ID만 수집, 끝나고 batch)
  const allIds = new Set<string>([seedId]);
  const edges: GraphEdge[] = [];
  const queue: FrontierItem[] = [{ id: seedId, depth: 0 }];
  let addedCount = 1;

  while (queue.length > 0 && addedCount < effectiveMaxNodes) {
    const item = queue.shift()!;

    // 현재 노드의 메타는 이미 fetch되어 있어야 함 (또는 마지막에 batch)
    // depth 한계 도달 시 더 이상 확장 안 함
    if (item.depth >= depth) continue;

    const remaining = effectiveMaxNodes - addedCount;
    if (remaining <= 0) break;

    const perNodeLimit = Math.min(maxPerNode, remaining);

    // cited_by (backward): 이 논문을 인용하는 논문들
    if (direction === 'both' || direction === 'cited_by') {
      const cbIds = await fetchCitedBy(item.id, perNodeLimit);
      for (const cid of cbIds) {
        if (!allIds.has(cid)) {
          allIds.add(cid);
          edges.push({ source: cid, target: item.id, type: 'cited_by' });
          addedCount++;
          queue.push({ id: cid, depth: item.depth + 1 });
          if (addedCount >= effectiveMaxNodes) break;
        }
      }
    }

    if (addedCount >= effectiveMaxNodes) break;

    // references (forward): 이 논문이 인용하는 논문들
    if (direction === 'both' || direction === 'cites') {
      const work = await fetchWorkById(item.id, true);
      if (work?.referenced_works) {
        let refAddedForThisNode = 0;
        for (const refIdRaw of work.referenced_works) {
          if (refAddedForThisNode >= perNodeLimit) break;
          const refId = extractOpenAlexId(refIdRaw);
          if (!refId) continue;
          if (!allIds.has(refId)) {
            allIds.add(refId);
            edges.push({ source: item.id, target: refId, type: 'cites' });
            addedCount++;
            refAddedForThisNode++;
            queue.push({ id: refId, depth: item.depth + 1 });
            if (addedCount >= effectiveMaxNodes) break;
          }
        }
      }
    }
  }

  // 4) 시드 메타 + 나머지 ID 메타 batch 조회
  const seedNode = workToNode(seedWork, true);
  const otherIds = Array.from(allIds).filter((id) => id !== seedId);
  const otherWorks = await batchFetchWorks(otherIds);

  const nodes: GraphNode[] = [];
  if (seedNode) nodes.push(seedNode);
  for (const w of otherWorks) {
    const node = workToNode(w, false);
    if (node) nodes.push(node);
  }

  const buildTimeMs = Date.now() - start;
  const downloadableCount = nodes.filter((n) => n.accessStatus === 'downloadable').length;
  const partialCount = nodes.filter((n) => n.accessStatus === 'partial').length;
  const paidCount = nodes.filter((n) => n.accessStatus === 'paid_only').length;

  const data: GraphData = {
    nodes,
    edges,
    seedId,
    seedDoi: normalizeDoi(seedDoi),
    stats: {
      totalFound: nodes.length,
      downloadableCount,
      partialCount,
      paidCount,
      inCollectionCount: 0,
      buildTimeMs,
      fromCache: false,
    },
  };

  // 5) 사용자 컬렉션 마킹
  await markInCollection(nodes);
  data.stats.inCollectionCount = nodes.filter((n) => n.inCollection).length;

  // 6) 캐시 저장
  await saveToDbCache(cacheKey, seedDoi, depth, direction, effectiveMaxNodes, data);

  console.log(
    `[citation] built graph: ${nodes.length} nodes, ${edges.length} edges ` +
    `(${buildTimeMs}ms) for ${seedDoi} (depth=${depth}, dir=${direction})`
  );

  return data;
}

// ─── 관리자용: 캐시 정리 ──────────────────────────────────

export async function purgeExpiredCitationCache(): Promise<number> {
  try {
    const result = await pool.query(`DELETE FROM citation_cache WHERE expires_at < NOW()`);
    return result.rowCount || 0;
  } catch (e) {
    console.warn(`[citation] cache purge failed: ${(e as Error).message}`);
    return 0;
  }
}
