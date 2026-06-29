# ScholarLink — OA Mandate Compliance Checker 코딩 계획서

| 항목 | 내용 |
|---|---|
| 문서 버전 | 1.0 |
| 작성일 | 2026-06-29 |
| 대상 저장소 | ScholarLink (`wheeljah/SC_link`) |
| 작성자 | Mavis |
| 상태 | 초안 (구현 전 검토용) |

---

## 1. 개요

### 1.1 배경

ScholarLink는 DOI / PMID / arXiv ID만으로 오픈액세스 학술논문을 통합 검색·다운로드하는 서비스다. 현재는 "논문을 찾는/받는" 행위에 최적화돼 있다.

그러나 글로벌 학술 정책 흐름은 이미 다음 단계로 이동 중이다.

- **cOAlition S / Plan S**: 2018년부터 유럽 주요 펀더(Wellcome, ERC, NIH, UKRI 등)가 "2021년부터 공공자금 논문은 즉시 OA + CC BY" 정책을 시행. 2025년 현재 유럽 평균 OA 의무 준수율은 **60~75%** 수준.
- **OSTI / DOE Public Access Plan 2024**: 미국 에너지성도 Plan S 모델 채택.
- **한국 NRF / 과기정통부**: 2026년 현재까지 **강제 의무화 부재**. 개별 기관(KAIST, 서울대 등)의 자율 권고 수준. 한국 학술논문 OA 비율은 약 **35~45%** 추정 — 글로벌 후발주자.

이 격차를 **데이터로 가시화**하면 세 가지 가치가 생긴다.

1. **연구자**: 내 논문이 내 펀더/기관 정책을 준수하는지 즉시 확인 → 비준수 시 즉시 OA화 가이드
2. **기관/펀더**: 자체 준수율 모니터링 → 미준수 논문 자동 알림
3. **정책 입안자**: "한국이 Plan S를 도입하면 OA 비율이 X% 증가할 것" 같은 데이터 기반 정책 토대

### 1.2 목표

ScholarLink의 **OA Mandate Compliance Checker**는 다음을 한 번에 해결한다.

- 단일 DOI / ORCID / Grant ID 입력 → "이 논문은 귀하의 펀더/기관 OA 정책을 **준수 / 미준수 / 부분 준수 / 판단불가** 중 어디에 해당하는가" 자동 판별
- 글로벌 5대 OA 정책 데이터 소스(Unpaywall, OpenAIRE, Crossref, ROARMAP, Sherpa Juliet) 통합
- **기관/국가/펀더 단위 OA 준수율 리더보드** 제공
- 한국 공공자금 논문 준수율 데이터를 **공개 다운로드**(CSV/JSON)로 제공하여 정책 토론 촉진

### 1.3 범위

**In-scope (v1, 약 6~8주)**

- 단일 DOI 기반 즉시 판별 (1건당 < 5초)
- ORCID 입력 → 해당 연구자 전체 논문 일괄 판별 (최대 200건)
- Grant ID(주로 OpenAIRE 호환 포맷) → 펀딩 논문 일괄 판별
- 펀더 OA 정책 조회 (Sherpa Juliet, ROARMAP)
- 기관 OA 정책 조회 (ROARMAP)
- 한국 NRF·KAIST·서울대 등 주요 기관 사전 등록
- 기관/국가 단위 준수율 리더보드 (익명 집계, 옵트아웃 가능)
- 정책 CSV 다운로드 (한국 전체 데이터셋)

**Out-of-scope (v1 이후)**

- 라이선스 호환성 자동 추천 (CC-BY 변환 도구 등)
- 비준수 논문 자동 OA화 워크플로우 (ScholarLink 다운로더 연동은 v2)
- 실시간 기관 SSO 로그인 기반 본인 논문 자동 동기화 (v3)
- 한국어 외 다국어 정책 문서 자동 파싱 (v2, GPT-4 활용 검토)

---

## 2. 사용자 페르소나 & 시나리오

### 2.1 페르소나

| 페르소나 | 동기 | 핵심 니즈 |
|---|---|---|
| **A. 박사후/박사과정 연구자** | 논문投稿 직전, 저널 정책이 NRF 요건 충족하는지 확인 | DOI 1건 입력 → 5초 안에 verdict |
| **B. 기관 도서관/리포지터리 담당자** | 우리 기관 논문 OA 준수율 분기별 보고 | ORCID 100건 일괄 → Excel 다운로드 |
| **C. 펀더 프로그램 매니저** | NRF 특정 프로그램의 미준수 논문 파악 | Grant ID 입력 → 미준수 목록 알림 |
| **D. 정책 입안자/시민단체** | "한국 OA 정책 도입 시 효과" 보고서 작성 | 국가별 + 한국 시뮬레이션 데이터 다운로드 |
| **E. 시민/저널리스트** | 특정 논문/저널의 OA 정책 준수 여부 추적 | DOI 입력 + 결과 공유 링크 |

### 2.2 주요 시나리오

#### 시나리오 1 — DOI 단일 체크 (가장 빈번)

```
사용자: Home → "OA 준수 체크" 탭 → DOI 입력 (10.1038/s41586-020-2649-2)
시스템: (1) Crossref → 논문 메타 + funder 목록
       (2) Unpaywall → OA 위치 + 라이선스
       (3) 각 funder에 대해 Sherpa Juliet 조회 → 정책 비교
       (4) Verdict 계산 + 시각화
응답: < 5초 안에 verdict 카드 + 근거 펼침
```

#### 시나리오 2 — ORCID 기반 연구자 전체 논문 일괄

```
사용자: ORCID 입력 (0000-0002-1825-0097)
시스템: (1) Crossref ORCID API → 논문 목록 (최대 200건)
       (2) 각 논문 병렬 compliance 체크 (최대 10개 동시)
       (3) 결과 집계 + 시각화
응답: 30초~1분 후 준수율 카드 + 미준수 논문 목록 + CSV 다운로드
```

#### 시나리오 3 — 리더보드 (인증 불요)

```
사용자: /compliance/dashboard → "한국 / 기관별" 필터
시스템: 사전 집계된 nightly 통계 조회
응답: 한국 50대 기관 리더보드 (Top 10 worst / Top 10 best)
```

#### 시나리오 4 — 정책 시뮬레이션

```
사용자: Dashboard → "만약 한국이 Plan S를 도입한다면?"
시스템: (1) 현재 한국 논문 N건 + 각 논문의 CC-BY 가능 여부
       (2) Plan S 적용 시뮬레이션
응답: "X% 추가 OA화 가능" + 시나리오별 CSV 다운로드
```

---

## 3. 데이터 소스 통합 전략

### 3.1 기존 활용 (이미 ScholarLink에 통합됨)

| 소스 | 현재 사용처 | Compliance 활용 |
|---|---|---|
| **Unpaywall** | PDF 다운로드 (`server/src/services/downloadService.ts:1066`) | OA 위치 + 라이선스 + oa_type 추출 |
| **Crossref** | DOI 메타 (`doiParserService.ts:123`) | funder 정보 + funding reference + license + publication date |
| **OpenAIRE** | PDF 다운로드 (`downloadService.ts:367`) | Grant ID → 펀딩 논문 목록 |

**Unpaywall 응답 핵심 필드**:
```json
{
  "is_oa": true,
  "oa_status": "gold" | "green" | "hybrid" | "bronze" | "closed",
  "oa_locations": [{
    "host_type": "publisher" | "repository",
    "license": "CC-BY" | null,
    "url": "...",
    "url_for_pdf": "..."
  }],
  "best_oa_location": {...}
}
```

**Crossref funder reference 형식**:
```json
"funder": [{
  "DOI": "10.13039/501100003621",  // funder registry DOI
  "name": "National Research Foundation of Korea",
  "award": ["2021R1A2C..."]      // grant ID
}]
```

### 3.2 신규 연동

#### 3.2.1 ROARMAP (Registry of Open Access Mandatory Archiving Policies)

- **URL**: https://roarmap.eprints.org/
- **접근**: REST API (`/api/registry/`) 또는 월간 JSON 덤프 다운로드
- **용도**: 기관 OA 의무화 정책 메타데이터 (기관명, ROR ID, 정책 URL, 강제 여부, embargo)
- **갱신 주기**: 분기 1회 (cron)
- **구현**: `services/policyProviders/roarmapProvider.ts`
- **무료 / API 키 불요**

#### 3.2.2 Sherpa Juliet (펀더 OA 정책)

- **URL**: https://v2.sherpa.ac.uk/api/
- **접근**: REST API (`/v2/publisher/funders` 등)
- **인증**: 인스턴스별 API 키 필요. 무료 tier는 일 1000건
- **용도**: 펀더별 OA 정책 — 허용 oa_type, embargo, 라이선스 허용 범위
- **갱신 주기**: 펀더 ID별 30일 캐시
- **구현**: `services/policyProviders/sherpaJulietProvider.ts`
- **주의**: Sherpa Romeo는 출판사 정책, Juliet은 펀더 정책 — 섞지 말 것

#### 3.2.3 ROR (Research Organization Registry) [보조]

- **URL**: https://api.ror.org/v1/organizations
- **용도**: 기관명 정규화 + 국가 코드 + parent/child 관계
- **무료, API 키 불요**

#### 3.2.4 Crossref Funder Registry [기존 활용]

- Crossref funder 데이터에 이미 포함됨 (`10.13039/` DOI prefix)
- 추가 작업 불요

---

## 4. 시스템 아키텍처

```
┌──────────────────────────────────────────────────────────┐
│                       FRONTEND (React)                    │
│                                                            │
│  /compliance                  → ComplianceChecker.tsx     │
│  /compliance/researcher       → ComplianceResearcher.tsx  │
│  /compliance/dashboard        → ComplianceDashboard.tsx   │
│  /compliance/policy-explorer  → PolicyExplorer.tsx        │
└────────────────────┬───────────────────────────────────────┘
                     │ REST/JSON
                     ▼
┌──────────────────────────────────────────────────────────┐
│                  BACKEND (Express + TS)                   │
│                                                            │
│  /api/v1/compliance/*        → complianceController.ts    │
│  /api/v1/compliance/bulk     → bulkComplianceController   │
│  /api/v1/policies/*          → policyController.ts        │
│  /api/v1/stats/*             → complianceStatsController  │
└────────────────────┬───────────────────────────────────────┘
                     │
        ┌────────────┼────────────┬─────────────┐
        ▼            ▼            ▼             ▼
   ┌────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
   │services│  │policy    │  │compliance│  │aggregator│
   │/doi    │  │Providers/│  │Engine.ts │  │/stats.ts │
   │Parser  │  │ • roarmap│  │(verdict  │  │(leader-  │
   │        │  │ • juliet │  │ 계산)    │  │ board)   │
   └────┬───┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
        │           │             │             │
        └───────────┴─────────────┴─────────────┘
                            │
                            ▼
   ┌─────────────────────────────────────────────────┐
   │         PostgreSQL (Neon) — 6 new tables        │
   └─────────────────────────────────────────────────┘
                            ▲
                            │
   ┌─────────────────────────────────────────────────┐
   │   External: Unpaywall / Crossref / OpenAIRE /    │
   │             ROARMAP / Sherpa Juliet / ROR        │
   └─────────────────────────────────────────────────┘

   ┌─────────────────────────────────────────────────┐
   │   Cron jobs (node-cron)                          │
   │     • ROARMAP monthly dump import (월 1회)       │
   │     • Sherpa Juliet funder cache refresh (주 1회)│
   │     • Compliance aggregate recompute (일 1회)    │
   └─────────────────────────────────────────────────┘
```

---

## 5. DB 스키마

`server/src/db/migrate.ts`에 추가할 신규 테이블 (모두 `IF NOT EXISTS` 가드).

### 5.1 `policies_funders` — 펀더 OA 정책 캐시

```sql
CREATE TABLE IF NOT EXISTS policies_funders (
  id SERIAL PRIMARY KEY,
  funder_doi VARCHAR(255) UNIQUE NOT NULL,        -- 10.13039/501100003621
  funder_name VARCHAR(500),
  source VARCHAR(50) NOT NULL,                     -- 'sherpa_juliet' | 'manual'
  policy_data JSONB NOT NULL,                      -- 원본 정책 (oastatus, embargo, license 등)
  permits_gold BOOLEAN,
  permits_green BOOLEAN,
  permits_hybrid BOOLEAN,
  max_embargo_months INTEGER,
  required_licenses TEXT[],                       -- ['CC-BY','CC-BY-SA']
  preferred_licenses TEXT[],
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL                    -- 30일 후
);
CREATE INDEX idx_pfunders_expires ON policies_funders(expires_at);
```

### 5.2 `policies_institutions` — 기관 OA 정책 캐시 (ROARMAP)

```sql
CREATE TABLE IF NOT EXISTS policies_institutions (
  id SERIAL PRIMARY KEY,
  roarmap_id VARCHAR(255) UNIQUE NOT NULL,
  ror_id VARCHAR(255),                            -- ROR 정규화 ID
  institution_name VARCHAR(500) NOT NULL,
  country_code VARCHAR(2),
  policy_url TEXT,
  policy_type VARCHAR(50),                        -- 'mandatory' | 'requested' | 'optional'
  policy_data JSONB NOT NULL,
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_pinst_country ON policies_institutions(country_code);
CREATE INDEX idx_pinst_ror ON policies_institutions(ror_id);
```

### 5.3 `compliance_checks` — 개별 체크 결과 로그

```sql
CREATE TABLE IF NOT EXISTS compliance_checks (
  id BIGSERIAL PRIMARY KEY,
  doi VARCHAR(500) NOT NULL,
  normalized_doi VARCHAR(500) NOT NULL,
  paper_metadata JSONB,                           -- Crossref 응답 일부
  funders JSONB,                                  -- funder ID 목록
  oa_status VARCHAR(50),                          -- Unpaywall oa_status
  oa_locations JSONB,                             -- Unpaywall OA 위치
  verdict VARCHAR(50) NOT NULL,                   -- 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIAL' | 'UNCLEAR'
  verdict_reasons JSONB NOT NULL,                 -- [{funder_doi, status, reason, evidence_url}]
  checked_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(normalized_doi, checked_at)              -- 중복 체크 방지 X (시간 기록용)
);
CREATE INDEX idx_compliance_doi ON compliance_checks(normalized_doi);
CREATE INDEX idx_compliance_verdict ON compliance_checks(verdict);
CREATE INDEX idx_compliance_checked_at ON compliance_checks(checked_at DESC);
```

### 5.4 `compliance_aggregates` — 기관/국가/펀더 집계 (대시보드용)

```sql
CREATE TABLE IF NOT EXISTS compliance_aggregates (
  id BIGSERIAL PRIMARY KEY,
  scope_type VARCHAR(50) NOT NULL,                -- 'institution' | 'country' | 'funder' | 'global'
  scope_id VARCHAR(255) NOT NULL,                 -- ROR ID, ISO-2, funder DOI, 'ALL'
  total_papers INTEGER NOT NULL,
  compliant INTEGER NOT NULL,
  partial INTEGER NOT NULL,
  non_compliant INTEGER NOT NULL,
  unclear INTEGER NOT NULL,
  compliance_rate DECIMAL(5,2),                   -- compliant+partial*0.5 / total * 100
  window_start DATE,                              -- 집계 윈도우 시작 (예: 2024-01-01)
  window_end DATE,
  computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(scope_type, scope_id, window_start, window_end)
);
CREATE INDEX idx_cagg_scope ON compliance_aggregates(scope_type, scope_id);
CREATE INDEX idx_cagg_computed ON compliance_aggregates(computed_at DESC);
```

### 5.5 `compliance_audit` — 옵트아웃 / 정책 동의

```sql
CREATE TABLE IF NOT EXISTS compliance_audit (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,                    -- 'bulk_check_consent' | 'opt_out_aggregate'
  payload JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5.6 `grant_lookups` — Grant ID → 논문 매핑 (OpenAIRE)

```sql
CREATE TABLE IF NOT EXISTS grant_lookups (
  id SERIAL PRIMARY KEY,
  grant_id VARCHAR(255) UNIQUE NOT NULL,
  funder_doi VARCHAR(255),
  paper_count INTEGER,
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL                   -- 7일 캐시
);
```

---

## 6. API 설계

모든 엔드포인트는 `/api/v1/` prefix, JSON 응답, 한국 시간 기준.

### 6.1 단일 DOI 체크

```
POST /api/v1/compliance/check
Body: { doi: "10.1038/..." }
Response: {
  doi, normalized_doi,
  verdict: "COMPLIANT" | "NON_COMPLIANT" | "PARTIAL" | "UNCLEAR",
  verdict_summary: "한국 NRF 정책에 따라 부분 준수",
  reasons: [{
    funder_doi, funder_name,
    required: { oa_type: "gold_or_green", license: "CC-BY", embargo_months: 0 },
    actual: { oa_status: "green", license: null, embargo_months: 12 },
    status: "NON_COMPLIANT",
    reason: "embargo 12개월 > 정책 허용 0개월",
    evidence_url: "..."
  }],
  oa_locations: [...],
  funder_count, paper_age_years,
  checked_at, cache_ttl_seconds
}
```

### 6.2 ORCID 일괄 체크

```
POST /api/v1/compliance/check-orcid
Body: { orcid: "0000-0002-1825-0097", max_papers: 200 }
Response: {
  orcid, researcher_name,
  total_papers, compliant, partial, non_compliant, unclear,
  compliance_rate: 67.5,
  paper_results: [{ doi, verdict, ... }],
  computed_in_ms: 45230
}
```

비동기 옵션: `?async=1` → job_id 반환 후 `/jobs/:id` 폴링

### 6.3 Grant ID 일괄 체크

```
POST /api/v1/compliance/check-grant
Body: { grant_id: "2021R1A2C1000000" }      -- NRF 포맷 자동 감지
Response: { funder_doi, paper_count, ...paper_results }
```

### 6.4 정책 조회 (캐시 우선)

```
GET /api/v1/policies/funder/:funderDoi
GET /api/v1/policies/institution?ror=...&country=KR
```

### 6.5 통계 (대시보드용)

```
GET /api/v1/stats/leaderboard?scope=institution&country=KR&limit=50
GET /api/v1/stats/country?code=KR&since=2024-01-01
GET /api/v1/stats/simulate?policy=plan_s&country=KR
  → "현재 38% → Plan S 적용 시 71% (추가 18,420건 OA화 가능)"
```

### 6.6 데이터셋 다운로드

```
GET /api/v1/stats/export?format=csv&scope=institution&country=KR
  → text/csv (Content-Disposition: attachment)
```

---

## 7. UI/UX 흐름

### 7.1 페이지 구성

| 경로 | 컴포넌트 | 인증 |
|---|---|---|
| `/compliance` | `ComplianceChecker` | 공개 |
| `/compliance/orcid` | `ComplianceORCID` | 공개 |
| `/compliance/grant` | `ComplianceGrant` | 공개 |
| `/compliance/dashboard` | `ComplianceDashboard` | 공개 |
| `/compliance/policy-explorer` | `PolicyExplorer` | 공개 |
| `/compliance/results/:id` | `ComplianceResultShare` | 공개 |

### 7.2 ComplianceChecker (단일 DOI)

```
┌────────────────────────────────────────────┐
│  🔍 OA 정책 준수 체크                         │
│                                              │
│  [DOI 입력________________________] [체크]   │
│                                              │
│  ── 결과 ──                                   │
│                                              │
│  DOI: 10.1038/s41586-020-2649-2              │
│  논문: "Spatially resolved..."                │
│  저자: Smith J., Kim H., ...                 │
│  펀더: 4건 (NIH, ERC, NRF, Wellcome)         │
│                                              │
│  ┌────────────────────────────────────┐     │
│  │ ❌ NON_COMPLIANT                    │     │
│  │ 한국 NRF 정책 기준 미준수            │     │
│  └────────────────────────────────────┘     │
│                                              │
│  📋 펀더별 상세:                               │
│  • NIH (10.13039/100000002) ✅ 준수          │
│      oa_status: gold, CC-BY ✓                │
│                                              │
│  • ERC (10.13039/501100000663) ❌ 미준수     │
│      oa_status: green, 라이선스: 없음 ✗      │
│      정책 요구: CC-BY 필수                   │
│                                              │
│  • NRF (10.13039/501100003621) ⚠️ 부분     │
│      oa_status: green                        │
│      정책: 권고 (강제 아님) → UNCLEAR        │
│                                              │
│  📤 공유 링크 / 📥 결과 PDF                    │
└────────────────────────────────────────────┘
```

### 7.3 ComplianceDashboard

- **탭 1: 국가별** — 세계 지도 (choropleth, d3 사용 — 기존 citation network 시각화 인프라 활용)
- **탭 2: 기관별** — 한국/전세계 토글, Top 10 worst / Top 10 best
- **탭 3: 펀더별** — 글로벌 20대 펀더 비교
- **탭 4: 시뮬레이션** — "만약 한국이 Plan S 도입 시..." 슬라이더

### 7.4 i18n

기존 `dictionary.ts` 패턴 확장:
- `compliance.checker.title` / `compliance.checker.inputPlaceholder`
- `compliance.verdict.COMPLIANT` / `NON_COMPLIANT` / `PARTIAL` / `UNCLEAR`
- 영문/한글 모두 제공

---

## 8. 단계별 구현 로드맵

### Phase 1 — MVP (3주)

**목표**: 단일 DOI → 5초 안에 verdict

| 주차 | 작업 | 산출물 |
|---|---|---|
| 1-1 | `services/policyProviders/sherpaJulietProvider.ts` (API 키 발급, 캐시) | `policies_funders` 채움 |
| 1-2 | `services/complianceEngine.ts` (verdict 계산 로직) | 단위 테스트 10건 |
| 1-3 | `controllers/complianceController.ts` + `/check` 엔드포인트 | API 동작 |
| 2-1 | `pages/ComplianceChecker.tsx` UI | UI 동작 |
| 2-2 | Crossref funding reference 파싱 | funder 자동 인식 |
| 2-3 | Unpaywall OA 정보 통합 | verdict 정확도 향상 |
| 3-1 | 에러 처리 + rate limit + 캐싱 | 운영 안정성 |
| 3-2 | 인덱스 + 마이그레이션 자동 실행 | DB 준비 |
| 3-3 | 배포 + 모니터링 | Render 배포 |

### Phase 2 — 대시보드 (2주)

| 주차 | 작업 | 산출물 |
|---|---|---|
| 4-1 | ROARMAP Provider + 월간 cron import | `policies_institutions` 채움 |
| 4-2 | `compliance_aggregates` nightly cron | 일별 집계 |
| 4-3 | `pages/ComplianceDashboard.tsx` | 리더보드 UI |
| 5-1 | Choropleth 세계 지도 (d3) | 시각화 |
| 5-2 | CSV 다운로드 | 데이터 공개 |

### Phase 3 — 일괄 + 시뮬레이션 (2주)

| 주차 | 작업 | 산출물 |
|---|---|---|
| 6-1 | ORCID endpoint + Crossref ORCID API 통합 | 일괄 체크 |
| 6-2 | Grant ID endpoint + OpenAIRE 통합 | grant 매핑 |
| 6-3 | 비동기 잡 큐 (Bull/BullMQ 또는 단순 in-process) | 대량 처리 |
| 7-1 | Plan S 시뮬레이터 | 정책 시나리오 |
| 7-2 | 한국 NRF 시나리오 + 한국 매핑 강화 | 한국 특화 |

### Phase 4 — 고도화 (지속)

- Sherpa Romeo 통합 (출판사 정책 매칭 → 더 정밀한 verdict)
- KISTI/NRF 직접 데이터 파트너십 탐색
- SNS 공유 카드 (Open Graph)
- 다국어 정책 문서 자동 번역 (v2, GPT-4 검토)
- SSO 기관 연동

---

## 9. 한국 특화 전략

### 9.1 데이터 보강

한국 NRF는 2026년 현재 ROARMAP에 등록돼 있지 않다. 대응 방안:

1. **수동 매핑**: `policies_institutions`에 한국 30대 기관 사전 등록
   - KAIST, 서울대, 고려대, 성균관대, 한양대, POSTECH, UNIST, GIST, 연세대, 한국외대, ...
   - ROR ID + NRF 정책 설명 + 자체 리포지터리 URL (DBpia, RISS, KoreaMed 등)
2. **NTIS 연동 검토**: NRF가 운영하는 국가과학기술지식정보서비스. Grant ID → 논문 매핑의 한국 권위 소스
3. **KISTI ScienceON**: 한국형 OpenAIRE. API 키 발급 가능 시 우선 활용

### 9.2 정책 시뮬레이션 시나리오

| 시나리오 | 정의 | 예상 효과 |
|---|---|---|
| `current` | 현행 NRF 권고 (강제 아님) | 기준선 ~38% |
| `gold_only` | Gold OA만 허용 | ~22% |
| `green_with_embargo_12` | Green 허용, embargo 12개월 | ~45% |
| `plan_s_full` | 즉시 OA + CC-BY | ~68% |
| `hybrid_allowed` | Hybrid 허용 + Cap | ~52% |

### 9.3 정책 입안자용 공개 자료

- `/compliance/dashboard/policy-kr` 페이지: 한국 vs G7 비교
- CSV 다운로드: 한국 전체 기관 데이터 + 시뮬레이션 결과
- 시각화 임베드: `<iframe src="...">` 가능한 위젯

---

## 10. 기술적 리스크 & 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| Sherpa Juliet API 키 발급 지연 | Phase 1 지연 | 사전 신청 (인스턴스 정보 + 사용 목적 명시), 거부 시 ROARMAP + 수동 매핑으로 MVP 가능 |
| Unpaywall rate limit | 단일 체크 응답 지연 | 결과 캐시 24h, batch 시 동시 5건 제한 |
| Crossref funding reference 누락 (학술지 미통보) | verdict "UNCLEAR" 빈도 증가 | 메타데이터 신뢰도 표시 + 사용자 수동 funder 입력 옵션 |
| 한국 기관 ROR ID 미등록 | 매핑 실패 | 수동 매핑 테이블 + admin 페이지에서 보강 |
| PDF 비공개지만 OA 가능 (Green but no PDF metadata) | 오탐 false positive | Unpaywall oa_status + repository 직접 검증 fallback |
| Render Free plan CPU 시간 | bulk 처리 비용 | $5 유료 플랜 권장 (이미 유료), 일일 cron 시간 window 설정 |
| ORCID 200건 일괄 시 응답 시간 > 30초 | UX 저하 | 비동기 잡 + 진행률 SSE 스트리밍 |
| 정책 데이터 stale | 잘못된 verdict | 30일 캐시 만료 + 변경 감지 시 invalidation |
| 다국어 정책 페이지 파싱 | 정확도 | v1에서는 수동 매핑, v2에 GPT-4 검토 |

---

## 11. 비기능 요구사항

### 11.1 성능

- 단일 DOI 체크: **p95 < 5초**, 캐시 히트 시 < 200ms
- ORCID 일괄 200건: **p95 < 60초** (비동기 시 큐잉)
- 대시보드 로드: **p95 < 1.5초** (집계 테이블 조회)
- CSV 다운로드 (10만 건): < 10초

### 11.2 캐싱 정책

| 데이터 | TTL | 무효화 |
|---|---|---|
| `policies_funders` | 30일 | funder 본문 변경 감지 |
| `policies_institutions` | 90일 | ROARMAP 분기 갱신 시 |
| `compliance_checks` (DOI 단위) | 7일 | 동일 DOI 재요청 시 갱신 |
| `compliance_aggregates` | 1일 | 일일 cron 재계산 |
| `grant_lookups` (OpenAIRE) | 7일 | grant 본문 변경 감지 |

### 11.3 Rate Limit

- `/compliance/check` 익명: **분당 30건**
- `/compliance/check` 인증: **분당 60건**
- `/compliance/check-orcid`: 일당 10건
- 정책 시뮬레이션: 일당 5건

### 11.4 비용 (Render + Neon)

- Render $5/월 (이미 사용 중)
- Neon Free tier 내 충분 — 신규 테이블 6개 + 인덱스 8개 = 약 50MB
- Unpaywall: 무료, scholar.ourresearch.org 가입 필요 (이미)
- Sherpa Juliet: 무료 tier (일 1000건)
- OpenAIRE: 무료

총 추가 비용: **$0/월** (기존 인프라 내)

### 11.5 보안 / 프라이버시

- ORCID 검색은 공개 Crossref API 사용 (사용자 동의 불요, ORCID 시스템 자체가 공개)
- 본인 논문이 아닌 타인 ORCID 일괄 체크: 감사 로그 (`compliance_audit`) 저장
- 리더보드는 익명 집계만 (기관 단위, 개인 식별 불가)
- 옵트아웃: 본인 ORCID를 통계에서 제외 요청 가능 (이메일 인증 후)

---

## 12. 부록

### 12.1 참고 자료

- Unpaywall Data API: https://unpaywall.org/products/data-feed
- Crossref Funder Registry: https://www.crossref.org/services/funder-registry/
- OpenAIRE Graph: https://graph.openaire.eu/
- ROARMAP: https://roarmap.eprints.org/
- Sherpa Juliet: https://v2.sherpa.ac.uk/juliet/
- ROR: https://ror.org/
- Plan S: https://www.coalition-s.org/plan-s-principles/
- 한국 NRF: https://www.nrf.re.kr/

### 12.2 기존 ScholarLink 통합 포인트

- `services/doiParserService.ts` — DOI 정규화 + Crossref 호출 (재사용)
- `services/downloadService.ts`의 Unpaywall/OpenAIRE 호출 — 응답 객체 재활용
- `db/migrate.ts` — 동일 파일에 신규 테이블 SQL 추가
- `db/pool.ts` — 동일 pg pool 사용
- `pages/Home.tsx` — "OA 준수 체크" 탭 추가
- `i18n/dictionary.ts` — compliance 키 추가
- `services/api.ts` — `complianceApi.ts` 추가
- `.env` — `SHERPA_JULIET_API_KEY` 추가 필요

### 12.3 향후 확장 아이디어 (백로그)

- **v2.1**: 한국 공공데이터(NTIS) 직접 파트너십 → 한국 논문 커버리지 99%
- **v2.2**: Verdict 신뢰도 점수 (0-100) — 다중 소스 교차 검증
- **v2.3**: "내 논문 OA화 자동 실행" 워크플로우 — ScholarLink 다운로더로 자동 업로드
- **v3.0**: 기관 SSO 로그인 → 본인 논문 자동 추적 + 분기별 리포트 이메일

---

## 13. 승인 및 다음 단계

**구현 시작 전 확인 사항**:

1. [ ] Sherpa Juliet API 키 발급 가능 여부 (인스턴스 등록 필요)
2. [ ] 한국 NRF 정책 데이터 소스 — NTIS 직접 연동 vs 수동 매핑
3. [ ] ORCID 일괄 처리 비동기 큐 방식 결정 (BullMQ vs in-process)
4. [ ] Choropleth 지도 라이브러리 선택 (d3-geo + 기존 citation 인프라 vs react-simple-maps)

**첫 번째 구현 작업 (Phase 1-1 시작 시)**:

`services/policyProviders/sherpaJulietProvider.ts` + `policies_funders` 마이그레이션 + 단위 테스트 10건 (NRF, NIH, ERC, Wellcome, NSF, MRC, CIHR, JSPS, MOST, SNSF 각 1건).