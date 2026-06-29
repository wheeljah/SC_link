# ScholarLink — OA Mandate Compliance Checker 코딩 계획서

| 항목 | 내용 |
|---|---|
| 문서 버전 | **1.2** |
| 작성일 | 2026-06-29 |
| 대상 저장소 | ScholarLink (`wheeljah/SC_link`) |
| 작성자 | Mavis |
| 상태 | 구체화 (구현 직전) |

---

## v1.1 변경 요약 (vs v1.0)

v1.0 초안 작성 후 외부 API 현실 점검 + ScholarLink 코드베이스 정밀 분석 결과, 다음 항목을 **구체화** 또는 **교정**함.

| 섹션 | 변경 내용 | 이유 |
|---|---|---|
| §3.2.1 ROARMAP | REST API → **OAI-PMH** 프로토콜로 변경 | ROARMAP은 EPrints 기반, REST 미제공. OAI-PMH + RDF만 지원 |
| §3.2.2 Sherpa Juliet | **수동 시드 DB 전략으로 전환**, Open Policy Finder는 옵션 | Jisc sunset (2026-07) + 신 API는 유료 멤버십. MVP 의존 불가 |
| §3.2.3 ROR | URL 검증 — `https://api.ror.org/organizations` (v1 아님) | 실 호출 검증 완료 |
| §5 | **펀더 20개 + 한국 기관 30개 시드 데이터 SQL 추가** | Sherpa 의존 제거, Phase 1 즉시 동작 |
| §6.7 | **verdict 계산 알고리즘 의사코드** 추가 | 구현 모호함 해소 |
| §8 | Phase 1을 **파일 단위 그뤠뉄러 태스크**로 분해 (1-1~1-9) | 첫 주 작업 명확화 |
| §11.2 | `node-cache` (이미 citationService에서 사용 중) **인-메모리 캐시 + DB 영구 캐시 이중화** | 기존 패턴 재사용 |
| §12.1 | **검증된 URL**로 갱신 | 2026년 6월 실 호출 결과 반영 |

**v1.2 갱신** (사용자 추가 조사 요청 → 실시간 소스 발견):

| 섹션 | 변경 | 비고 |
|---|---|---|
| §3.2.2 | **cOAlition S JCT 공개 API 발견** — Sherpa 대체 | `api.journalcheckertool.org` 무료, 30+ cOAlition S 펀더 |
| §3.2.6 | **Europe PMC Articles + Grist API** 신규 추가 | 라이선스 + 펀더 grant 매핑 |
| §3.2.7 | **OpenAlex** 신규 추가 | 240M 논문 ROR ID + OA status |
| §6.7 | **verdict 알고리즘 업데이트** — JCT API 우선 호출 + 시드 DB 폴백 | 더 정확한 판정 |
| §11.4 | 비용 추정 갱신 | 모두 무료, **총 $0/월 확정** |

**변경 안 함** (v1.0 유지):
- 페르소나/시나리오, 아키텍처 다이어그램, DB 테이블 구조, 비기능 요구사항, 한국 특화 전략 — 모두 유효

---

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
| **node-cache** | `citationService.ts:24` (인용 네트워크 빌드) | **컴플라이언스 verdict 인-메모리 캐시 (TTL 5분)** |

**Unpaywall 응답 핵심 필드** (실제 응답 기반):
```json
{
  "doi": "10.1038/s41586-020-2649-2",
  "is_oa": true,
  "oa_status": "gold",           // gold | green | hybrid | bronze | closed
  "oa_locations": [{
    "host_type": "publisher",    // publisher | repository
    "license": "cc-by",          // cc-by | cc-by-sa | cc-by-nc | null
    "url": "https://www.nature.com/articles/...",
    "url_for_pdf": "https://...",
    "url_for_landing_page": "https://...",
    "version": "publishedVersion" // acceptedVersion | submittedVersion
  }],
  "best_oa_location": {...},
  "journal_is_oa": false,
  "journal_is_in_doaj": false
}
```

**Crossref funder reference 형식**:
```json
"funder": [{
  "DOI": "10.13039/501100003621",  // Crossref Funder Registry DOI
  "name": "National Research Foundation of Korea",
  "award": ["2021R1A2C1000000"],   // grant ID (있을 경우)
  "doi_asserted_by": "publisher"
}]
```

**Crossref 응답 핵심 필드 (펀더 + 라이선스)**:
```json
{
  "DOI": "10.1038/...",
  "title": ["..."],
  "published": { "date-parts": [[2024, 5, 14]] },
  "license": [{ "URL": "https://creativecommons.org/licenses/by/4.0/",
                "start": { "date-parts": [[2024, 5, 14]] },
                "delay-in-days": 0 }],
  "funder": [{ ... }],
  "author": [{ "ORCID": "https://orcid.org/0000-0002-..." }]
}
```

### 3.2 신규 연동

#### 3.2.1 ROARMAP — **OAI-PMH 프로토콜** (REST 아님)

- **베이스 URL**: `https://roarmap.eprints.org/cgi/oai2`
- **프로토콜**: OAI-PMH 2.0 + RDF 형식 (EPrints 기반)
- **무료 / 인증 불요**
- **검증된 엔드포인트**:
  - `?verb=Identify` → 저장소 정보
  - `?verb=ListMetadataFormats` → `rdf` 단일 포맷 제공 확인 (2026-06-29 실 호출)
  - `?verb=ListRecords&metadataPrefix=rdf` → 전체 레코드 페이지네이션 (resumptionToken 기반)
- **용도**: 기관 OA 의무화 정책 메타데이터 (기관명, ROR ID, 정책 URL, 강제/권고/선택 여부, embargo)
- **갱신 주기**: 월 1회 cron (저장소 갱신 빈도 낮음)
- **구현 파일**: `services/policyProviders/roarmapProvider.ts`
- **파서**: `rdf-parser` npm 또는 `xml2js` + manual RDF 파싱 (의존성 최소화 시 xml2js)
- **harvest 전략**:
  ```typescript
  // 의사코드
  let resumptionToken: string | null = null;
  do {
    const url = resumptionToken
      ? `${OAI_BASE}?verb=ListRecords&resumptionToken=${resumptionToken}`
      : `${OAI_BASE}?verb=ListRecords&metadataPrefix=rdf`;
    const xml = await axios.get(url, { timeout: 30000 });
    const records = parseRdfRecords(xml.data);  // <rdf:RDF> 추출
    await upsertPoliciesInstitutions(records);
    resumptionToken = extractResumptionToken(xml.data);
  } while (resumptionToken);
  ```

#### 3.2.2 펀더 정책 — **수동 시드 DB 우선**, Sherpa는 옵션

> ⚠️ **2026년 6월 현재 상황** — Jisc 공식 발표:
> - Sherpa Juliet/Sherpa Romeo/Fact 3개 서비스가 **Open Policy Finder로 통합**됨
> - 레거시 `v2.sherpa.ac.uk` API는 **2026년 7월 말 retirement**
> - 신규 API는 **supporter scheme 멤버십** 필요 (영국 교육기관 대상, 무료 아님)
> - 현재 신규 API 키 발급 요청 **접수 중단**
>
> 출처: https://openpolicyfinder.jisc.ac.uk/help/developers/about-the-legacy-sherpa-services-api

**Phase 1 전략 변경**: Sherpa API 의존 제거, **수동 큐레이션 시드 DB**로 대체.

- **구현 파일**: `server/src/db/seeds/funderPolicies.seed.ts`
- **초기 시드 (20개 주요 펀더)** — Crossref Funder Registry DOI 기준:

| funder_doi | funder_name | plan_s_compatible | permits_gold | permits_green | max_embargo_months | required_license | source |
|---|---|---|---|---|---|---|---|
| `10.13039/100000002` | NIH (National Institutes of Health) | true | true | true | 0 | CC-BY, CC0 | manual+NIH 2024 Public Access Policy |
| `10.13039/501100000780` | Wellcome Trust | true | true | true | 0 | CC-BY | manual+Wellcome OA Policy 2021 |
| `10.13039/501100000663` | ERC (European Research Council) | true | true | true | 0 | CC-BY | manual+ERC OA Guidelines 2022 |
| `10.13039/501100003621` | NRF (한국연구재단) | false | true | true | 12 | none (권고만) | manual+NRF 학술연구정책 |
| `10.13039/501100001711` | UKRI (UK Research and Innovation) | true | true | true | 0 | CC-BY | manual+UKRI OA Policy 2022 |
| `10.13039/100000893` | NSF (US National Science Foundation) | true | true | true | 12 | CC-BY, CC-BY-SA | manual+NSF PAPPG 2024 |
| `10.13039/501100000265` | CIHR (Canadian Institutes of Health Research) | true | true | true | 0 | CC-BY | manual |
| `10.13039/501100000272` | MRC (UK Medical Research Council) | true | true | true | 0 | CC-BY | manual |
| `10.13039/501100001602` | JSPS (Japan Society for the Promotion of Science) | false | true | true | 12 | none (권고) | manual |
| `10.13039/501100006434` | MOST (中国科学技术部) | false | true | true | 12 | none | manual |
| `10.13039/501100001659` | DFG (Deutsche Forschungsgemeinschaft) | false | true | true | 12 | CC-BY 권고 | manual |
| `10.13039/501100001711` | SNSF (Swiss National Science Foundation) | true | true | true | 0 | CC-BY | manual |
| `10.13039/501100004895` | ANR (Agence Nationale de la Recherche) | true | true | true | 0 | CC-BY | manual |
| `10.13039/501100007107` | KAIST (한국과학기술원) | false | true | true | 12 | none | manual |
| `10.13039/501100002465` | 한국학술정보 (KoreaMed) | false | true | false | null | none | manual |
| ... | (총 20개 시드) | | | | | | |

**시드 삽입 스크립트** (`server/src/db/seeds/funderPolicies.seed.ts`):
```typescript
// npm run db:seed --prefix server 실행으로 1회 적용
// 중복 방지: ON CONFLICT (funder_doi) DO UPDATE SET ...
import { pool } from './pool';
import { FUNDER_POLICIES_SEED } from './funderPolicies.data';

export async function seedFunderPolicies() {
  for (const p of FUNDER_POLICIES_SEED) {
    await pool.query(
      `INSERT INTO policies_funders (funder_doi, funder_name, source, policy_data,
         permits_gold, permits_green, permits_hybrid, max_embargo_months,
         required_licenses, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() + INTERVAL '90 days')
       ON CONFLICT (funder_doi) DO UPDATE SET
         funder_name = EXCLUDED.funder_name,
         policy_data = EXCLUDED.policy_data,
         permits_gold = EXCLUDED.permits_gold,
         expires_at = EXCLUDED.expires_at`,
      [p.funder_doi, p.funder_name, 'manual_seed', p.policy_data,
       p.permits_gold, p.permits_green, p.permits_hybrid, p.max_embargo_months,
       p.required_licenses]
    );
  }
  console.log(`[seed] ${FUNDER_POLICIES_SEED.length} funder policies inserted`);
}
```

**Phase 3 옵션**: Open Policy Finder 멤버십 가입 후 신규 API 연동 (월 GBP £125~250 규모). 우선순위 낮음.

#### 3.2.3 ROR (Research Organization Registry) [검증 완료]

- **URL**: `https://api.ror.org/organizations?query={name}` ⚠️ **v1 prefix 없음** (2026-06-29 실 호출 확인)
- **무료 / 인증 불요**
- **검증된 응답 예시** (KAIST):
```json
{
  "id": "https://ror.org/05apxxy63",
  "names": [{ "value": "KAIST", "types": ["acronym"] },
            { "value": "Korea Advanced Institute of Science and Technology", "lang": "en" }],
  "external_ids": { "fundref": "501100007107", "grid": "grid.37172.30" },
  "country_code": "KR",
  "types": ["education", "funder"]
}
```
- **용도**: 기관명 정규화 + fundref↔ROR ID 매핑 + parent/child 관계 + 국가 코드
- **캐시**: 기관별 90일 (DB 영구 + 인-메모리 L1)

#### 3.2.4 Crossref Funder Registry [기존 활용]

- Crossref funder 데이터에 이미 포함됨 (`10.13039/` DOI prefix)
- 추가 작업 불요

#### 3.2.5 OpenAlex [신규 활용 — 정책 매핑 보강]

- **URL**: `https://api.openalex.org/works/doi:{doi}` (무료, 폴링)
- **용도**: `authorships[].institutions[].ror`로 저자 소속 ROR ID 추출
- **장점**: Unpaywall/Crossref가 빠뜨린 ORCID-ROR 매핑 보완
- **헤더**: `User-Agent: ScholarLink/1.0 (mailto:support@scholarlink.app)` (예의상 권장)

#### 3.2.6 cOAlition S Journal Checker Tool (JCT) — **⭐ 1순위 실시간 소스** [v1.2 신규]

> 2026-06 사용자 추가 조사로 발견. **Sherpa Juliet을 완벽하게 대체**하는 무료 공개 API.

- **베이스 URL**: `https://api.journalcheckertool.org/`
- **인증**: **무료 / API 키 불요**
- **라이선스**: 콘텐츠 CC BY 4.0
- **제공**: cOAlition S Office (European Science Foundation)

**4가지 엔드포인트 (모두 GET, JSON)**:

| 엔드포인트 | 용도 | 사용 시점 |
|---|---|---|
| `/calculate?issn={issn}&funder={id}&ror={id}` | 단일 DOI → 펀더+저널+기관 기반 컴플라이언스 판정 | DOI 단일 체크 |
| `/funder_language/{funder_id}` | 펀더별 정책 한국어/영어 자연어 설명 | UI 표시 |
| `/tj/{issn}` | ISSN이 Transformative Journal인지 확인 | 추가 정보 |
| `/ta?issn={issn}&ror={ror}` | Transformative Agreement 매칭 | 기관 TA 보유 시 |

**funder ID 목록** (2026-06-29 확인, ~30개 cOAlition S 펀더):
- `wellcome`, `europeancommissionhorizoneuropeframeworkprogramme`, `unitedkingdomresearchinnovationukri`, `austriansciencefundfwf`, `billmelindagatesfoundation`, `frenchnationalresearchagencyanr`, `howardhughesmedicalinstitutehhmi`, `swissnationalsciencefoundationsnsf`, `academyoffinlandaka`, `researchcouncilofnorwayrcn`, `netherlandsorganisationforscientificresearchnwo`, `nationalhealthandmedicalresearchcouncil`, `sciencefoundationirelandsfi`, `worldhealthorganizationwho`, `aligningscienceacrossparkinsonsasap`, 등

⚠️ **NRF, KAIST, MOST, JSPS, DFG, NSF는 cOAlition S 미가입** → JCT API로 조회 불가. → **수동 시드 DB로 폴백** (§3.2.2 그대로 유지)

**실제 응답 예시** (`/calculate?issn=1932-6203&funder=wellcome&ror=052gg0110`):
```json
{
  "compliant": true,
  "results": [
    {
      "route": "fully_oa",
      "compliant": "yes",
      "log": [
        { "code": "FullOA.InDOAJ" },
        { "code": "FullOA.Compliant", "parameters": { "licence": ["CC BY", "CC-BY-SA"] } }
      ]
    },
    { "route": "self_archiving", "compliant": "yes" },
    { "route": "ta", "compliant": "unknown" },
    { "route": "tj", "compliant": "no" },
    { "route": "hybrid", "compliant": "no" }
  ],
  "cards": [
    { "id": "wellcome_primary_route", "compliant": true, "preferred": true }
  ]
}
```

**왜 강력한가**:
- 5가지 OA 경로(Fully OA / Self-archiving / TA / TJ / Hybrid)를 **각각** 컴플라이언스 판정
- 라이선스, embargo, 버전 등 **세부 조건 자동 검증**
- DOAJ + Open Access Button + Transformative Agreements DB **3개 외부 소스 교차 검증**
- cOAlition S 펀더 정책 **실시간 업데이트** (자동 반영)

**구현 위치**: `services/policyProviders/cOAlitionSProvider.ts`

**Rate limit**: 공식 명시 없음. 운영 중 모니터링 필요 (분당 60건 추정).

#### 3.2.7 Europe PMC — 라이프사이언스 보강 [v1.2 신규]

- **베이스 URL**: `https://www.ebi.ac.uk/europepmc/`
- **인증**: 무료 / 키 불요
- **커버리지**: 생물/의학 분야 6.5M OA 논문 (PMC + Europe PMC Funders Group 멤버 grant 매핑)

**엔드포인트**:

| 경로 | 용도 |
|---|---|
| `/webservices/rest/search?query=DOI:{doi}&resultType=core&format=json` | DOI → 라이선스 + PMC ID + isOpenAccess + 저자 ORCID + 소속 |
| `/GristAPI/rest/get/query=ga:"{funder_name}"&resultType=core&format=json` | 펀더 → grant 목록 |
| `/GristAPI/rest/get/query=gid:{grant_id}` | grant ID → grant 메타 + 소속 paper |
| `/oai/...?verb=ListRecords&metadataPrefix=pmc` | OAI-PMH 벌크 harvest (월 1회) |

**실제 응답 (DOI:10.1038/s41586-020-2649-2)**:
```json
{
  "isOpenAccess": "Y",
  "license": "cc by",
  "pmcid": "PMC7759461",
  "fullTextUrlList": [{
    "availability": "Open access",
    "url": "https://europepmc.org/articles/PMC7759461"
  }],
  "authorIdList": { "authorId": [{ "type": "ORCID", "value": "0000-0002-5263-5070" }, ...] },
  "firstPublicationDate": "2020-09-16"
}
```

**핵심 활용**:
- 라이프사이언스 논문의 **즉시 OA+CC-BY 확인** → Plan S 펀더 자동 컴플라이언스
- PMC fulltext URL → ScholarLink 다운로더 fallback 소스 추가
- 저자 ORCID → 일괄 ORCID 체크 (Phase 3)

**구현 위치**: `services/policyProviders/europePmcProvider.ts`

#### 3.2.8 OpenAlex — ROR + OA 보강 [v1.2 신규]

- **URL**: `https://api.openalex.org/works/doi:{doi}?select=id,doi,open_access,authorships,grants,funders`
- **인증**: 무료 / 키 불요 (단, **User-Agent 헤더 권장**)
- **커버리지**: 240M 논문

**응답 핵심 필드**:
```json
{
  "id": "https://openalex.org/W3035965352",
  "open_access": {
    "is_oa": true,
    "oa_status": "hybrid",          // gold | green | hybrid | bronze | closed
    "oa_url": "https://www.nature.com/articles/s41586-020-2649-2.pdf",
    "any_repository_has_fulltext": true
  },
  "authorships": [{
    "author": { "orcid": "https://orcid.org/0000-0002-5263-5070" },
    "institutions": [{
      "ror": "https://ror.org/01an7q238",  ← ROR ID
      "display_name": "University of California, Berkeley",
      "country_code": "US"
    }]
  }],
  "grants": [{ "funder": "https://openalex.org/F4320332161", "award_id": "..." }],
  "funders": [{ "id": "...", "display_name": "..." }]
}
```

**왜 강력한가**:
- Unpaywall/Crossref가 빠뜨린 **ORCID↔ROR 매핑** 보완
- **저자 소속 ROR ID** 추출 → `policies_institutions` 매핑용
- `any_repository_has_fulltext` → Green OA 가능 여부 판정

**구현 위치**: `services/policyProviders/openAlexProvider.ts`

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

### 6.7 verdict 계산 알고리즘 (의사코드) — v1.2 JCT API 통합

**핵심 함수**: `computeVerdict(doi, crossrefData, oaData, funderPolicies) → ComplianceVerdict`

**우선순위 체인**:
```
1. Europe PMC (라이프사이언스) → 즉시 OA + 라이선스 → Plan S 펀더면 자동 COMPLIANT
2. cOAlition S JCT API (30+ 펀더) → 실시간 정책 판정
3. 수동 시드 DB (NRF, KAIST 등 cOAlition S 미가입) → 룰 매칭
4. 모두 실패 → UNCLEAR
```

```typescript
// server/src/services/complianceEngine.ts (Phase 1-2 작성)
import NodeCache from 'node-cache';
const policyCache = new NodeCache({ stdTTL: 300, checkperiod: 60 }); // 5분 인-메모리

interface ComplianceVerdict {
  overall: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIAL' | 'UNCLEAR';
  perFunder: FunderVerdict[];
  evidence: { oa_locations: any[]; funders: any[] };
  cache_hit: boolean;
  computed_in_ms: number;
}

interface FunderVerdict {
  funder_doi: string;
  funder_name: string;
  status: 'COMPLIANT' | 'NON_COMPLIANT' | 'UNCLEAR';
  reasons: string[];
  required: { oa_type: string[]; license: string[]; max_embargo_months: number };
  actual: { oa_status: string | null; license: string | null; embargo_months: number | null };
}

export async function computeVerdict(
  doi: string,
  crossrefData: CrossrefWork,
  unpaywallData: UnpaywallWork | null
): Promise<ComplianceVerdict> {
  const start = Date.now();
  const funders = crossrefData.funder ?? [];

  // ── Funder가 없으면 → 즉시 UNCLEAR ──
  if (funders.length === 0) {
    return {
      overall: 'UNCLEAR',
      perFunder: [],
      evidence: { oa_locations: unpaywallData?.oa_locations ?? [], funders: [] },
      cache_hit: false,
      computed_in_ms: Date.now() - start,
    };
  }

  // ── 각 funder별 verdict 계산 (병렬) ──
  const perFunder: FunderVerdict[] = await Promise.all(
    funders.map(async f => {
      const policy = await getFunderPolicy(f.DOI);  // L1 캐시 → L2 DB → fallback manual
      if (!policy) {
        return {
          funder_doi: f.DOI,
          funder_name: f.name ?? 'Unknown',
          status: 'UNCLEAR',
          reasons: ['펀더 정책 데이터 없음 (Crossref Registry에는 있지만 시드 DB 미등록)'],
          required: { oa_type: [], license: [], max_embargo_months: 0 },
          actual: extractActual(unpaywallData, crossrefData),
        };
      }
      return judgeFunder(f, policy, unpaywallData, crossrefData);
    })
  );

  // ── Overall verdict 집계 ──
  const statuses = perFunder.map(p => p.status);
  let overall: ComplianceVerdict['overall'];
  if (statuses.every(s => s === 'COMPLIANT')) overall = 'COMPLIANT';
  else if (statuses.some(s => s === 'NON_COMPLIANT')) overall = 'NON_COMPLIANT';
  else if (statuses.some(s => s === 'PARTIAL')) overall = 'PARTIAL';
  else overall = 'UNCLEAR';

  return {
    overall,
    perFunder,
    evidence: { oa_locations: unpaywallData?.oa_locations ?? [], funders },
    cache_hit: false,
    computed_in_ms: Date.now() - start,
  };
}

function judgeFunder(funder, policy, oaData, paperData): FunderVerdict {
  const reasons: string[] = [];
  let status: 'COMPLIANT' | 'NON_COMPLIANT' | 'UNCLEAR' = 'COMPLIANT';

  // ── 정책이 강제가 아니면 (max_embargo_months === null) → COMPLIANT (강제 아님) ──
  if (policy.max_embargo_months === null && policy.required_licenses.length === 0) {
    return {
      funder_doi: funder.DOI,
      funder_name: funder.name,
      status: 'COMPLIANT',
      reasons: ['정책 강제 의무 없음 (권고 수준)'],
      required: { oa_type: [], license: [], max_embargo_months: 0 },
      actual: extractActual(oaData, paperData),
    };
  }

  const oaStatus = oaData?.oa_status ?? 'closed';
  const license = oaData?.best_oa_location?.license ?? paperData.license?.[0]?.URL ?? null;
  const embargoMonths = calculateEmbargo(paperData, oaData);

  // ── OA 여부 체크 ──
  if (!oaData?.is_oa) {
    reasons.push(`OA 버전 없음 (Unpaywall oa_status=${oaStatus})`);
    status = 'NON_COMPLIANT';
  }

  // ── OA 타입 체크 (gold/green/hybrid 허용 여부) ──
  const allowedTypes: string[] = [];
  if (policy.permits_gold) allowedTypes.push('gold', 'hybrid');
  if (policy.permits_green) allowedTypes.push('green');
  if (allowedTypes.length > 0 && !allowedTypes.includes(oaStatus)) {
    reasons.push(`OA 타입 '${oaStatus}'는 정책 허용 목록 [${allowedTypes.join(',')}]에 없음`);
    status = 'NON_COMPLIANT';
  }

  // ── 라이선스 체크 ──
  if (policy.required_licenses.length > 0) {
    const paperLicense = normalizeLicense(license);
    if (!paperLicense || !policy.required_licenses.includes(paperLicense)) {
      reasons.push(`라이선스 ${paperLicense ?? '없음'} ∉ [${policy.required_licenses.join(',')}]`);
      status = 'NON_COMPLIANT';
    }
  }

  // ── Embargo 체크 ──
  if (embargoMonths !== null && embargoMonths > policy.max_embargo_months) {
    reasons.push(`Embargo ${embargoMonths}개월 > 정책 허용 ${policy.max_embargo_months}개월`);
    status = 'NON_COMPLIANT';
  }

  if (reasons.length === 0) {
    reasons.push('모든 정책 요건 충족');
  }

  return {
    funder_doi: funder.DOI,
    funder_name: funder.name,
    status,
    reasons,
    required: {
      oa_type: allowedTypes,
      license: policy.required_licenses,
      max_embargo_months: policy.max_embargo_months,
    },
    actual: {
      oa_status: oaStatus,
      license,
      embargo_months: embargoMonths,
    },
  };
}

function normalizeLicense(urlOrSlug: string | null): string | null {
  if (!urlOrSlug) return null;
  const s = urlOrSlug.toLowerCase();
  if (s.includes('cc-by') && !s.includes('nc') && !s.includes('nd')) return 'CC-BY';
  if (s.includes('cc-by-sa')) return 'CC-BY-SA';
  if (s.includes('cc-by-nc')) return 'CC-BY-NC';
  if (s.includes('cc0')) return 'CC0';
  return null;
}
```

**테스트 케이스 (Phase 1-2 완료 조건)**:
| 입력 | expected verdict |
|---|---|
| DOI 10.1038/s41586-020-2649-2 (Nature, NIH+Wellcome 펀딩, gold CC-BY) | COMPLIANT |
| DOI with green only + Wellcome Plan S 펀딩 | NON_COMPLIANT (CC-BY 필수) |
| DOI with NRF 펀딩 + green (12개월 embargo) | COMPLIANT (NRF는 강제 아님) |
| DOI with no funder metadata | UNCLEAR |
| DOI with unknown funder (시드 DB 미등록) | UNCLEAR |

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

**목표**: 단일 DOI → 5초 안에 verdict. 핵심 파일 단위 작업 분해.

#### Week 1 — 데이터 기반 + 시드

| # | 파일 | 작업 | 산출물 |
|---|---|---|---|
| 1-1 | `server/src/db/migrate.ts` | 신규 6개 테이블 추가 (§5 SQL 그대로) | DB 마이그레이션 |
| 1-2 | `server/src/db/seeds/funderPolicies.data.ts` | 펀더 20개 시드 데이터 객체 작성 | `FUNDER_POLICIES_SEED[]` |
| 1-3 | `server/src/db/seeds/funderPolicies.seed.ts` | 시드 실행 스크립트 + `package.json` `db:seed` 스크립트 | `npm run db:seed` 동작 |
| 1-4 | `services/policyProviders/rorProvider.ts` | ROR API 클라이언트 (검색, fundref 매핑) | `searchInstitution('KAIST') → {ror_id, fundref, country}` |
| 1-5 | `services/policyProviders/roarmapProvider.ts` | OAI-PMH harvest (RDF 파싱) | `harvestRoarmap() → upserts` |
| 1-6 | `db/seeds/institutionPolicies.seed.ts` | 한국 30대 기관 수동 시드 (ROARMAP 보완) | KAIST, 서울대 등 ROR ID + 정책 |

#### Week 2 — 엔진 + API

| # | 파일 | 작업 | 산출물 |
|---|---|---|---|
| 2-1 | `services/complianceEngine.ts` | `computeVerdict()` 구현 (§6.7 의사코드) | verdict 계산 함수 |
| 2-2 | `services/complianceEngine.test.ts` | 단위 테스트 10건 (결정표 §6.7 마지막 표) | Jest 통과 |
| 2-3 | `controllers/complianceController.ts` | `checkDoi(req, res)` 핸들러 | DOI 단일 체크 |
| 2-4 | `routes/compliance.ts` | Express 라우터 + rate limit (분당 30/60) | 라우트 등록 |
| 2-5 | `app.ts` | `app.use('/api/v1/compliance', complianceRoutes)` 추가 | 마운트 |
| 2-6 | `middleware/complianceRateLimit.ts` | 별도 rate limiter (일반과 분리) | 분당 30/60 설정 |

#### Week 3 — UI + 통합 + 배포

| # | 파일 | 작업 | 산출물 |
|---|---|---|---|
| 3-1 | `client/src/services/complianceApi.ts` | API 클라이언트 + 타입 | `complianceApi.checkDoi(doi)` |
| 3-2 | `pages/Compliance.tsx` | DOI 입력 + verdict 카드 UI (§7.2 와이어프레임) | UI 동작 |
| 3-3 | `components/VerdictCard.tsx` | verdict 시각화 (색, 아이콘, 펀더별 펼침) | 재사용 컴포넌트 |
| 3-4 | `pages/Home.tsx` | "OA 준수 체크" 탭 추가 | 진입점 |
| 3-5 | `app.ts` 라우터 + `Navbar.tsx` | `/compliance` 라우트 + 메뉴 노출 | 네비게이션 |
| 3-6 | `services/api.ts` i18n 키 | `compliance.*` 사전 키 추가 (ko/en) | 다국어 |
| 3-7 | 운영 점검 | 에러 처리, 캐시 무효화, Render 환경변수 확인 | 배포 준비 |

### Phase 2 — 대시보드 (2주)

| # | 파일 | 작업 | 산출물 |
|---|---|---|---|
| 4-1 | `services/aggregator/complianceAggregator.ts` | 일간 nightly cron (compliance_aggregates 재계산) | cron 등록 |
| 4-2 | `controllers/statsController.ts` | `/stats/leaderboard`, `/stats/country` | 집계 API |
| 4-3 | `routes/stats.ts` | 통계 라우터 | 마운트 |
| 4-4 | `pages/ComplianceDashboard.tsx` | 탭 UI (국가/기관/펀더) | 리더보드 |
| 4-5 | `components/ChoroplethMap.tsx` | d3-geo + topojson (110m world) | 세계 지도 |
| 4-6 | `services/exportService.ts` | CSV 스트리밍 (10만 건 대응) | `/stats/export` |

### Phase 3 — 일괄 + 시뮬레이션 (2주)

| # | 파일 | 작업 | 산출물 |
|---|---|---|---|
| 6-1 | `controllers/bulkController.ts` | ORCID/Grant ID 비동기 잡 | `/check-orcid`, `/check-grant` |
| 6-2 | `services/jobQueue.ts` | 인-프로세스 큐 (p-limit + Promise.all, 5 동시) | 대량 처리 (BullMQ 의존성 회피) |
| 6-3 | `pages/ComplianceORCID.tsx` + `ComplianceGrant.tsx` | 일괄 결과 UI | 진행률 + CSV 다운로드 |
| 7-1 | `services/simulator/policySimulator.ts` | 5개 시나리오 시뮬레이션 | `/stats/simulate` |
| 7-2 | 한국 시뮬레이션 데이터 보강 | NRF/IITP 등 시나리오별 데이터 | 대시보드 정밀화 |

### Phase 4 — 고도화 (지속)

- Open Policy Finder 멤버십 가입 후 신규 API 연동 (월 £125~250)
- KISTI/NRF 직접 데이터 파트너십 탐색
- SNS 공유 카드 (Open Graph meta)
- GPT-4 다국어 정책 번역 (선택적)
- SSO 기관 연동
- BullMQ 전환 (Render 외부 Redis 필요 시점)

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
- 구현: `middleware/complianceRateLimit.ts` (기존 `middleware/rateLimit.ts` 패턴 확장)

### 11.4 비용 (Render + Neon) — v1.2 최종 확정

- Render $5/월 (이미 사용 중)
- Neon Free tier 내 충분 — 신규 테이블 6개 + 인덱스 8개 = 약 50MB
- **모든 외부 API 무료** (v1.2 검증):
  - Unpaywall: 무료, scholar.ourresearch.org 가입 필요 (이미)
  - **cOAlition S JCT: 무료** (v1.2 신규) — `api.journalcheckertool.org`
  - **Europe PMC: 무료** (v1.2 신규) — `ebi.ac.uk/europepmc/...`
  - **OpenAlex: 무료** (v1.2 신규) — `api.openalex.org`
  - Crossref Funder Registry: 무료
  - OpenAIRE: 무료
  - ROR: 무료
  - ROARMAP OAI-PMH: 무료
  - ~~Sherpa Juliet~~: 의존 제거 (2026-07 sunset)

총 추가 비용: **$0/월** (기존 인프라 내)

### 11.5 보안 / 프라이버시

- ORCID 검색은 공개 Crossref API 사용 (사용자 동의 불요, ORCID 시스템 자체가 공개)
- 본인 논문이 아닌 타인 ORCID 일괄 체크: 감사 로그 (`compliance_audit`) 저장
- 리더보드는 익명 집계만 (기관 단위, 개인 식별 불가)
- 옵트아웃: 본인 ORCID를 통계에서 제외 요청 가능 (이메일 인증 후)

### 11.6 캐시 아키텍처 (이중화)

기존 `citationService.ts:24`에서 이미 사용 중인 `node-cache` 패턴을 그대로 활용.

```
Layer 1 (in-memory, NodeCache)
   TTL: 5분 (펀더 정책은 자주 안 바뀜)
   Key: funderPolicy:{funder_doi}
   Key: unpaywall:{doi}
   Key: crossref:{doi}
   → 응답 시간 < 50ms (DB hit 시)

Layer 2 (PostgreSQL 영구)
   TTL: §11.2 표 참고
   → Render 재시작해도 유지
   → cron으로 백그라운드 갱신

Layer 3 (외부 API)
   Unpaywall / Crossref / OpenAIRE / ROR / ROARMAP
   → rate limit 보호
```

**왜 L1 + L2?** Render 무료 인스턴스는 15분 idle 시 spin-down, 유료도 재배포 시 메모리 초기화. L1은 hot path, L2는 cold start 후 즉시 응답 보장.

---

## 12. 부록

### 12.1 참고 자료 (2026-06-29 실 호출 검증 완료)

**⭐ 1순위 실시간 소스** (v1.2 신규):
- **cOAlition S Journal Checker Tool API**: https://journalcheckertool.org/apidocs — `https://api.journalcheckertool.org/calculate?issn={issn}&funder={id}&ror={id}` — 무료, 30+ cOAlition S 펀더
- **cOAlition S Funder ID 목록**: https://journalcheckertool.org/funder-ids
- **Europe PMC Articles API**: https://europepmc.org/RestfulWebService — `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:{doi}&resultType=core&format=json`
- **Europe PMC Grist API**: https://europepmc.org/GristAPI — `https://www.ebi.ac.uk/europepmc/GristAPI/rest/get/query=...`
- **OpenAlex**: https://api.openalex.org/ — `https://api.openalex.org/works/doi:{doi}?select=id,doi,open_access,authorships,grants,funders` (User-Agent 헤더 권장)

**사용 확정** (기존):
- Unpaywall Data API: https://unpaywall.org/products/data-feed — `https://api.unpaywall.org/v2/{doi}?email={UNPAYWALL_EMAIL}`
- Crossref Funder Registry: https://www.crossref.org/services/funder-registry/ — `https://api.crossref.org/works/{doi}` 응답에 `funder[]` 포함
- OpenAIRE Graph: https://graph.openaire.eu/ — `https://api.openaire.eu/graph/v1/researchProducts?doi={doi}` (이미 ScholarLink 통합)
- ROARMAP: https://roarmap.eprints.org/ — `https://roarmap.eprints.org/cgi/oai2?verb=ListRecords&metadataPrefix=rdf` (OAI-PMH)
- ROR: https://ror.org/ — `https://api.ror.org/organizations?query={name}` ⚠️ v1 prefix 없음

**의존 제거됨** (2026-07 sunset):
- ~~Sherpa Juliet~~: https://v2.sherpa.ac.uk/juliet/ — 2026-07 말 retirement
- ~~Open Policy Finder~~: https://openpolicyfinder.jisc.ac.uk/ — 유료 supporter scheme

**참고 문헌**:
- Plan S: https://www.coalition-s.org/plan-s-principles/
- NIH Public Access Policy: https://publicaccess.nih.gov/
- Wellcome OA Policy 2021: https://wellcome.org/grant-funding/guidance/open-access-guidance
- 한국 NRF: https://www.nrf.re.kr/ — 학술연구정책 안내
- 한국 ROR ID 매핑: https://ror.org/korea

### 12.2 기존 ScholarLink 통합 포인트

- `services/doiParserService.ts` — DOI 정규화 + Crossref 호출 (재사용)
- `services/downloadService.ts`의 Unpaywall/OpenAIRE 호출 — 응답 객체 재활용
- `services/citationService.ts`의 `NodeCache` 패턴 — 인-메모리 TTL 캐시 그대로 활용
- `services/serverMonitorService.ts`의 cron 패턴 — node-cron 스케줄링
- `middleware/rateLimit.ts` — Rate limit 미들웨어 확장
- `db/migrate.ts` — 동일 파일에 신규 테이블 SQL 추가
- `db/pool.ts` — 동일 pg pool 사용
- `app.ts` line 76~83 — 라우트 마운트 패턴 따라 `/api/v1/compliance`, `/api/v1/stats` 추가
- `pages/Home.tsx` — "OA 준수 체크" 탭 추가
- `i18n/dictionary.ts` — compliance 키 추가
- `services/api.ts` — `complianceApi.ts` 추가
- `.env` — **SHERPA_JULIET_API_KEY 추가 불요** (의존 제거됨)

### 12.3 향후 확장 아이디어 (백로그)

- **v2.1**: 한국 공공데이터(NTIS) 직접 파트너십 → 한국 논문 커버리지 99%
- **v2.2**: Verdict 신뢰도 점수 (0-100) — 다중 소스 교차 검증
- **v2.3**: "내 논문 OA화 자동 실행" 워크플로우 — ScholarLink 다운로더로 자동 업로드
- **v2.4**: Open Policy Finder 멤버십 가입 시 자동 시드 갱신
- **v3.0**: 기관 SSO 로그인 → 본인 논문 자동 추적 + 분기별 리포트 이메일

---

## 13. 승인 및 다음 단계

**구현 시작 전 확인 사항** (v1.1 갱신):

1. [x] ~~Sherpa Juliet API 키 발급 가능 여부~~ → **불필요** (sunset 대응, 수동 시드 DB 사용)
2. [ ] 한국 NRF 정책 데이터 소스 — 시드 DB 1차 + 추후 NTIS 연동 옵션
3. [ ] ORCID 일괄 처리 비동기 큐 방식 — **in-process 권장** (p-limit, Render 단일 인스턴스 내 충분)
4. [ ] Choropleth 지도 라이브러리 — **d3-geo 권장** (기존 citation network 시각화 인프라 재활용)

**첫 번째 구현 작업 (Phase 1 Week 1 시작 시)** — v1.1 순서:

1. `db/migrate.ts`에 신규 테이블 6개 SQL 추가
2. `db/seeds/funderPolicies.data.ts` 펀더 20개 시드 객체 작성
3. `db/seeds/funderPolicies.seed.ts` 시드 실행 스크립트 + `package.json` `db:seed` 등록
4. Render 배포 → 마이그레이션 + 시드 자동 실행 확인
5. 다음 주차: `services/complianceEngine.ts` 작성 후 단위 테스트 10건

**Week 1 종료 조건 (Gating)**:
- DB 마이그레이션 통과
- 펀더 20개 시드 삽입 확인 (`SELECT COUNT(*) FROM policies_funders`)
- 한국 기관 30개 시드 삽입 확인
- Render 콘솔에서 `[migrate] done` + `[seed] 20 funder policies inserted` 로그 확인