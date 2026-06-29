# ScholarLink 발표자료용 자료 검색 기능 — 코딩 계획서

- 문서 위치: `D:\SC_link\docs\asset_search_plan.md`
- 작성일: 2026-06-24
- 대상: ScholarLink v1.0+
- 목적: 발표자료에 쓸 **이미지/표/다이어그램 후보를 키워드·DOI·주제로 검색**하고, 각 후보에 **원본 출처(근거 사이트) + 라이선스 + 인용**을 자동 부여한다.
- 본 문서는 *발표자료 자동 생성*이 아니다. 검색·수집·정리가 핵심이다. (생성 기능은 Out of Scope)

---

## 1. 사용자 시나리오

| 시나리오 | 입력 | 결과 |
|---|---|---|
| 키워드 검색 | "광촉매", "graph neural network" | 관련 figure/table 카드 그리드, 라이선스 배지 포함 |
| DOI 직접 | `10.1038/nature12373` 또는 DOI URL | 해당 논문의 figure/table + 원문 페이지 |
| 제목 검색 | "Attention is all you need" | 후보 논문 + 보충 figure (Figshare/OpenAlex) |
| 보조 자료 | "광합성 다이어그램" | Openverse 일반 CC 이미지 + 학술 자료 혼합 |

카드 클릭 시:
- 원본 사이트로 이동 (근거 사이트)
- 인용문 복사 (APA, BibTeX, Vancouver, MLA, Chicago)
- "내 발표자료에 담기" → 사용자 컬렉션 저장

---

## 2. 데이터 소스 조사 결과 (2026-06 기준)

| 소스 | 검색 가능 범위 | 라이선스 정보 | figure URL 직접 제공 | API 키 | 응답 속도 | 안정성 | 비고 |
|---|---|---|---|---|---|---|---|
| Europe PMC | 의생명 OA 전체 + preprint | 명확 (CC-BY, CC0, CC-BY-NC) | 썸네일 URL | 불필요 | 빠름 | ★★★★★ | figure API + figures API 별도 |
| OpenAlex | 전 분야 2억+ works | `open_access.oa_status` | ❌ (DOI만) | User-Agent 메일만 | 보통 | ★★★★★ | OA URL·라이선스 URL 포함 |
| PLOS (Solr) | PLOS 저널 전체 | CC BY 명확 | figure URL 직접 | 불필요 | 빠름 | ★★★★★ | `api.plos.org` 솔라 직접 |
| Springer Nature OA | 260만+ OA | 출판사별 | 풀텍스트 내 figure | 무료 발급 필요 | 보통 | ★★★★ | TDM 약관 동의 |
| Figshare | 전 분야 자료 | 라이선스 명시 | 파일 URL | 불필요 | 보통 | ★★★★ | 기관별 컬렉션 가능 |
| bioRxiv / medRxiv | preprint 전체 | CC-BY/CC-BY-NC/CC0 | ❌ (PDF만) | 불필요 | 빠름 | ★★★★ | HTML 버전 도입 |
| Crossref | 전 분야 메타 | `license.url` 배열 | ❌ | User-Agent 메일만 | 빠름 | ★★★★★ | publisher landing URL |
| Openverse (구 CC Search) | 8억+ 일반 미디어 | CC 명확 | image URL | 불필요 | 보통 | ★★★ | 학술 외 보조용 |
| Citation.js | - | - | - | - | - | - | 인용 생성 (BibTeX/APA/MLA/Vancouver 등 1만+ 스타일) |

### 선정 기준 (ScholarLink 환경에 맞춤)
- **무료 + 키 불필요** 우선 (Render 무료 티어, 외부 의존 최소화)
- **라이선스 자동 부여 가능** (사용자가 출처 표기 부담 없도록)
- **figure URL 직접 제공** 우선 (이미지 카드 즉시 표시)
- **OA 명시** (ScholarLink 다운로더의 가치와 시너지)

---

## 3. 추천 조합 (단계별)

### Phase 1 — MVP (2~3주)
**Europe PMC + OpenAlex + Crossref + Openverse + Citation.js**
- 전부 무료, 키 불필요, 즉시 통합 가능
- Europe PMC: 의생명 figure 직접 + 라이선스
- OpenAlex: 전 분야 검색 + OA URL + concepts(키워드)
- Crossref: 출판사 페이지 링크 + license URL
- Openverse: 발표 보조용 일반 CC 이미지
- Citation.js: 인용문 생성

### Phase 2 — 확장 (1~2주)
**PLOS Solr + Figshare**
- PLOS: 모든 figure 직접 URL (CC BY 확실)
- Figshare: 보충 자료·데이터셋·다이어그램

### Phase 3 — 프리미엄 (1~2주)
**Springer Nature OA API + bioRxiv/medRxiv**
- Springer: 260만+ OA figure·table 직접 (키 발급 필요, 무료)
- bioRxiv/medRxiv: preprint 최신 동향

### Phase 4 — 운영 (1주)
인기 검색어 통계, 다국어 i18n (ko/en), 어드민 페이지 통계 추가

---

## 4. 아키텍처

### 4.1 흐름도
```
[사용자]
  └─ 입력 (키워드/DOI/제목)
     │
     ▼
[프론트 /assets 페이지]
  │  검색바 + 필터(소스, 라이선스, 연도, 종류)
  │
  ▼
[백엔드 GET /api/v1/assets/search]
  ├─ 1) 입력 정규화 (doiParserService 확장)
  ├─ 2) 멀티 소스 병렬 검색 (Promise.allSettled)
  │     ├─ epmcService.search()
  │     ├─ openAlexAssetService.search()   ← citationService 보완
  │     ├─ plosService.search()            (Phase 2)
  │     ├─ figshareService.search()        (Phase 2)
  │     ├─ springerService.search()        (Phase 3)
  │     └─ openverseService.search()
  ├─ 3) 결과 정규화 → Asset 모델 통일
  ├─ 4) 중복 제거 (DOI 기반)
  ├─ 5) 인용문 생성 (citationFormatter + Citation.js)
  ├─ 6) L1 메모리 + L2 DB 캐시
  │
  ▼
[JSON 응답]
  { query, total, assets: [...], facets }
```

### 4.2 추가/수정 파일
```
server/src/
  routes/
    assets.ts                       (신규)
  controllers/
    assetController.ts              (신규)
  services/
    assetSearchService.ts           (신규 — 오케스트레이터)
    epmcService.ts                  (신규)
    openAlexAssetService.ts         (신규)
    plosService.ts                  (신규 — Phase 2)
    figshareService.ts              (신규 — Phase 2)
    springerService.ts              (신규 — Phase 3)
    openverseService.ts             (신규)
    citationFormatter.ts            (신규 — Citation.js 래퍼)

client/src/
  pages/
    AssetSearch.tsx                 (신규)
    AssetCollection.tsx             (신규 — 내 북마크)
  components/
    AssetCard.tsx                   (신규)
    AssetFilter.tsx                 (신규)
    LicenseBadge.tsx                (신규)
    CitationModal.tsx               (신규)
  services/
    assetsApi.ts                    (신규)
  i18n/
    dictionary.ts                   (수정 — ko/en 키 추가)

server/src/app.ts                   (수정 — /api/v1/assets 라우트 마운트)
server/src/db/migrate.ts            (수정 — 신규 테이블 마이그레이션)
render.yaml                         (수정 — SPRINGER_API_KEY 환경변수)
```

### 4.3 환경 변수 (render.yaml 추가)
```
SPRINGER_API_KEY    = (Phase 3에서 무료 발급, 미설정 시 해당 소스만 스킵)
```

---

## 5. API 명세

### 5.1 검색
```
GET /api/v1/assets/search
Query:
  q              string   필수. 키워드 / DOI / 제목
  type           enum     figure | table | all     기본 figure
  sources        csv      기본 "epmc,openalex,plos,figshare,openverse"
  license        csv      CC-BY,CC0,CC-BY-SA,CC-BY-NC
  year_from      int      예: 2018
  year_to        int      예: 2026
  limit          int      기본 24, 최대 100
  offset         int      기본 0
  citation_style enum     apa | bibtex | vancouver | mla | chicago   기본 apa

Response:
{
  "query": { "q": "...", "normalized": "...", "isDoi": false },
  "total": 156,
  "assets": [
    {
      "id": "epmc:PMC1234567:fig1",
      "source": "epmc",
      "kind": "figure",
      "title": "Figure 1. Schematic of the catalytic cycle",
      "caption": "...",
      "imageUrl": "https://europepmc.org/articles/PMC.../fig1.jpg",
      "thumbUrl": "https://...",
      "license": { "type": "CC-BY", "url": "https://creativecommons.org/licenses/by/4.0/" },
      "paper": {
        "title": "...",
        "authors": ["Smith J.", "Doe A."],
        "journal": "Nature Catalysis",
        "year": 2024,
        "doi": "10.1038/...",
        "pmid": "12345678",
        "pmcid": "PMC1234567",
        "url": "https://..."
      },
      "citation": {
        "apa": "Smith, J. (2024). Title. Nature Catalysis, 12(3), 45-60.",
        "bibtex": "@article{...}",
        "vancouver": "..."
      },
      "score": 0.92
    }
  ],
  "facets": {
    "sources":  { "epmc": 80, "plos": 50, "figshare": 26 },
    "licenses": { "CC-BY": 120, "CC0": 30, "CC-BY-NC": 6 },
    "years":    { "2024": 50, "2023": 40, "2022": 30 }
  },
  "cached": true,
  "buildTimeMs": 842
}
```

### 5.2 상세
```
GET /api/v1/assets/:source/:externalId
→ 개별 에셋 상세 (캐시 미스 시 원본 fetch)
```

### 5.3 사용자 컬렉션 (로그인 필요)
```
GET    /api/v1/assets/collection
       Query: limit, offset
       → 내 북마크 목록 (최근 담은 순)

POST   /api/v1/assets/collection
       Body: { source, externalId, assetData, note }
       → 추가

DELETE /api/v1/assets/collection/:id
       → 제거
```

---

## 6. DB 스키마

기존 `server/src/db/migrate.ts`에 추가:

```sql
-- 검색 결과 캐시 (24시간 TTL)
CREATE TABLE IF NOT EXISTS asset_search_cache (
  cache_key   TEXT PRIMARY KEY,
  query       TEXT NOT NULL,
  sources     TEXT[] NOT NULL,
  result      JSONB NOT NULL,
  total       INT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_asset_cache_expires ON asset_search_cache(expires_at);

-- 사용자별 에셋 북마크
CREATE TABLE IF NOT EXISTS user_asset_bookmarks (
  id           BIGSERIAL PRIMARY KEY,
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source       TEXT NOT NULL,                  -- 'epmc', 'plos', 'figshare', ...
  external_id  TEXT NOT NULL,                  -- 원본 ID
  asset_data   JSONB NOT NULL,                 -- 검색 응답 스냅샷
  note         TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, source, external_id)
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_recent
  ON user_asset_bookmarks(user_id, created_at DESC);

-- 인기 검색어 (Phase 4, 선택)
CREATE TABLE IF NOT EXISTS asset_search_trending (
  query          TEXT PRIMARY KEY,
  count          INT DEFAULT 1,
  last_searched  TIMESTAMPTZ DEFAULT NOW()
);
```

마이그레이션 실행: `npm run db:migrate:prod --prefix server`

---

## 7. 캐시 전략

| 레이어 | 대상 | TTL | 저장소 |
|---|---|---|---|
| L1 | DOI → 메타·인용 | 1시간 | in-memory `NodeCache` (maxKeys 500) |
| L2 | 검색 결과 | 24시간 | PostgreSQL `asset_search_cache` |
| 영구 | 사용자 북마크 | 무기한 | PostgreSQL `user_asset_bookmarks` |

정리 작업: 기존 cron 또는 `purgeExpiredAssetCache()` 함수로 매일 한 번.

---

## 8. 클라이언트 UX

### 8.1 페이지: `/assets`
- 상단 검색바 (DOI/키워드/제목 자동 감지)
- 좌측 필터: 소스(체크박스), 라이선스(체크박스), 연도 범위(슬라이더), 종류(figure/table)
- 결과 영역: 그리드 3열(데스크탑) / 2열(태블릿) / 1열(모바일)
- 빈 상태: 예시 (DOI, 키워드) + 사용 가이드

### 8.2 카드 구성
- 썸네일 (16:9 또는 원본 비율)
- 라이선스 배지 (CC-BY/CC0/CC-BY-NC 색상 구분)
- 논문 제목, 저널, 연도
- 캡션 한 줄 (truncate)
- 액션: 원문 / 인용 모달 / 담기(하트)

### 8.3 인용 모달
- 탭: APA / BibTeX / Vancouver / MLA / Chicago
- 클립보드 복사 버튼
- 미리보기 (Markdown, HTML)

### 8.4 다국어
기존 `dictionary.ts`에 ko/en 키 추가. 주요 문구:
- 검색, 필터, 라이선스, 연도, 종류, 원문, 인용, 담기, 복사됨

---

## 9. 단계별 구현 로드맵

| 단계 | 기간 | 산출물 | 의존성 |
|---|---|---|---|
| Phase 1: Europe PMC + OpenAlex + Crossref + Openverse + Citation.js | 2~3주 | 검색·상세·인용·북마크 + DB 마이그레이션 + AssetSearch 페이지 + dictionary i18n | render.yaml 변경 없음 |
| Phase 2: PLOS + Figshare | 1~2주 | 소스 확장, figure 직접 접근 강화 | 없음 |
| Phase 3: Springer Nature OA API + bioRxiv/medRxiv | 1~2주 | Springer 키 발급 + 통합 + preprint 풀텍스트 | SPRINGER_API_KEY 발급 |
| Phase 4: 인기 검색어 + 다국어 i18n + 어드민 통계 | 1주 | 운영 인사이트 + 사용자 행동 분석 | Phase 1~3 완료 |

**총 5~8주** (1인 풀타임 기준). ScholarLink 본업 영향 최소화 위해 각 Phase 끝나면 main 브랜치 머지·배포.

---

## 10. 비용 및 리스크

### 10.1 비용
| 항목 | 비용 |
|---|---|
| Europe PMC API | 무료 (키 불필요) |
| OpenAlex API | 무료 (User-Agent 메일) |
| Crossref API | 무료 |
| PLOS Solr | 무료 |
| Figshare API | 무료 |
| Openverse API | 무료 |
| Springer Nature OA API | 무료 (키 발급 필요) |
| bioRxiv/medRxiv | 무료 |
| Citation.js (npm) | 무료 (MIT) |
| Cheerio (HTML 파싱) | 무료 (MIT) |
| Render 서버 트래픽 | 기존 무료 티어 내 수용 (JSON 프록시, 대용량 X) |
| DB 저장 공간 | cache 테이블 추가분 ~수 MB/일, 7일 후 자동 정리 |

**월 추가 비용: 0원**

### 10.2 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| PLOS Solr URL 변경/중단 | 검색 소스 1개 손실 | 어댑터 패턴, 소스별 에러 격리, 멀티 소스로 자연 완화 |
| Europe PMC figure 호스트 변경 | 썸네일 깨짐 | 원본 URL fallback + lazy 검증 |
| Springer API 키 미발급 | Phase 3 지연 | Phase 1·2로도 핵심 기능 동작 가능 |
| 인용 스타일 누락 | UX 저하 | Citation.js 기본 10종 + 커스텀 추가 (CSL 1만+ 스타일) |
| 캐시 폭증 | DB 부담 | L2 TTL 24h + 메모리 L1 + 자동 정리 cron |
| 라이선스 표시 누락 | 저작권 문제 | 모든 응답에 `license` 객체 강제, UI 배지 필수 |
| Openverse 일반 이미지 품질 | 발표 신뢰도 저하 | UI에서 학술/보조 탭 분리, 기본은 학술 우선 |
| 외부 API 장애 | 검색 실패 | 부분 실패 시 동작하는 소스만이라도 응답, 실패 명시 |

### 10.3 법무 검토 (권장 사항)
- **CC-BY**: 저작자 표시 + 라이선스 링크 (UI에 자동 삽입)
- **CC-BY-NC**: 비영리만 허용 (UI 경고 배지)
- **CC-BY-SA**: 동일 라이선스 전파 조건 (UI 경고)
- **CC0 / Public Domain**: 자유 (표시만)
- 발표자료에 사용할 때 저작자 표시 문구를 자동으로 인용 모달에 포함

---

## 11. Out of Scope (별도 검토)
- 자동 PPT/PDF 빌더 (pptxgenjs 등)
- PDF 파싱을 통한 신규 figure 추출 (ScholarLink 기존 다운로더와 별도)
- AI 요약·번역
- 협업 편집 기능

---

## 12. 의사결정 필요 항목 (확인 요청)

다음 항목에 대한 사용자 판단 필요:

- [ ] **Phase 1 범위 확정**: Europe PMC + OpenAlex + Crossref + Openverse 로 시작 OK?
- [ ] **"내 발표자료에 담기" → 신규 페이지** (`/assets/collection`) vs 기존 `/history`/북마크 통합
- [ ] **Openverse(일반 CC 이미지) 포함 vs 제외**: 학술 자료만 우선 vs 보조 자료(다이어그램/인포그래픽)도 포함
- [ ] **커뮤니티 게시글 첨부 기능과의 통합**: 신규 vs 독립 (현재는 독립으로 계획)
- [ ] **인용 기본 스타일**: APA vs Vancouver (생명과학은 Vancouver 선호, 기타는 APA)
- [ ] **관리자 페이지 통계**: Phase 4에 포함 OK?

확인되면 바로 Phase 1 구현 시작.

---

## 13. 참고 자료 (조사 시 사용한 출처)

- Europe PMC API: https://europepmc.org/RestfulWebService
- OpenAlex API: https://developers.openalex.org/
- PLOS API: https://api.plos.org/
- Springer Nature OA API: https://dev.springernature.com/docs/api-endpoints/open-access/
- Figshare API: https://docs.figshare.com/
- bioRxiv API: https://api.biorxiv.org/
- Crossref REST API: https://api.crossref.org/
- Openverse API: https://api.openverse.org/
- Citation.js: https://citation.js.org/
- Wikimedia Commons API: https://commons.wikimedia.org/wiki/Commons:API