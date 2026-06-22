# ScholarLink 인용 네트워크 시각화 기능 기획서

| 항목 | 내용 |
|---|---|
| 문서 버전 | 1.0 |
| 작성일 | 2026-06-23 |
| 대상 서비스 | ScholarLink (`wheeljah/SC_link`) |
| 작성자 | Mavis |
| 상태 | 초안 |

---

## 1. 개요

### 1.1 배경

ScholarLink는 DOI, PMID, arXiv ID만으로 오픈액세스 학술 자료를 통합 검색하고 다운로드할 수 있는 마이크로 서비스다. 현재 다운로드와 검색은 탄탄하지만, 사용자가 내려받은 논문과 그 인용 관계를 한눈에 파악할 수 있는 도구는 부재하다. 결과적으로 "논문 한 편을 받고 끝나는" 일회성 사용에 그치고 있다.

학술 연구 워크플로우에서 인용 네트워크는 가장 자주 활용되는 시각화 중 하나다. Connected Papers, ResearchRabbit, Litmaps 같은 글로벌 서비스가 이미 인기를 끌고 있고, 한국 학술 생태계에는 이 기능을 제대로 제공하는 서비스가 거의 없다.

### 1.2 목표

사용자가 ScholarLink에서 검색하거나 다운로드한 논문을 중심으로 **인용 네트워크를 인터랙티브하게 시각화**하여 다음 가치를 제공한다.

- 어떤 논문이 어떤 논문을 참조하고, 어떤 논문에게 참조되는지 한눈에 파악
- 연구 분야의 핵심 논문(허브 노드)과 최신 흐름을 직관적으로 탐색
- 다운로드한 논문에서 출발해 관련 연구로 자연스럽게 확장
- ScholarLink를 단순 다운로더가 아닌 **연구 워크플로우 도구**로 포지셔닝

### 1.3 범위

**포함**

- 단일 논문 기준의 인용 네트워크 조회 (cited_by, references)
- 키워드 검색 결과의 인용 네트워크 시각화
- 다운로드한 논문 묶음(컬렉션)의 인용 네트워크
- 노드 클릭 시 메타데이터 패널 + 원문 다운로드 진입점

**제외 (v1 범위 외)**

- 공동 인용(co-citation) 네트워크
- bibliographic coupling 네트워크
- 시간축 애니메이션 재생
- 사용자 간 공유 링크

---

## 2. 사용자 시나리오

### 2.1 주요 페르소나

| 페르소나 | 특징 | 핵심 니즈 |
|---|---|---|
| **대학원생 민수** | 석사 과정, 연구 주제 정리 단계 | 관련 논문 20~30편의 인용 관계를 빠르게 파악해 리뷰 논문 작성 |
| **박사후 연구원 지원** | 박사 후, 새 분야 진입 | 기존 다운로드한 논문 3편에서 출발해 관련 연구 분야 전체를 탐색 |
| **교수 영희** | 지도교수, 학생 논문 검토 | 특정 저자/키워드의 핵심 논문과 최신 논문을 한눈에 비교 |

### 2.2 핵심 사용 시나리오

**시나리오 A — 단일 논문에서 출발**

1. 사용자가 DOI로 논문 한 편을 검색한다.
2. 검색 결과 상세 페이지에서 "인용 네트워크 보기" 버튼을 클릭한다.
3. 백엔드가 OpenAlex API로 해당 논문의 references(참조 목록)와 cited_by(인용 논문 목록)를 가져온다.
4. 프론트가 D3.js로 포스 디렉티드 그래프를 렌더링한다.
5. 노드 클릭 시 우측에 메타데이터 패널이 열리고 "PDF 다운로드" 버튼이 표시된다.

**시나리오 B — 키워드 검색 결과 묶음**

1. 사용자가 키워드로 논문 30편을 검색한다.
2. "이 묶음의 인용 네트워크 보기" 버튼을 클릭한다.
3. 묶음 안의 논문들이 서로 인용 관계가 있으면 그래프에 엣지로 표시된다.
4. 다른 논문들과 가장 많이 연결된 허브 논문이 시각적으로 부각된다.

**시나리오 C — 다운로드 이력 활용**

1. 로그인 사용자가 마이페이지의 다운로드 이력에서 여러 논문을 선택한다.
2. "선택한 논문들의 인용 네트워크 만들기"를 클릭한다.
3. 선택한 논문들을 시드로 네트워크가 그려진다.
4. 그래프를 PNG로 저장하거나, 노드 리스트를 CSV로 내보낼 수 있다.

---

## 3. 기술 스택

### 3.1 데이터 소스 — OpenAlex API

| 항목 | 내용 |
|---|---|
| 제공자 | OurResearch (비영리) |
| 인증 | 무료 API 키 (회원가입 필요) |
| 무료 한도 | 일 1달러 상당 (약 100,000 호출) |
| 라이선스 | CC0 |
| 응답 형식 | JSON |
| 문서 | https://docs.openalex.org |

**사용 엔드포인트**

| 엔드포인트 | 용도 |
|---|---|
| `GET /works?filter=doi:{doi}` | DOI로 단일 논문 조회 |
| `GET /works/{openalex_id}` | OpenAlex ID로 단일 논문 조회 |
| `GET /works?filter=cites:{openalex_id}` | 특정 논문을 인용한 논문 목록 (cited_by) |
| `GET /works?filter=referenced_works:{openalex_id}` | 특정 논문이 참조한 논문 목록 (references) |
| `GET /works?search={keyword}` | 키워드로 관련 논문 검색 |
| `GET /authors/{id}` | 저자 상세 |
| `GET /concepts/{id}` | 주제(개념) 상세 |

**호출 예시**

```
GET https://api.openalex.org/works/W2741809807
?mailto=admin@scholarlink.app
&select=id,doi,title,publication_year,cited_by_count,authorships,referenced_works
```

**비용 관리 전략**

- 일 1달러 한도 안에서 캐싱 적극 활용
- OpenAlex는 `cited_by_api_url`을 응답에 포함하므로 추가 요청 시 비용 절감
- 다운로드 이력의 OpenAlex ID는 30일간 캐시 (논문 메타데이터는 자주 안 바뀜)
- 인용 네트워크는 요청 시점 기준 1시간 캐시 (논문 발표/인용이 실시간으로 늘어남)

### 3.2 백엔드

| 항목 | 기술 |
|---|---|
| 런타임 | Node.js + TypeScript (기존) |
| HTTP 클라이언트 | Axios (기존) |
| 캐싱 | Redis 또는 PostgreSQL의 `citation_cache` 테이블 |
| API 키 관리 | 기존 `encryptionService` 활용 |
| Rate Limit | 기존 `express-rate-limit` (OpenAlex 호출 분당 30회로 추가 제한) |

### 3.3 프론트엔드

| 항목 | 기술 |
|---|---|
| 시각화 | D3.js v7 (force-directed graph) |
| 프레임워크 | React 18 + TypeScript (기존) |
| 라우팅 | React Router v6 (기존) |
| 스타일 | Tailwind CSS (기존) |
| 상태 관리 | React Context + 로컬 상태 (useState/useReducer) |
| 데이터 페치 | TanStack Query (캐싱/로딩/에러 처리) |

### 3.4 D3.js force-directed graph 채택 이유

대안 라이브러리(ECharts, Cytoscape.js, vis.js)와 비교했을 때:

- D3.js force simulation은 학술 인용 네트워크의 자연스러운 클러스터링에 적합
- 노드/엣지 커스터마이징 자유도가 가장 높음 (논문 메타데이터 표시에 유리)
- v7은 React 18과 호환성 문제 없음
- 번들 크기 적당함 (트리 쉐이킹 가능)
- 한국어/일본어/중국어 등 비라틴 문자 폰트 처리 검증됨

**주의 사항**

- 5,000 노드 이상 시 성능 저하 (Stack Overflow 검증 사례). 우리는 200~500 노드 범위만 다루므로 안전.
- 모바일 터치 인터랙션은 직접 처리 필요 (드래그, 핀치 줌).

---

## 4. 시스템 아키텍처

### 4.1 전체 흐름

```
[사용자]
  │
  ▼ (논문 DOI 입력)
[React 프론트]
  │
  ▼ POST /api/v1/citations/network { seedDoi, depth }
[Express 백엔드]
  │
  ├─ 1) OpenAlex에서 seed 논문 조회
  ├─ 2) referenced_works + cited_by 조회 (depth 만큼)
  ├─ 3) citation_cache 테이블 확인 → 캐시 히트 시 스킵
  ├─ 4) 노드/엣지 데이터로 가공
  └─ 5) JSON 반환
  │
  ▼ { nodes: [...], edges: [...] }
[React 프론트]
  │
  └─ D3 force simulation으로 렌더링
```

### 4.2 컴포넌트 다이어그램

```
client/src/components/citation/
├── CitationGraph.tsx       # D3 force-directed 그래프 컴포넌트
├── CitationGraphControls.tsx # 깊이/필터/레이아웃 컨트롤
├── NodeDetailPanel.tsx     # 노드 클릭 시 메타데이터 패널
├── GraphLegend.tsx         # 노드 색상/크기 범례
└── GraphToolbar.tsx        # PNG 저장, CSV 내보내기, 새로고침

client/src/pages/
└── CitationNetworkPage.tsx # 인용 네트워크 페이지 (라우트: /network)
```

```
server/src/
├── routes/
│   └── citationRoutes.ts   # POST /api/v1/citations/network
├── services/
│   ├── openAlexService.ts  # OpenAlex API 클라이언트
│   └── citationGraphService.ts  # 노드/엣지 가공, 캐싱 로직
└── db/
    └── (migrate.ts에 citation_cache 테이블 추가)
```

---

## 5. 데이터 설계

### 5.1 PostgreSQL 테이블

**citation_cache** — OpenAlex 응답 캐시 (TTL 30일)

```sql
CREATE TABLE citation_cache (
  id SERIAL PRIMARY KEY,
  cache_key VARCHAR(500) UNIQUE NOT NULL,  -- 'work:W2741809807' 또는 'cited_by:W2741809807:depth:1'
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_citation_cache_expires ON citation_cache(expires_at);
CREATE INDEX idx_citation_cache_key ON citation_cache(cache_key);
```

**citation_networks** — 사용자 생성 네트워크 저장 (로그인 사용자 한정, v1.5 이후)

```sql
CREATE TABLE citation_networks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  seed_dois TEXT[] NOT NULL,
  depth SMALLINT NOT NULL DEFAULT 1,
  graph_data JSONB NOT NULL,  -- 노드/엣지 스냅샷
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_citation_networks_user ON citation_networks(user_id);
```

**download_servers** — 기존 테이블에 OpenAlex 서버 추가 (헬스체크용)

```sql
INSERT INTO download_servers (name, type, base_url, is_active)
VALUES ('OpenAlex API', 'api', 'https://api.openalex.org', true);
```

### 5.3 OpenAlex 응답 정규화 규칙

OpenAlex는 원시 데이터를 그대로 주지만 ScholarLink 내부 스키마(Node/Edge)로 변환할 때 다음 규칙을 따른다. 이 정규화는 `openAlexService.ts`의 `normalizeWork()` 함수에서 담당한다.

| OpenAlex 필드 | 내부 필드 | 변환 규칙 |
|---|---|---|
| `id` (예: `https://openalex.org/W2741809807`) | `id` | `W2741809807` 부분만 추출 |
| `doi` (예: `https://doi.org/10.1038/...`) | `doi` | URL 프리픽스 제거, 소문자 정규화 |
| `title` | `title` | null이면 빈 문자열 |
| `publication_year` | `year` | null이면 0 |
| `cited_by_count` | `citationCount` | 0 이상 보장 |
| `authorships[].author.display_name` | `authors` | 최대 3명 + "et al." 처리 |
| `referenced_works` | 엣지 생성 | `cites` 타입 엣지로 변환 |
| `cited_by_api_url` | (호출용) | cited_by 조회 시 활용 |
| `type` (예: `article`, `book-chapter`) | (메타) | 노드 디테일 패널에 표시 |

**정규화 의사코드**

```typescript
function normalizeWork(work: OpenAlexWork): Node {
  const openAlexId = work.id?.replace('https://openalex.org/', '') ?? '';
  const doi = work.doi?.replace('https://doi.org/', '').toLowerCase() ?? null;
  const authorNames = (work.authorships ?? [])
    .map(a => a.author?.display_name)
    .filter(Boolean);
  const authors = authorNames.length > 3
    ? [...authorNames.slice(0, 3), 'et al.']
    : authorNames;

  return {
    id: openAlexId,
    doi,
    title: work.title ?? '',
    year: work.publication_year ?? 0,
    authors,
    citationCount: Math.max(0, work.cited_by_count ?? 0),
    inCollection: false,  // 호출 시점에 사용자 다운로드 이력과 매칭
    isSeed: false,
  };
}
```

**엣지 생성 규칙**

1. 시드 논문의 `referenced_works`를 순회 → 각 ID에 대해 `{ source: seedId, target: refId, type: 'cites' }` 엣지 생성
2. 시드 논문의 `cited_by_api_url` 응답을 순회 → 각 work에 대해 `{ source: citerId, target: seedId, type: 'cited_by' }` 엣지 생성
3. depth > 1인 경우, depth 1의 각 노드에 대해 1~2를 재귀적으로 반복
4. 자기 인용(self-citation) 엣지는 표시하되 색상을 회색으로 구분
5. 중복 엣지 제거 (source-target-type 조합 유니크)

**데이터 품질 플래그**

| 플래그 | 의미 | 발생 시 처리 |
|---|---|---|
| `isMatchedByDoi` | DOI로 정확히 매칭됨 | 정상 |
| `isMatchedByTitle` | 제목 유사도로 매칭됨 (DOI 없음) | UI에 "유사 매칭" 표시 |
| `isOrphan` | 시드와 연결되지 않은 고아 노드 | 그래프에서 제외 |
| `hasMissingMetadata` | 저자/연도 누락 | 디테일 패널에 "?" 표시 |

### 5.2 노드/엣지 데이터 포맷

프론트가 소비하는 JSON 스키마:

```typescript
type Node = {
  id: string;            // OpenAlex ID (W2741809807) 또는 DOI
  doi: string | null;
  title: string;
  year: number | null;
  authors: string[];     // ["Smith, J.", "Lee, K."]
  citationCount: number; // OpenAlex의 cited_by_count
  inCollection: boolean; // 사용자가 다운로드한 논문인지
  isSeed: boolean;       // 사용자가 입력한 시드 논문인지
  accessStatus: 'downloadable' | 'partial' | 'paid_only';
  // downloadable: OA 원문 ScholarLink로 즉시 다운로드 가능
  // partial: Preprint 등 일부 버전 다운로드 가능
  // paid_only: 유료 — 외부 링크/안내만 제공
  oaLocations: OaLocation[]; // OpenAlex의 best_oa_location + 다른 위치들
  externalUrl: string | null; // 유료일 때 출판사 페이지 URL
};

type OaLocation = {
  source: string;        // 'pmc', 'arxiv', 'unpaywall', 'publisher' 등
  url: string;
  pdfUrl: string | null;
  license: string | null; // 'cc-by', 'cc-by-nc' 등
  isBest: boolean;
};

type Edge = {
  source: string;        // Node.id
  target: string;        // Node.id
  type: 'cites' | 'cited_by';
};

type GraphData = {
  nodes: Node[];
  edges: Edge[];
  seedDoi: string;
  depth: number;
  generatedAt: string;   // ISO timestamp
};
```

---

## 6. API 명세

### 6.1 인용 네트워크 생성

```
POST /api/v1/citations/network
Content-Type: application/json
Authorization: Bearer {jwt}  // 선택 (비로그인도 사용 가능)
```

**요청 본문**

```json
{
  "seedDoi": "10.1038/s41586-020-2649-2",
  "depth": 1,
  "maxNodes": 200,
  "direction": "both"  // "both" | "cites" | "cited_by"
}
```

**응답 (200 OK)**

```json
{
  "nodes": [
    {
      "id": "W2741809807",
      "doi": "10.1038/s41586-020-2649-2",
      "title": "Highly accurate protein structure prediction with AlphaFold",
      "year": 2021,
      "authors": ["Jumper, J.", "Evans, R."],
      "citationCount": 15420,
      "inCollection": true,
      "isSeed": true
    }
  ],
  "edges": [
    { "source": "W2741809807", "target": "W2123456789", "type": "cites" }
  ],
  "seedDoi": "10.1038/s41586-020-2649-2",
  "depth": 1,
  "generatedAt": "2026-06-23T02:00:00Z"
}
```

**에러 응답**

| 코드 | 상황 | 메시지 |
|---|---|---|
| 400 | DOI 형식 오류 | `Invalid DOI format` |
| 404 | OpenAlex에서 찾을 수 없음 | `Paper not found in OpenAlex` |
| 429 | OpenAlex rate limit 초과 | `OpenAlex rate limit reached, try again in X minutes` |
| 500 | OpenAlex API 오류 | `Failed to fetch citation data` |
| 502 | OpenAlex 응답 시간 초과 (10초) | `OpenAlex API timeout` |

### 6.2 기존 엔드포인트 확장

```
GET /api/v1/papers/metadata?doi={doi}
```

응답에 OpenAlex 메타데이터 추가:

```json
{
  "doi": "10.1038/...",
  "title": "...",
  "openAlexId": "W2741809807",
  "citedByCount": 15420,
  "referenceCount": 78
}
```

### 6.3 헬스체크

```
GET /api/v1/citations/health
```

OpenAlex API 서버 상태를 기존 `serverMonitorService` 패턴으로 모니터링.

**응답**

```json
{
  "status": "healthy",
  "openAlex": {
    "reachable": true,
    "responseTimeMs": 234,
    "lastChecked": "2026-06-23T02:00:00Z"
  },
  "cache": {
    "totalEntries": 1284,
    "hitRate24h": 0.62
  }
}
```

### 6.4 노드 디테일 (lazy fetch)

그래프에서 노드 클릭 시 우측 패널에 표시할 상세 정보는 **lazy fetch**로 가져온다. 이유는:

- 초기 네트워크 응답이 가벼워짐 (100개 노드 모두 메타데이터 포함 시 1MB+)
- 사용자가 클릭한 노드만 추가 로드
- 패널이 닫히면 메모리에서 해제

```
GET /api/v1/citations/node/:openAlexId
```

**응답**

```json
{
  "id": "W2741809807",
  "doi": "10.1038/s41586-020-2649-2",
  "title": "Highly accurate protein structure prediction with AlphaFold",
  "abstract": "Proteins are essential to life...",
  "year": 2021,
  "authors": ["Jumper, J.", "Evans, R."],
  "venue": "Nature",
  "type": "article",
  "openAccess": {
    "isOa": true,
    "oaUrl": "https://www.nature.com/articles/...",
    "oaStatus": "gold"
  },
  "citationCount": 15420,
  "referenceCount": 78,
  "relatedWorks": [
    "W2123456789", "W2987654321"
  ]
}
```

### 6.5 엣지 페이지네이션 (대규모 네트워크)

depth=2 이상에서 엣지가 1,000개를 넘을 수 있다. 이때는 노드는 모두 반환하고 엣지만 페이지네이션한다.

```
GET /api/v1/citations/network/:networkId/edges?offset=0&limit=200
```

**응답**

```json
{
  "edges": [
    { "source": "W2741809807", "target": "W2123456789", "type": "cites" }
  ],
  "total": 1247,
  "offset": 0,
  "limit": 200,
  "hasMore": true
}
```

클라이언트는 `hasMore`가 true일 때만 추가 요청을 보내고, 사용자가 줌 레벨을 낮춰 전체를 볼 때만 자동 로드한다.

---

## 7. UI / UX 와이어프레임

### 7.1 페이지 레이아웃 (CitationNetworkPage)

```
┌──────────────────────────────────────────────────────────────┐
│ [ScholarLink 로고]  [검색바]            [언어] [프로필]      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  인용 네트워크: AlphaFold 단백질 구조 예측                      │
│  시드: 10.1038/s41586-020-2649-2  · 깊이 1  · 노드 87개      │
│  [PNG 저장] [CSV 내보내기] [새로고침] [필터]                   │
│                                                              │
│  ┌────────────────────────────┐  ┌────────────────────┐    │
│  │                            │  │ 노드 상세            │    │
│  │                            │  │                    │    │
│  │   ●  ●─●                   │  │ AlphaFold           │    │
│  │   │  ╲│                    │  │ Jumper et al., 2021 │    │
│  │   ●──●●──●                 │  │ Nature              │    │
│  │      │ ╲                   │  │                    │    │
│  │      ●  ●─●                │  │ 인용 15,420회       │    │
│  │                            │  │ 참조 78건           │    │
│  │   (D3 force-directed      │  │                    │    │
│  │    graph 렌더링 영역)      │  │ [PDF 다운로드]      │    │
│  │                            │  │ [DOI로 이동]        │    │
│  │                            │  │                    │    │
│  └────────────────────────────┘  └────────────────────┘    │
│                                                              │
│  범례: ● 시드 논문  ● 인용  ● 참조  ● 다운로드한 논문         │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 노드 디자인 규칙

**색상 규칙 (3단계 접근성)**

OA 비율이 글로벌 평균 47~59%(분야별 차이 큼)에 달하므로, 색상 구분은 "다운로드 가능성"을 직관적으로 보여주는 데 집중한다. 색상 외에 노드 모양으로도 구분해 색맹 사용자를 배려한다.

| 접근성 상태 | 색상 | 노드 모양 | 의미 |
|---|---|---|---|
| `downloadable` | **초록** | 원 | ScholarLink로 즉시 PDF 다운로드 가능 (OA 원문) |
| `partial` | **노랑** | 다이아몬드 | Preprint 등 일부 버전 다운로드 가능 (arXiv, bioRxiv, 저자 홈페이지) |
| `paid_only` | **빨강** | 사각형 | 유료 — ScholarLink로 다운로드 불가, 외부 출판사 링크로 안내 |

**시드/다운로드 논문 표시 (색상 위에 추가)**

시드 논문과 사용자가 다운로드한 논문은 **테두리**로 구분한다 (배경색은 접근성 상태 유지).

| 구분 | 표시 |
|---|---|
| 시드 논문 | 검은색 두꺼운 테두리 (3px) |
| 사용자가 다운로드한 논문 | 보라색 테두리 (2px) |
| 둘 다 해당 | 검은색 + 보라색 이중 테두리 |

**기타 규칙**

| 속성 | 시각화 |
|---|---|
| 노드 크기 | 인용 수에 비례 (최소 4px ~ 최대 30px) |
| 엣지 색상 | cites(실선 파랑) / cited_by(점선 초록) |
| 호버 시 | 제목 + 연도 + 저자명 + 접근성 상태 툴팁 |
| 클릭 시 | 우측 패널에 상세 메타데이터 + 다운로드 진입점 |
| 드래그 | 노드 위치 고정 (force simulation 가속도 줌) |
| 휠 | 줌 인/아웃 |
| 더블클릭 | 노드 위치 완전 고정 |
| 우클릭 | 컨텍스트 메뉴 (이 노드로 새 네트워크 만들기) |

**범례 (UI 상단 고정)**

```
🟢 다운로드 가능  🟡 부분 가능 (preprint 등)  🔴 유료만
⬛ 시드  🟣 다운로드 이력
```

### 7.3 인터랙션

- 노드 위에 마우스를 올리면 인접 노드만 강조 표시 (나머지는 흐리게)
- 깊이(depth) 슬라이더로 1~3 단계까지 확장 (기본값 1)
- "내가 다운로드한 논문만 표시" 토글
- 노드 우클릭 → "이 논문으로 새 네트워크 만들기" (새 시드로)

### 7.4 반응형

| 화면 | 동작 |
|---|---|
| 데스크탑 (1024px 이상) | 풀 사이즈 그래프 + 우측 상세 패널 |
| 태블릿 (768~1024px) | 그래프 풀폭, 상세 패널은 하단 슬라이드업 |
| 모바일 (768px 미만) | 그래프만 표시, 노드 탭 시 전체 화면 상세 페이지로 이동 |

### 7.5 접근성

- 노드는 키보드 탐색 가능 (Tab 키로 포커스 이동)
- 색맹 대응: 색상뿐 아니라 노드 모양으로도 구분 (시드=별표, 인용=원, 참조=사각형)
- 모든 인터랙션에 적절한 aria-label 부여

---

## 8. 성능 및 캐싱 전략

### 8.1 OpenAlex API 비용

| 작업 | OpenAlex 호출 수 | 비고 |
|---|---|---|
| 단일 논문 메타데이터 | 1 | 캐시 시 0 |
| depth=1, 방향 both | 3 | 시드 + 인용 + 참조 |
| depth=2, 방향 both | 7 | 시드 1 + depth1 양방향 2 + depth2 양방향 4 |
| depth=3, 방향 both | 15 | 기하급수적 증가 |

- **기본값 depth=1**로 비용 통제
- depth=2 이상은 사용자가 명시적으로 선택 시에만 (캐싱으로 절감)
- maxNodes 기본 200, 최대 500 (UI 성능 보호)

### 8.2 캐싱 정책

| 데이터 종류 | TTL | 저장소 | 키 |
|---|---|---|---|
| OpenAlex 단일 work 메타데이터 | 30일 | citation_cache | `work:W{id}` 또는 `work:doi:{doi}` |
| 인용 네트워크 (depth=1) | 1시간 | citation_cache | `network:{doi_hash}:depth:1:dir:both` |
| 인용 네트워크 (depth=2) | 6시간 | citation_cache | `network:{doi_hash}:depth:2:dir:both` |
| 사용자가 만든 네트워크 스냅샷 | 영구 | citation_networks | user_id |

### 8.3 응답 시간 목표

| 시나리오 | 목표 | 비고 |
|---|---|---|
| 캐시 히트 | 200ms 이내 | DB 조회만 |
| 캐시 미스 (depth=1) | 3초 이내 | OpenAlex 3회 호출 |
| 캐시 미스 (depth=2) | 8초 이내 | OpenAlex 7회 호출 |
| 그래프 렌더링 (200 노드) | 1초 이내 | D3 force simulation |
| 그래프 렌더링 (500 노드) | 3초 이내 | 동일 |

### 8.4 Rate Limit

- OpenAlex 호출: 분당 30회 (백엔드 메모리 카운터)
- 사용자별 인용 네트워크 요청: 시간당 60회 (기존 rate-limit 미들웨어 활용)

### 8.5 비용 시뮬레이션

OpenAlex 무료 한도(일 1달러) 내에서 가능한 사용 패턴을 시뮬레이션한다. OpenAlex는 엔드포인트마다 비용이 다른데, 인용 네트워크용은 작업당 평균 1~2 cent로 가정한다.

| 시나리오 | 일일 사용자 수 | 사용자당 요청 수 | 총 호출 | 추정 비용 | 한도 내 |
|---|---|---|---|---|---|
| 출시 직후 (베타) | 50 | 3 | 150 | 0.30달러 | OK |
| 정식 출시 1개월 | 200 | 5 | 1,000 | 2.00달러 | **초과** |
| 정식 출시 3개월 (목표) | 500 | 8 | 4,000 | 8.00달러 | **초과** |
| 캐시 히트율 60% 적용 | 500 | 8 | 1,600 (실제) | 3.20달러 | **초과** |
| 캐시 히트율 80% 적용 | 500 | 8 | 800 (실제) | 1.60달러 | OK |

**대응**

- 캐시 히트율 80% 달성이 비용 통제의 핵심
- 인기 논문(논문 인용 수 상위 1만 개)을 사전 캐시 (워머) → 즉시 히트
- 사용자당 일일 한도(예: 20회)를 백엔드에 강제
- 한도 도달 시 신규 네트워크 생성 대신 캐시된 변형만 반환

### 8.6 클라이언트 측 성능 최적화

D3 force simulation은 500 노드까지는 부드럽지만, 그 이상은 끊김이 발생한다. 다음 최적화 기법을 적용한다.

**그래프 렌더링 최적화**

| 기법 | 효과 | 적용 시점 |
|---|---|---|
| `alphaDecay` 0.05 → 0.1 | 시뮬레이션 수렴 2배 빠름 | 노드 > 100일 때 |
| `velocityDecay` 0.4 | 노드 정지 빠르게 | 노드 > 200일 때 |
| 엣지 단순화 (직선) | 렌더 비용 30% 감소 | 모든 경우 |
| 노드 > 200일 때 라벨 숨김 | 텍스트 렌더 비용 제거 | 줌 레벨에 따라 |
| 줌 레벨 0.5 미만 시 엣지 투명도 0.2 | 시각적 노이즈 감소 | 자동 |
| Web Worker로 force 계산 분리 | 메인 스레드 블로킹 제거 | 노드 > 300일 때 |

**메모리 관리**

- TanStack Query의 `gcTime`을 30분으로 설정 → 사용자가 떠난 후 메모리 해제
- 노드 디테일 패널은 닫힐 때 fetch 결과 메모리 해제
- force simulation은 컴포넌트 언마운트 시 `simulation.stop()` 호출

**번들 크기**

- D3.js 전체 import (90KB) 대신 필요한 모듈만 import: `d3-force`, `d3-selection`, `d3-zoom`, `d3-drag` → 약 40KB
- 트리 쉐이킹 활성화 (Vite 기본)

### 8.7 백엔드 캐시 워머 전략

단순 캐시만으로는 일 1달러 한도를 넘길 수 있다. 인기 논문을 사전 캐시해서 히트율을 끌어올린다.

**워머 대상 선정**

- OpenAlex의 `cited_by_count` 상위 1만 개 논문 (전체 인용 100만 회 이상)
- ScholarLink 자체 DB에서 다운로드 빈도 상위 1천 개
- KCI(한국 학술지) 상위 5백 개

**워머 실행 주기**

- `node-cron`으로 매일 새벽 3시(KST) 실행
- 상위 100개씩 순차 처리 (분당 30회 rate limit 준수)
- depth=1 양방향 + 시드 메타데이터만 캐시 (depth=2는 사용자 요청 시)

**워머 실패 대응**

- OpenAlex 5xx 응답 시 exponential backoff (1초 → 2초 → 4초)
- 한 워머 세션에서 10회 연속 실패 시 다음 날로 연기
- 워머 결과를 일일 리포트로 Slack/이메일 발송

**예상 효과**

- 출시 3개월 시점에 워머가 1만 개 논문 캐시 → 사용자 요청의 40%가 즉시 히트
- 종합 히트율 80% 달성 → 8.5 표의 비용 시나리오 OK

---

## 9. 보안 및 개인정보

### 9.1 API 키 관리

- OpenAlex API 키는 환경변수 `OPENALEX_API_KEY`에 저장
- 기존 `encryptionService`로 DB 저장 시 암호화
- 클라이언트에는 절대 노출하지 않음 (백엔드 프록시)

### 9.2 데이터 검증

- DOI 입력 시 정규식 검증 (Zod 스키마)
- depth, maxNodes 등 숫자 파라미터는 정수 범위 검증
- SQL Injection 방어 (Parameterized Query)

### 9.3 저작권

- OpenAlex 데이터는 CC0 라이선스 → 표시 의무 없음
- 클라이언트에 OpenAlex 출처 표시는 옵션 (푸터에 "Data from OpenAlex")

### 9.4 약관 준수

- OpenAlex는 일 1달러 상당의 무료 호출 허용
- 이 한도 초과 시 graceful degradation (캐시된 데이터 우선 반환 + 경고 메시지)
- 상업적 사용 가능 (OpenAlex는 CC0)

### 9.5 약관 및 컴플라이언스 상세

**OpenAlex Terms of Service 요약**

| 항목 | 내용 |
|---|---|
| 라이선스 | CC0 (Public Domain) |
| 인증 | API 키 1개당 일 1달러 분량 무료, 초과 시 응답 429 |
| 데이터 재배포 | 허용 (표시 의무 없음) |
| 상업적 사용 | 허용 |
| 크롤링 | 스냅샷 다운로드 가능 (분기별 갱신) |
| 금지 행위 | 대량 병렬 호출, 인증 키 공유 |

**준수 체크리스트**

- [x] 모든 요청에 `mailto=` 파라미터로 연락처 포함
- [x] 인증 키를 환경변수로 관리, 코드에 하드코딩 금지
- [x] 백엔드 프록시 사용 (클라이언트 IP 노출 안 함)
- [x] 푸터에 "Data from OpenAlex" 표기
- [x] 일일 호출 수 모니터링 + 한도 도달 시 자동 알림

**개인정보 (GDPR/PIPA) 고려**

- OpenAlex에서 받은 데이터는 **공개 학술 메타데이터**만 포함 (개인 식별 정보 없음)
- 사용자별 인용 네트워크는 `citation_networks` 테이블에 저장되며, 사용자 삭제 요청 시 cascade로 함께 삭제
- OpenAlex의 `mailto=` 파라미터에는 서비스 공식 이메일 사용 (사용자 이메일 아님)

**책임 제한**

- OpenAlex 데이터의 정확성/완전성은 OpenAlex 측 보장 사항
- ScholarLink는 "as-is"로 제공, 데이터 오류로 인한 인용 누락에 대해 책임지지 않음
- UI에 "데이터 출처: OpenAlex (CC0)" 명시

---

## 10. 개발 일정

총 4주 (1인 풀스택 기준)

| 주차 | 작업 | 산출물 |
|---|---|---|
| **1주차** | OpenAlex API 클라이언트 작성, citation_cache 테이블 마이그레이션, 백엔드 API 골격 | `openAlexService.ts`, `citationGraphService.ts`, `/citations/network` 엔드포인트 |
| **2주차** | D3 force-directed 그래프 컴포넌트, 단일 시드 시각화, 노드 클릭 인터랙션 | `CitationGraph.tsx`, `/network/:doi` 페이지 |
| **3주차** | 키워드 검색 결과 묶음 시각화, 다운로드 이력 통합, 우측 상세 패널, PNG/CSV 내보내기 | `CollectionNetwork.tsx`, `NodeDetailPanel.tsx` |
| **4주차** | 반응형/접근성, 캐싱 최적화, 헬스체크, 에러 핸들링, QA | 모바일 대응, aria-label, OpenAlex 상태 모니터링 |

### 마일스톤

- M1 (1주차 끝): 백엔드 API 동작 + Postman/curl 테스트 통과
- M2 (2주차 끝): 프론트에서 단일 DOI 인용 네트워크 시각화
- M3 (3주차 끝): 모든 사용자 시나리오 (A/B/C) 동작
- M4 (4주차 끝): 배포 가능 상태, Render + GitHub Pages 반영

### 10.5 백엔드 캐시 워머 구현 일정

| 주차 | 작업 |
|---|---|
| 1주차 | citation_cache 테이블 + 기본 캐시 로직 |
| 2주차 | 인기 논문 선정 로직 (OpenAlex 상위 + ScholarLink 다운로드 빈도) |
| 3주차 | cron job + rate limit 준수 + 실패 재시도 |
| 4주차 | 일일 리포트 + Slack/이메일 알림 |

---

## 11. 성공 지표 (KPI)

| 지표 | 목표 (출시 1개월 후) | 측정 방법 |
|---|---|---|
| 기능 사용률 | 다운로드 사용자 중 월 20% 이상 1회 이상 사용 | citation_networks 테이블 + 로그 |
| 평균 depth | 1.2 이상 (사용자가 깊이 확장을 시도) | 요청 메트릭 |
| 평균 노드 수 | 80개 이상 (실제 의미 있는 네트워크) | 응답 데이터 |
| 재방문률 | 인용 네트워크 사용자의 30% 이상 7일 내 재방문 | GA 또는 자체 로그 |
| API 비용 | 일 1달러 한도 내 유지 | OpenAlex 대시보드 |

---

## 12. 리스크 및 대응

| 리스크 | 영향 | 가능성 | 대응 |
|---|---|---|---|
| OpenAlex API 응답 지연 (10초+) | 사용자 경험 저하 | 중간 | 5초 타임아웃, 캐시된 데이터 fallback, 로딩 스피너 |
| 5,000 노드 이상 시 D3 성능 저하 | 브라우저 멈춤 | 낮음 | maxNodes=500 상한, 깊이 확장 시 경고 |
| OpenAlex 데이터 부정확 (DOI 매칭 실패) | 잘못된 네트워크 | 중간 | 응답 검증, 매칭 실패 시 graceful error |
| 일 1달러 호출 한도 초과 | 신규 네트워크 생성 불가 | 낮음 | 캐싱 적극 활용, 한도 도달 시 큐에 쌓아 순차 처리 |
| 모바일 터치 인터랙션 미흡 | 모바일 사용성 저하 | 중간 | d3-zoom + d3-drag의 터치 핸들러 직접 구현 |
| OpenAlex API 변경 (필드명/엔드포인트) | 서비스 중단 | 낮음 | OpenAlex 버전 필드 사용, 통합 테스트로 사전 감지 |
| 사용자가 막대한 인용 네트워크 요청 (depth=3, max=500) | 비용 폭증, 응답 지연 | 낮음 | rate limit 강화, 큐 시스템 도입 검토 |

### 12.1 장애 대응 플레이북

**시나리오 A: OpenAlex API 다운 (5xx 또는 타임아웃 30초+)**

| 단계 | 동작 |
|---|---|
| 감지 | 1분 내 5회 이상 5xx → 자동 알림 발송 |
| 즉시 대응 | 모든 신규 요청에 stale 캐시 반환 (cache-control: stale-if-error=86400) |
| 사용자 안내 | 토스트: "OpenAlex 일시 장애로 일부 데이터가 최신이 아닐 수 있어요" |
| 복구 후 | 백그라운드 워커가 실패한 요청을 재시도 (3회까지) |
| SLA | 95% 요청은 5분 내 stale 데이터라도 응답, 5%는 503 |

**시나리오 B: OpenAlex 응답 지연 (3~10초)**

| 단계 | 동작 |
|---|---|
| 감지 | 응답 시간 3초 초과 비율 50% 이상 |
| 즉시 대응 | maxNodes를 일시적으로 100으로 축소 |
| 백그라운드 | 캐시 워머 일시 중단 (트래픽 보호) |
| 사용자 안내 | 로딩 스피너 + 예상 시간 표시 |
| 복구 | 5분 단위로 정상 응답 확인, maxNodes 복원 |

**시나리오 C: OpenAlex 무료 한도 초과 (429)**

| 단계 | 동작 |
|---|---|
| 감지 | 응답에 `Retry-After` 헤더 포함 |
| 즉시 대응 | 그날은 신규 네트워크 생성 차단, 캐시된 것만 제공 |
| 사용자 안내 | "오늘의 OpenAlex 호출 한도에 도달했어요. 내일 다시 시도해주세요." |
| 다음 날 0시(KST) | 자동으로 정상 모드 복귀 |
| 장기 대응 | 8.5의 비용 시뮬대로 캐시 워머 + 일일 한도 강화 |

**시나리오 D: citation_cache 테이블 폭증 (디스크)**

| 단계 | 동작 |
|---|---|
| 감지 | 30일 경과 엔트리 누적 → 자동 정리 작업 |
| 즉시 대응 | 매일 새벽 4시(KST) `expires_at < NOW()` 삭제 |
| 모니터링 | 테이블 크기 일일 추이 + 1GB 도달 시 알림 |
| 백업 | 캐시 데이터는 백업 대상 아님 (재생성 가능) |

**시나리오 E: D3.js force simulation 브라우저 멈춤 (사용자 측)**

| 단계 | 동작 |
|---|---|
| 감지 | 컴포넌트 마운트 후 10초 안에 force 안정화 안 됨 |
| 즉시 대응 | `simulation.stop()` 호출, 정적 레이아웃(fallback)으로 전환 |
| 사용자 안내 | "그래프가 복잡해서 정적 뷰로 표시해요" + "단순화" 버튼 |
| 백엔드 | 다음 요청에서 자동으로 maxNodes 축소 제안 |

---

---

## 15. 테스트 전략

### 15.1 유닛 테스트 (Jest + ts-jest)

**백엔드 — openAlexService.ts**

| 시나리오 | 검증 항목 | 모킹 대상 |
|---|---|---|
| OpenAlex 단일 work 정상 응답 | `normalizeWork`가 올바른 Node 반환 | OpenAlex API |
| OpenAlex 404 응답 | null 반환 + 에러 로그 | OpenAlex API |
| OpenAlex 500 응답 | 3회 재시도 후 예외 throw | OpenAlex API |
| OpenAlex 응답 지연 (5초) | 5초 타임아웃 후 에러 | OpenAlex API |
| DOI 형식 오류 입력 | Zod 검증 실패 → 400 반환 | (모킹 불필요) |
| OpenAlex ID 추출 | `https://openalex.org/W123` → `W123` | (모킹 불필요) |
| 저자 3명 초과 시 "et al." 처리 | 정확히 4번째부터 "et al." | (모킹 불필요) |

**백엔드 — citationGraphService.ts**

| 시나리오 | 검증 항목 | 모킹 대상 |
|---|---|---|
| 캐시 히트 | OpenAlex 호출 0회, 캐시에서 반환 | DB + OpenAlex |
| 캐시 미스 (depth=1) | OpenAlex 3회 호출, 캐시 저장 | DB + OpenAlex |
| depth=2 재귀 | depth1 노드마다 양방향 1회씩 추가 호출 | DB + OpenAlex |
| 엣지 중복 제거 | 동일 source-target-type 한 번만 | DB + OpenAlex |
| maxNodes 초과 시 절단 | 200개 초과 시 점수순으로 자름 | DB + OpenAlex |
| 고아 노드 제거 | 시드와 연결 없는 노드 제외 | DB + OpenAlex |

**프론트 — CitationGraph.tsx**

| 시나리오 | 검증 항목 |
|---|---|
| 노드 0개 렌더링 | 빈 그래프 + "데이터 없음" 메시지 |
| 노드 1개 렌더링 | 단일 노드 + "관련 논문 없음" 안내 |
| 노드 200개 렌더링 | 1초 이내 렌더링, force 안정화 |
| 노드 500개 렌더링 | 3초 이내 렌더링, 부분 라벨 표시 |
| 노드 클릭 | 우측 패널 열림 + 메타데이터 표시 |
| 노드 호버 | 인접 노드 강조 + 툴팁 표시 |
| 깊이 슬라이더 변경 | 새 depth로 재요청 + 그래프 갱신 |
| "PNG 저장" 클릭 | PNG 파일 다운로드 |
| "CSV 내보내기" 클릭 | CSV 파일 다운로드 |

### 15.2 통합 테스트 (Supertest)

**API 엔드포인트**

| 엔드포인트 | 시나리오 | 예상 응답 |
|---|---|---|
| `POST /api/v1/citations/network` | 유효 DOI + depth=1 | 200 + 노드/엣지 |
| `POST /api/v1/citations/network` | 잘못된 DOI 형식 | 400 + `Invalid DOI format` |
| `POST /api/v1/citations/network` | OpenAlex에 없는 DOI | 404 + `Paper not found` |
| `POST /api/v1/citations/network` | OpenAlex 타임아웃 | 502 + `OpenAlex API timeout` |
| `POST /api/v1/citations/network` | 캐시 히트 | 200 + `X-Cache: HIT` 헤더 |
| `GET /api/v1/citations/node/:id` | 유효 OpenAlex ID | 200 + 노드 디테일 |
| `GET /api/v1/citations/node/:id` | 잘못된 ID 형식 | 400 + 검증 에러 |
| `GET /api/v1/citations/health` | OpenAlex 정상 | 200 + status: healthy |
| `GET /api/v1/citations/health` | OpenAlex 다운 | 503 + status: unhealthy |

**인증 통합**

- 비로그인 사용자: 네트워크 생성 가능, 단 citation_networks 저장은 불가
- 로그인 사용자: 네트워크 저장/공유 가능
- JWT 만료: 401 + 로그인 페이지로 리다이렉트

### 15.3 E2E 테스트 (Playwright)

**시나리오 A — 단일 DOI에서 인용 네트워크**

1. 메인 페이지 접속
2. DOI `10.1038/s41586-020-2649-2` 입력
3. 검색 결과에서 "인용 네트워크 보기" 클릭
4. 그래프 페이지 로드 대기 (3초 이내)
5. 노드 50개 이상 렌더링 확인
6. 시드 노드(파란색) 존재 확인
7. 노드 1개 클릭 → 우측 패널에 메타데이터 표시
8. "PDF 다운로드" 버튼 클릭 → 다운로드 시작 확인

**시나리오 B — 키워드 검색 묶음**

1. 검색바에 "machine learning" 입력
2. 결과 중 5개 선택 (체크박스)
3. "이 묶음의 인용 네트워크 보기" 클릭
4. 그래프 페이지 로드
5. 선택한 5개 논문이 시드(파란색)로 표시
6. 시드 간 인용 관계가 엣지로 표시되는지 확인

**시나리오 C — 에러 처리**

1. 존재하지 않는 DOI `10.9999/invalid-doi` 입력
2. "인용 네트워크 보기" 클릭
3. "Paper not found" 에러 메시지 표시 확인
4. 재시도 버튼 클릭 가능 확인

**시나리오 D — 반응형**

1. 브라우저 뷰포트를 375x667 (모바일)로 변경
2. 그래프 페이지 진입
3. 그래프가 풀폭으로 표시되는지 확인
4. 노드 탭 시 전체 화면 디테일 페이지로 이동 확인

### 15.4 성능 테스트 (k6)

**로드 테스트 시나리오**

```javascript
// 100명이 동시에 1분간 depth=1 요청
export const options = {
  vus: 100,
  duration: '60s',
  thresholds: {
    'http_req_duration{name:citation_network}': ['p(95)<3000'],
    http_req_failed: ['rate<0.05'],
  },
};
```

**검증 항목**

- p95 응답 시간 < 3초 (캐시 히트 200ms, 미스 3초)
- 에러율 < 5%
- 동시 사용자 100명까지 안정 (Render Free Tier: 0.1 CPU, 512MB)
- 캐시 워머 실행 중에도 응답 지연 없음

### 15.5 회귀 테스트 자동화

- GitHub Actions에서 main 브랜치 push 시 자동 실행
- 유닛 + 통합 + E2E 풀 스위트: 약 8분
- PR마다 실행: 유닛 + 통합만 (3분)
- main 머지 전: 풀 스위트 + 성능 스모크 테스트

---

## 16. 모니터링 및 알림

### 16.1 핵심 메트릭

**비즈니스 메트릭**

| 메트릭 | 측정 방법 | 목표 |
|---|---|---|
| 일일 인용 네트워크 생성 수 | API 카운터 | 출시 1개월 100건/일 |
| 일일 활성 사용자 (DAU) | 로그 분석 | 출시 1개월 50명 |
| 평균 depth | 요청 메트릭 | 1.2 이상 |
| 평균 노드 수 | 응답 데이터 | 80개 이상 |
| 재방문률 (7일) | 사용자 행동 로그 | 30% 이상 |

**기술 메트릭**

| 메트릭 | 측정 방법 | 임계값 |
|---|---|---|
| OpenAlex API 응답 시간 p95 | 로그 | 3초 초과 시 경고 |
| OpenAlex API 에러율 | 로그 | 5% 초과 시 경고 |
| 캐시 히트율 | 캐시 키 카운터 | 60% 미만 시 경고 |
| citation_cache 테이블 크기 | DB | 1GB 도달 시 경고 |
| OpenAlex 무료 한도 사용량 | OpenAlex 대시보드 | 80% 도달 시 경고 |
| Render 메모리 사용량 | Render 대시보드 | 400MB 초과 시 경고 |
| D3 force 안정화 시간 (클라이언트) | Performance API | 5초 초과 시 경고 |

### 16.2 대시보드

**Grafana / Render 대시보드 (선택)**

- 인용 네트워크 요청 그래프 (시간당)
- OpenAlex 응답 시간 히트맵
- 캐시 히트율 게이지
- 에러율 그래프
- DB 캐시 테이블 크기 추이

**자체 간단 대시보드 (v1, 최소 구현)**

- Admin 페이지에 인용 네트워크 사용 통계 탭 추가
- 일일/주간/월간 차트
- 인기 논문 Top 20

### 16.3 알림 규칙

| 상황 | 채널 | 대상 |
|---|---|---|
| OpenAlex 5xx 비율 10% 초과 (5분) | Slack + 이메일 | 개발자 |
| OpenAlex 무료 한도 80% 도달 | Slack | 개발자 |
| Render 메모리 90% 도달 | Render 내장 알림 | 개발자 |
| 인용 네트워크 응답 시간 p95 5초 초과 (10분) | Slack | 개발자 |
| citation_cache 테이블 2GB 도달 | 이메일 | 개발자 |
| 매일 새벽 워머 실패 | Slack | 개발자 |
| 배포 후 1시간 내 에러율 5% 초과 | Slack + 이메일 | 개발자 |

### 16.4 로그 정책

- OpenAlex 요청/응답은 **메타데이터만** 로깅 (제목/저자 X, 응답 시간/상태/ID만)
- 사용자 DOI/검색어는 로깅 가능 (개인 식별 정보 아님)
- 30일 경과 로그는 일일 정리
- 에러 로그는 90일 보관 (디버깅용)

---

## 17. OA 환경 기반 인사이트 전략

### 17.1 OA 비율 현황 (2026년 기준)

OpenAlex의 인덱싱 현황과 글로벌 OA 트렌드를 근거로 한다.

| 지표 | 수치 | 출처 |
|---|---|---|
| OpenAlex 인덱스 전체 | 3.17억 개 | openalex.org |
| OpenAlex 풀텍스트 PDF | 6천만 개 (약 19%) | openalex.org |
| 글로벌 OA 논문 비율 (2023) | 59% | pulse49.com / OpenAlex |
| 글로벌 OA 논문 비율 (2024) | 47% | pulse49.com / OpenAlex |
| 금색 OA 성장 (2014→2024) | 14% → 40% | STM Association |
| 다이어몬드 OA 저널 비중 (Global South) | 84.2% | MIT QSS |
| 분야별 OA 비율 (CS) | 60% 이상 | 분야별 편차 |
| 분야별 OA 비율 (의학/생명과학) | 20~30% | 분야별 편차 |

**핵심 인사이트**

- 글로벌 OA 논문은 이미 과반수에 근접
- OpenAlex 6천만 개 풀텍스트 + arXiv/bioRxiv 등 preprint + Unpaywall OA 위치 = ScholarLink가 활용 가능한 원문 풀이 **1억 건 이상**
- 인용 네트워크의 **절반 이상이 ScholarLink로 즉시 다운로드 가능**

### 17.2 v1 핵심 인사이트 (OA 환경 최적화)

OA가 다수인 환경을 활용해, **다운로드 가능한 인사이트**를 우선 제공한다.

**인사이트 A: 다운로드 우선순위 큐레이션**

시드 논문 1편을 입력하면, 인용 네트워크 중 ScholarLink로 다운로드 가능한 노드만 골라 읽기 순서를 추천한다.

- 1단계: 시드 논문과 직접 연결된 OA 논문 3~5편
- 2단계: 시드의 핵심 인용 중 OA 비율이 높은 하위 분야
- 3단계: 가장 영향력 큰(PageRank 상위) OA 논문

각 단계에 "왜 이걸 먼저 읽어야 하는지" 한 줄 설명을 붙인다.

> 가치: 박사 과정 첫 학기 literature review 가이드. 모두 무료로 즉시 다운로드 가능하므로 사용자가 바로 활용할 수 있다.

**인사이트 B: "다운로드 가능한 분야" 메트릭**

네트워크 상단에 작은 배지를 표시한다.

```
이 인용 네트워크의 60%는 지금 바로 다운로드할 수 있어요 (15/25편)
```

분야별 편차가 크므로, 이 메트릭이 높으면 그 분야는 **OA 친화 분야**임을 안내한다. 반대로 낮으면 "이 분야는 유료가 많으니 인접 OA 분야도 함께 보세요" 안내.

**인사이트 C: "OA 친화 인접 분야" 점프**

시드 분야와 인접하지만 OA 비율이 70% 이상인 분야를 자동으로 찾는다.

- CS 분야 시드 → arXiv 중심의 인접 분야 추천
- 의학 분야 시드 → bioRxiv preprint가 풍부한 인접 분야 추천
- 사회과학 분야 시드 → SSRN/제출본 중심 인접 분야 추천

> 가치: 유료가 많은 분야에 갇히지 않고, 비슷한 주제를 OA로 풀 수 있는 인접 영역으로 자연스럽게 확장

**인사이트 D: PageRank 기반 권위 논문 식별 (OA/유료 무관)**

OA 비율과 무관하게, 네트워크 내 위치로 진짜 권위 논문을 가린다. 시각적으로 강조하고, 다운로드 가능 여부에 따라 액션 버튼이 달라진다.

- OA 권위 논문 → "다운로드" 버튼
- 유료 권위 논문 → "DOI로 출판사 페이지 열기" + "Preprint 찾아보기" 버튼

> 가치: "이 분야를 정의한 논문"을 직관적으로 발견. OA든 유료든 상관없이.

### 17.3 v1.5 확장 인사이트

**인사이트 E: 분야별 OA 트렌드**

5년치 인용 네트워크를 연도별 슬라이더로 재생. 각 시점에서 OA 비율과 주요 논문이 어떻게 변했는지 추적.

- "이 분야는 2020년 이후 OA 비율이 급격히 상승했습니다"
- "이 저자는 최근 3년간 모두 OA로 발표합니다"

**인사이트 F: 저자별 OA 발표 성향**

특정 저자가 얼마나 자주 OA로 발표하는지 (gold OA 비율 + preprint 활용도). "이 저자는 OA 친화적입니다" 배지.

**인사이트 G: KCI(한국 학술지) 인용 네트워크**

v1.5에서 KCI 별도 인덱스 연동. 한국 학술지의 인용 관계는 OpenAlex에 일부 포함되어 있으나, KCI는 별도 API 제공. 한국어 검색/시각화는 ScholarLink의 차별점.

### 17.4 v2 이상 인사이트 (수익 모델과 연결)

**인사이트 H: 기관 구독자 전용 — "내 기관에서 받을 수 있는 논문"**

기관 라이브러리 구독자에게는 "이 DOI는 우리 기관에서 무료로 받을 수 있어요" 자동 안내. 일반 사용자에게는 "월 9달러 Pro 플랜으로 preprint 무제한 + AI 요약" 안내.

**인사이트 I: 내 논문 인용 분석 (연구자 본인용)**

로그인 사용자가 본인이 쓴 논문을 등록하면, 누가 어떻게 인용했는지 분석. ScholarLink를 학술 SNS로 확장하는 기반.

### 17.5 접근성 상태별 UX (상세)

| 상태 | 노드 색 | 노드 모양 | 디테일 패널 액션 | 우선순위 |
|---|---|---|---|---|
| `downloadable` | 초록 | 원 | "PDF 다운로드" 버튼 (주 행동) | 큐레이션 1순위 |
| `partial` | 노랑 | 다이아몬드 | "Preprint 받기" + "출판사 페이지" 버튼 | 큐레이션 2순위 |
| `paid_only` | 빨강 | 사각형 | "DOI로 출판사 열기" + "기관 로그인 안내" + "Preprint 찾아보기" 버튼 | 정보 제공용 |

**`partial` 노드의 preprint 자동 매칭**

OpenAlex 응답의 `best_oa_location` 필드와 `locations` 배열을 활용해:

1. `pmc`, `arxiv`, `biorxiv`, `ssrn`, `repository` 등 OA 위치 자동 식별
2. `pdf_url`이 있으면 즉시 다운로드 제공
3. 없으면 HTML 페이지 링크 (사용자가 직접 찾을 수 있도록)

매칭 실패 시 `partial`에서 `paid_only`로 강등하지 않고, "Preprint을 직접 찾아볼게요" 보조 검색 버튼 제공.

### 17.6 기존 인용 네트워크 서비스와의 차별점

| 서비스 | OA 비율 표시 | Preprint 자동 연결 | 다운로드 즉시 연결 |
|---|---|---|---|
| Connected Papers | ❌ | ❌ | ❌ (외부 링크만) |
| ResearchRabbit | ❌ | 부분 | ❌ |
| Litmaps | ❌ | ❌ | ❌ |
| **ScholarLink v1** | **✅ 배지 표시** | **✅ 자동 매칭** | **✅ 즉시 다운로드** |

> 가치: 기존 서비스는 인용 관계를 "보여주기"만 함. ScholarLink는 **"보여주고 바로 받기"**까지 제공.

### 17.7 한계와 솔직한 포지셔닝

ScholarLink는 **모든 논문을 받을 수는 없다**. 이 한계를 솔직하게 인정하면서, 다음 포지셔닝으로 사용자에게 가치를 전달한다.

- **"받을 수 있는 것은 바로 받을 수 있게"** — OA 환경 최적화
- **"받을 수 없는 것은 정확히 안내"** — 출판사/저자/기관 경로
- **"받을 수 있는 인접 영역으로 안내"** — OA 친화 분야 점프

> 이 한계를 숨기지 않고 명시함으로써, 사용자는 ScholarLink를 **"정직한 학술 도구"**로 인식하게 된다. 장기적으로 브랜드 신뢰도에 기여.

---

## 13. 향후 확장 (v1.1 이후)

| 기능 | 설명 |
|---|---|
| 네트워크 저장 및 공유 | 사용자가 만든 네트워크를 URL로 공유 (v1.5) |
| 공동 인용 네트워크 | 두 논문을 함께 인용한 논문들 (co-citation) |
| 시간축 애니메이션 | 연도별로 네트워크 진화 과정 시각화 |
| AI 요약 통합 | 시드 논문과 직접 연결된 논문들의 AI 요약을 사이드 패널에 표시 |
| BibTeX 내보내기 | 그래프의 노드들을 BibTeX 파일로 내보내기 |
| 다중 시드 | 한 번에 여러 DOI를 시드로 사용 (이미 데이터 구조는 지원) |
| 한국 학술지 인용 색인(KCI) 통합 | 국내 학술지의 인용 관계 추가 |

---

## 14. 참고 자료

- OpenAlex 공식 문서: https://docs.openalex.org
- D3.js force simulation: https://d3js.org/d3-force
- Connected Papers (경쟁 서비스): https://www.connectedpapers.com
- ResearchRabbit (경쟁 서비스): https://www.researchrabbit.ai
- React + D3 통합 패턴: https://2019.wattenberger.com/blog/react-and-d3
- OpenAlex citation (학술 인용): Priem, Piwowar, Orr (2022). arXiv:2205.01833

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 | 작성자 |
|---|---|---|---|
| 1.0 | 2026-06-23 | 초안 작성 | Mavis |
| 1.1 | 2026-06-23 | OA 환경 기반 인사이트 섹션 추가 (17), 노드 데이터 포맷에 accessStatus/3단계 색상 도입, 5.2/7.2 갱신 | Mavis |
