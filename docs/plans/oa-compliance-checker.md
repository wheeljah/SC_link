# ScholarLink — OA Mandate Compliance Checker 코딩 계획서

| 항목 | 내용 |
|---|---|
| 문서 버전 | **1.6** |
| 작성일 | 2026-07-02 (v1.6 갱신) |
| 대상 저장소 | ScholarLink (`wheeljah/SC_link`) |
| 작성자 | Mavis |
| 상태 | 구체화 (구현 직전) |
| 이전 버전 | v1.5 (2026-06-29), v1.4 (2026-06-29), v1.3 (2026-06-29, v1.4에서 폐기), v1.2 (2026-06-29), v1.1 (2026-06-29), v1.0 (2026-06-29) |

---

## v1.4 갱신 (촉매 역할 + 아웃바운드 재정의) — **방향성 전환**

사용자 추가 방향성 (2026-06-29 22:14):

> "교육은 좋은데, 사용자가 이러한 이슈에 대해서 관심을 갖고, 문제해결에 동참하는 것이 목적이지 깊이있는 학문적 논의는 확장되는 추가 커뮤니티가 필요하다고 생각한다. 그런 입장에서 촉매로써의 역할을 강화하고, 깊이있는 논의는 블로그로의 전환까지가 이 사이트의 기능이라고 본다."

**v1.3 → v1.4 핵심 전환**:

| 차원 | v1.3 (폐기) | v1.4 (신규) |
|---|---|---|
| **사이트 역할** | 교육 + 도구 + 커뮤니티 | **촉매** (catalyst) |
| **용어집/FAQ** | 자체 호스팅 (15개 + 12개) | **외부 링크로 전환** |
| **온보딩** | 5단계 위저드 (1분 학습) | **1단계 (verdict 후 외부로)** |
| **커뮤니티 기능** | 뱃지 7종 + 리더보드 + 5단계 퍼널 | **자체 커뮤니티 완전 폐기** |
| **깊이 있는 논의** | 사이트 내 (FAQ/용어집) | **블로그 → 외부 커뮤니티로 라우팅** |
| **참여 목표** | "DAU + 재방문" | **"verdict 후 외부 클릭률"** |
| **인센티브** | 사이트 내 점수/뱃지 | **외부 활용 사례 명예의 벽** (인용/기사에 활용) |

**핵심**: "**이 사이트에서 시작해서 밖으로 나간다**" — 머무름 시간이 아닌 **외부 연결 성공률**이 목표. 사용자가 한 번의 verdict 조회 후 **관련 깊은 논의로 자연스럽게 흘러가게** 만드는 것.

| 섹션 | 변경 |
|---|---|
| §14 | **완전 재작성** — "Glossary Portal" → "Awareness Catalyst & Outbound Bridge". 자체 용어집/FAQ/위저드 → verdict 카드의 외부 링크 3~4개 + ScholarLink 블로그 (월 2편) |
| §15 | **완전 재작성** — "5단계 퍼널 + 뱃지 + 리더보드" → "3단계 아웃바운드 깔때기 (Spark → Bridge → Transfer)". 인센티브 뱃지 시스템 완전 폐기 |
| §16 | **KPI 재정의** — "DAU/D7 retention" → "verdict 후 외부 클릭률 / 블로그 read-through / 외부 활용 인용 수" |
| §17 | **구현 작업 재정의** — 14개 → 8개로 축소 (Glossary/FAQ/위저드 페이지 제거, Blog/Bridge 컴포넌트 추가) |
| §18 | **참고자료 추가** — Plan S/OASPA 포럼, 브런치/미디엄 academic 블로그 벤치마크 |

**v1.3 자체 콘텐츠 (Glossary 15개, FAQ 12선, 5단계 위저드, 7종 뱃지, 인사이트, leaderboard)는 모두 폐기**. 사이트 내 자체 콘텐츠는 **verdict 카드 + 1줄 인라인 툴팁 + 블로그 글 (월 2편) + 외부 링크**로만 구성.

기존 §1~13 (기술 아키텍처) 변경 없음.

### v1.4 추가 갱신 (블로그 도구 확정, 2026-06-29 22:28)

사용자 결정:

> "A로 결정하고, A내용을 C에 복제하는 것으로 결정했고, 업데이트 해줘"

**의미**:
- **메인 블로그 = 옵션 A** (Astro + Cloudflare Pages) 확정
- **A의 블로그 콘텐츠(글)를 C의 티스토리에도 복제 발행** → KR syndication 채널 2개 운영 (브런치 + 티스토리)

**갱신 내용**:
- §14.8.5.4 비용 시나리오 — 옵션 A 확정 + Tistory syndication 추가
- §14.8.5.5 v1.4 최종 권장 — 텍스트 갱신 (옵션 A + 티스토리 syndication)
- §15.5 Transfer 단계 — syndication 워크플로우에 티스토리 추가
- §15.9 한국형 촉매 채널 — 티스토리 + 네이버 SEO 전략 명시
- §17 구현 작업 — Astro 블로그 SSG 셋업 1건 추가

**최종 블로그 운영 스택**:

| 역할 | 도구 | 월 비용 |
|---|---|---|
| 메인 블로그 (canonical) | **Astro + Cloudflare Pages** at `scholarlink.app/blog` | $0 |
| KR syndication #1 (Kakao 자회사 audience) | **브런치 (brunch.co.kr)** | $0 |
| KR syndication #2 (네이버 SEO 최강) | **티스토리 (tistory.com)** | $0 |
| EN syndication (글로벌 reach) | **미디엄 (medium.com)** | $0 |
| EN 뉴스레터 (선택, Phase 4) | **Substack 또는 Beehiiv** | $0 |
| **합계** | | **$0/월** |

**복제 정책** (canonical = Astro):
- Astro 글 발행 시 canonical URL을 `scholarlink.app/blog/[slug]`로 고정
- 브런치/티스토리/미디엄에는 canonical URL을 명시 + 본문 요약(전체의 60~70%)만 복제
- 외부 링크 3~5개는 모든 채널에 동일하게 포함
- 발행 순서: Astro (KR 본편) → Astro (EN, 1주 후) → 브런치 (KR, 본편 발행 후 24시간) → 티스토리 (KR, 본편 발행 후 24시간) → 미디엄 (EN, Astro EN 발행 후)

---

## v1.5 갱신 (핵심질문 트래거 — Living Issue Tracker) — **블로그 구조화**

사용자 추가 방향성 (2026-06-29 22:57):

> "OA논문과 관련된 이슈 및 정책에 대한 핵심질문을 지속적으로 업데이트하고, 해결점에 대한 글과 논의가 진행되는 것이 블로그의 내용으로 추가되어야 한다."

**v1.4 → v1.5 핵심 전환**:

| 차원 | v1.4 (이전) | v1.5 (신규) |
|---|---|---|
| **블로그 콘텐츠** | "월 2편 발행"의 콘텐츠 스트림 | **구조화된 질문 트래거** + 매달 질문에 대한 답변/분석 글이 누적 |
| **블로그 구조** | posts/ (시간순 글 목록) | posts/ + **questions/ (영구 질문 페이지)** — 2축 |
| **글의 관계** | 독립적 발행 | 모든 글이 **하나 이상의 핵심 질문에 연결** (relatedArticles) |
| **시간 흐름** | 발행 후 잊힘 | 질문은 시간이 지남에 따라 **status 변경** (🔴 Open → 🟡 In progress → 🟢 Resolved) |
| **외부 논의** | 글마다 외부 링크 3~5개 | 질문 페이지에 **외부 토론 thread URL** 영구 추적 (status 변경 근거) |
| **콘텐츠 가치** | 발행 순간 최고, 이후 감소 | **시간이 지날수록 누적** (compound value) |
| **SEO** | 발행 시점 유입 | **영구 reference 페이지**가 누적되어 장기 유입 1차 진입점 |

**핵심**: 블로그가 **"글의 컬렉션"에서 "살아있는 이슈 트래커"로 전환**. 글은 질문에 대한 답변/분석/논의의 형태이고, 질문은 영구 reference. 시간이 지날수록 콘텐츠 가치가 누적.

| 섹션 | 변경 |
|---|---|
| §14.8 (전체) | **§14.8.6 핵심질문 트래거** 신규 추가 (구조/스키마/30개 시드) |
| §14.8.1 | 블로그 역할에 **"질문 트래거의 스파인"** 추가 |
| §14.8.2 | 글 4유형 + **"질문 트래거 기반 발행 모델"** 추가 |
| §14.8.3 | 다이어그램에 **"질문 트래거 → 외부 토론 thread"** 추가 |
| §14.8.5.5 | syndication 워크플로우에 **Step 0 (질문 트래거 업데이트)** 추가 |
| §15.5 | Transfer 단계에 **"질문 status 업데이트 자동화"** 추가 |
| §15.6 | 분기 뉴스레터에 **"status 변경된 질문 5개"** 추가 |
| §16 | KPI에 **"질문 트래거 활성도" 2개** 추가 |
| §17 | 구현 작업에 **질문 트래거 5개** 추가 (Astro Content Collection + admin + cron) |
| §18 | 참고자료에 **Mozilla/W3C/Civic Tech issue tracker 사례** 추가 |

기존 v1.4 (촉매 + 외부 연결, Astro 블로그 + 4채널 syndication, $0/월)는 **유지**. v1.5는 그 위에 **구조적 레이어**를 얹는 형식.

---

## v1.6 갱신 (블로그 광고 배너 + ScholarLink 인트로 통합) — **자가 노출 + 수익화 기반**

사용자 추가 방향성 (2026-07-02 11:36):

> "각 블로그 글에 현재 랜딩페이지에 있는 bidvibe에 대한 광고 배너(KR/EN)와 scholarlink 소개 및 링크주소가 적절하게 삽입되어야 한다."

**v1.5 → v1.6 핵심 전환**:

| 차원 | v1.5 (이전) | v1.6 (신규) |
|---|---|---|
| **블로그 수익 모델** | $0/월, 자가 비용만 (촉매 원칙 일관성) | **bidvibe 광고 배너 (KR/EN)** — Top/Bottom 2개 슬롯, 기존 랜딩 페이지와 동일 디자인 재사용 |
| **ScholarLink 자가 노출** | implicit (navbar만, 본사이트 도달 동선 부재) | **각 블로그 글 헤더에 ScholarLink 인트로 박스** → verdict 도구로 자연스러운 복귀 동선 제공 |
| **CTA 채널 다변화** | 외부 토론처 + RSS 구독 (단일 채널) | **bidvibe 광고 + ScholarLink 인트로 + 외부 토론처 3-way** — 사용자가 어디로든 자연스럽게 흐를 수 있는 동선 |
| **질문 페이지 노출** | 질문 본문만 노출 | **질문 페이지에도 광고 + 인트로 통합** — 30개 시드 누적될수록 노출 누적 (compound value) |
| **syndication 복제 정책** | 외부 링크 3~5개 + canonical link | **bidvibe 광고 + ScholarLink 인트라도 syndication 4채널에 동일 삽입** (canonical = Astro 의미 강화) |
| **콘텐츠 디자인 원칙** | "촉매로서 외부 연결" | **"촉매 + 자가 노출 + 수익화" 3축** — bidvibe는 사용자에게 ai-traffic.kr 가치 제공, ScholarLink 인트로는 사용자 재방문 동선 |

**핵심**: 블로그는 월 2편 발행 + 질문 페이지 30개 누적 = **누적 페이지 수가 시간에 비례해 증가**하는 SEO 구조. v1.6에서는 이 누적 페이지를 **(a) 잠재 수익원 (bidvibe)** + **(b) 본사이트 자가 노출 채널 (ScholarLink 인트로)** 양쪽으로 활용. 1인 운영의 추가 부담은 **Layout 1개 변경으로 자동 통합** (별도 작업 불요).

**기존 컴포넌트 재사용 (Phase 2+ 즉시)**:

| 자산 | 위치 | v1.6 활용 |
|---|---|---|
| `TopAdBanner.tsx` | `client/src/components/ads/` | Astro Layout에 그대로 import → blog 전체에 적용 |
| `BottomAdBanner.tsx` | `client/src/components/ads/` | Astro Layout에 그대로 import → blog 전체에 적용 |
| `bidvibe-logo.svg` | `client/src/assets/` | 동일 자산 재사용 |
| `getLang()` (i18n 헬퍼) | `client/src/i18n/translate.ts` | KR/EN 자동 전환 |
| `UpdateBanners.sql` | DB 마이그레이션 | KR 캠페인 카피 + CTA URL 보강 (이미 적용됨) |

**예상 페이지 뷰 & 광고 CTR 시나리오**:

| Phase | 시점 | blog 전체 월 PV | bidvibe CTR 0.3~0.5% | 인트로 박스 CTR 5~10% (예상) |
|---|---|---|---|---|
| Phase 2 Week 4~5 | 발행 직후 | 500 | 1.5~2.5 클릭/월 | 25~50 클릭/월 |
| Phase 3 (ORCID 일괄) | +4주 | 2,000 | 6~10 클릭/월 | 100~200 클릭/월 |
| Phase 4 (분기 뉴스레터 + SEO 누적) | +12주 | 8,000 | 24~40 클릭/월 | 400~800 클릭/월 |
| 6개월 후 (SEO compound) | +24주 | 30,000+ | 90~150 클릭/월 | 1,500~3,000 클릭/월 |

→ bidvibe 과금 모델 미정, **현재는 노출 + 클릭 추적용**으로 통합. 향후 CPM/CPC 확정 시 수익화 가능. ScholarLink 인트로는 **자가 노출 채널** — verd ict 도구로 자연스러운 복귀 동선.

**변경 범위 요약**:

| 섹션 | 변경 |
|---|---|
| §14.8 (전체) | **§14.8.7 광고 배너 + ScholarLink 인트로 통합** 신규 추가 (8개 서브섹션) |
| §14.8.5.5 | syndication 워크플로우에 **Step 0.5 (광고/인트로 통합 확인)** 추가 |
| §15.5 | syndication 채널 표에 **bidvibe + 인트로 컬럼** 추가, 4채널 통합 |
| §15.6 | 분기 뉴스레터에 **"이번 분기 bidvibe 캠페인 요약"** 섹션 추가 (CTR/N) |
| §16 | KPI에 **#15 bidvibe CTR, #16 인트로 박스 CTR** 2개 신규 |
| §17 | 구현 작업에 **`ScholarLinkIntro.astro` 컴포넌트** + **Layout 통합** 2개 신규 |
| 변경 이력 | v1.6 row 추가 |

기존 v1.4 (촉매 + 외부 연결) + v1.5 (질문 트래거) 모두 **유지**. v1.6은 그 위에 **수익화 + 자가 노출 레이어**를 얹는 형식.

---

## v1.3 갱신 (사용자 교육 + 참여 전략) — **v1.4에서 폐기됨**

v1.4 갱신으로 인하여 폐기됨. v1.3에서는 자체 호스팅 Glossary/FAQ/위저드/뱃지/리더보드를 설계했으나, 촉매 역할에 맞지 않아 v1.4에서 모두 외부 연결/블로그로 전환. **변경 이력 보존을 위해 본 섹션은 유지하되 "폐기됨" 마크**.

사용자 요청: "OA Mandate Compliance Checker를 사용자가 이해하고 다시 찾아올 수 있도록, 필요한 소개/설명과 참여 유도 솔루션을 기획서에 반영".

외부 조사 결과(2026-06-29) — 사용자가 막히는 지점이 명확함:
- **Springer Nature 2016 설문**: 저자 중 **40%가 자기 펀더의 OA 정책 요건을 하나도 식별하지 못함**, 15%만 모두 정확히 식별. → "내 정책이 뭔지" 자체가 첫 마찰 지점.
- **일본 NII 2006 설문**: 일본 연구자 OA 인지도 29% (유럽 70%+ 대비 큰 격차). 동아시아권은 Plan S·cOAlition S 논의 자체가 늦음.
- **국내(KR) 현실**: NRF가 강제 의무가 아닌 자율 권고. 학내 평가 체계가 OA를 보상하지 않음 → "왜 확인해야 하는데?" 동기 부족.
- **OA.Report (B&MG Gates Foundation, $1.8M 펀딩)**: 펀더 관점 컴플라이언스 추적 도구로 B2B 모델 검증됨. ScholarLink는 "연구자 + 기관 + 펀더" 3축으로 더 넓게.

| 섹션 | 변경 (v1.3 → v1.4) |
|---|---|
| §14 | ~~사용자 온보딩 & 교육 콘텐츠~~ → **촉매 역할 + 아웃바운드 (§14 신규)** |
| §15 | ~~5단계 퍼널 + 인센티브 + 한국형 유통~~ → **3단계 아웃바운드 깔때기 (§15 신규)** |
| §16 | ~~DAU/리텐션/뱃지 KPI~~ → **외부 클릭률/read-through/인용 KPI (§16 신규)** |

---

## v1.2 갱신 (실시간 소스 발견)

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

---

## 14. 촉매 역할 & 외부 연결 (Awareness Catalyst & Outbound Bridge)

> **왜 이 섹션이 재작성되는가**: v1.3에서는 "이 사이트가 사용자에게 모든 걸 가르친다"는 전제로 자체 호스팅 용어집(15개), FAQ(12선), 5단계 온보딩 위저드를 설계했다. **사용자 방향성 (2026-06-29 22:14)**: "**깊이있는 학문적 논의는 확장되는 추가 커뮤니티가 필요**하다. 촉매로써의 역할을 강화하고, 깊이있는 논의는 **블로그로의 전환까지가 이 사이트의 기능**". 즉:
>
> - ❌ 이 사이트는 백과사전/위키가 **아니다**
> - ❌ 이 사이트는 사용자 커뮤니티/포럼/댓글 시스템이 **아니다**
> - ✅ 이 사이트는 **촉매(catalyst)**다 — verdict 카드를 보고 사용자가 **외부에서 일어나는 깊은 논의로 자연스럽게 흘러가게** 만드는 것
> - ✅ 깊이 있는 글은 **ScholarLink 블로그**(월 2편, 자체 호스팅)로, 그 너머의 토론은 **외부 커뮤니티**(Plan S, OASPA, cOAlition S, NRF Q&A 등)로 안내

### 14.1 역할 경계 (Scope Boundary) — 핵심 원칙

| 범위 | 이 사이트가 함 | 이 사이트가 안 함 |
|---|---|---|
| **탐지 (Detection)** | DOI 1건 verdict (5초) | — |
| **인지 (Awareness)** | verdict 카드의 "이 결과가 내 펀더 정책과 어떤 관계인지" 1줄 인사이트 | — |
| **촉발 (Trigger)** | verdict 카드에서 "이 이슈에 대해 더 알고 싶다면" CTA | — |
| **가벼운 가이드** | "내 NRF 과제 미준수 시 즉시 행동 3가지" 같은 짧은 체크리스트 (in-card, 4줄 이내) | — |
| **블로그 (Depth Blog)** | ScholarLink 팀이 직접 작성한 촉매 콘텐츠 (월 2편, 800~1,500자) | 사용자 작성/댓글 외 기여 |
| **연결 (Bridge)** | 외부 깊은 논의처(Plan S 포럼, OASPA, cOAlition S, 학회 ML) 링크 | 자체 포럼/댓글/Q&A 시스템 운영 |
| ❌ **위키/용어집** | — | 자체 호스팅 glossary, /help/* 페이지 |
| ❌ **FAQ 호스팅** | — | 사이트 내 FAQ 페이지 |
| ❌ **커뮤니티** | — | 사용자 간 토론, 댓글, Q&A, 그룹, 팔로우 |
| ❌ **딥 콘텐츠** | — | Plan S 분석, cOAlition S 정책 해설 등 깊이 글 자체 |

**원칙 한 줄**: "**이 사이트에서 시작해서 밖으로 나간다**" — 사이트에 머무는 시간을 늘리는 게 목표가 아니다. **사용자가 한 번의 verdict 조회 후 관련 깊은 논의로 자연스럽게 흘러가게 만드는 것**이 목표.

### 14.2 In-app 촉매 트리거 — Verdict 카드 디자인

v1.2 §7.2의 verdict 카드를 **촉매 역할에 맞게 재설계**. **이 카드가 곧 사용자가 받는 거의 유일한 인앱 콘텐츠**:

```
┌────────────────────────────────────────────┐
│  ❌ NON_COMPLIANT                           │
│  Wellcome Trust 정책에 따라 미준수           │
│                                             │
│  이유: 라이선스 없음 (정책 요구: CC-BY)       │
│                                             │
│  ── 이 결과에 대해 더 알고 싶다면 ─────────  │
│                                             │
│  📝 [ScholarLink 블로그]                     │
│     "CC-BY 라이선스의 진짜 의미 —            │
│      한국 연구자를 위한 안내"                │
│     → scholarlink.app/blog/cc-by-meaning    │
│                                             │
│  💬 [Plan S 커뮤니티]                        │
│     "이 verdict의 정책 원문 토론 보기"       │
│     → discuss.coalition-s.org/wellcome      │
│                                             │
│  📚 [cOAlition S 정책 원문]                  │
│     → coalition-s.org/plan-s-principles      │
│                                             │
│  🇰🇷 [한국 NRF 학술연구정책]                  │
│     → nrf.re.kr/page/oa-policy              │
│                                             │
│  ────────────────────────────────────────  │
│  📤 공유 링크   📋 결과 PDF                  │
└────────────────────────────────────────────┘
```

**핵심**: verdict 카드 안에 **외부로 향하는 3~5개 링크** (블로그 1개 + 외부 커뮤니티/원문 3~4개). 사용자가 verdict를 본 후 깊은 논의로 자연스럽게 이동. **클릭 1번에 외부로**.

### 14.3 In-app 가벼운 도움말 — 1줄 인라인 툴팁만 (모달/페이지 없음)

v1.3 §14.3의 3-tier 도움말 매트릭스 → **인라인 툴팁 1줄로 축소**. 사이트 내 도움말 페이지 8개 → **0개로**.

| UI 요소 | 인라인 툴팁 (1줄만) | 외부 링크 (verdict 카드 하단 통합) |
|---|---|---|
| DOI 입력 박스 | "DOI 10.xxxx/xxxx 입력. PMID/arXiv도 가능" | doi.org (DOI 시스템) |
| Verdict 배지 | "이 DOI가 펀더 정책에 부합하는지 판정" | 블로그 글 "verdict 4종 어떻게 읽는가" |
| CC-BY 배지 | "CC-BY: 가장 개방적 라이선스. Plan S 표준" | creativecommons.org/licenses/by/4.0 |
| embargo 0개월 | "출판 후 OA 공개까지 유예 기간" | cOAlition S FAQ (외부) |
| oa_status (gold/green) | "OA 경로. gold=출판사, green=리포지토리" | Plan S Principles (외부) |
| ORCID | "ORCID 0000-0000-0000-0000. 본인만 체크 권장" | orcid.org |
| 펀더 | "Crossref Funder Registry의 펀더" | crossref.org/funderregistry |
| Rate limit 표시 | "분당 30건. 잠시 후 다시 시도" | — |

**별도 도움말 페이지(`/help/*`) 0개**. 인라인 툴팁 + verdict 카드의 외부 링크로 충분. **외부 링크도 페이지 단위가 아니라 verdict 카드 안에 인라인으로 통합** — 페이지 이동 1회로 외부 도달.

### 14.4 Onboarding — 1단계로 축소 (5단계 → 1단계)

v1.3 §14.5의 5단계 위저드 → **첫 DOI 체크 후 verdict 카드를 보여주는 1단계**:

```
┌────────────────────────────────────────────┐
│  첫 DOI 체크                                 │
│                                              │
│  [DOI 입력: 10.1038/...] [체크]              │
│                                              │
│  ── 1초 후 ──                                │
│                                              │
│  ❌ NON_COMPLIANT                            │
│  Wellcome Trust 정책 미준수                  │
│  ...                                         │
│  [블로그 글 보기] [외부 토론 보기] [다음 DOI] │
└────────────────────────────────────────────┘
```

**원칙**: 위저드는 "이 도구가 뭘 해주는지" 보여주는 데 그침. 5분짜리 인포그래픽/FAQ는 사이트 안에 둘 필요 없음. **블로그 글 1개 + verdict 카드 1개**로 모든 학습 곡선 처리.

**A/B 테스트 가설 (v1.4)**: 위저드 완주율 60% 가설(v1.3) 폐기. **1단계로 줄이면 완주율 90%+ 자연 달성** (verdict 자체가 학습의 시작점). 측정: verdict 후 외부 링크 CTR (다음 §15).

### 14.5 FAQ — 사이트 내 호스팅 폐기, 블로그 시리즈로 전환

v1.3 §14.4의 FAQ 12선 (사이트 호스팅) → **블로그 "질문 모음" 시리즈로 전환**:

**`/blog/series/oa-faq`** (월 1편 발행, 1편 = 3~5개 Q&A):

| Q | A (요약) | 외부 심화 링크 |
|---|---|---|
| DOI/PMID/arXiv 어느 것을 입력하나요? | ScholarLink는 3가지 모두 지원 | doi.org, pubmed.ncbi.nlm.nih.gov |
| "PARTIAL" vs "NON_COMPLIANT"? | PARTIAL=혼합, NON_COMPLIANT=전부 미준수 | — |
| "UNCLEAR"가 나왔어요 | 펀더 메타데이터 부족. 직접 추가 가능 | crossref.org/funderregistry |
| NRF는 Plan S 미가입? | 2026-06 기준 미가입. 권고 수준 | nrf.re.kr |
| 어떻게 OA로 만들 수 있나요? | Green/Gold/Hybrid 3가지 경로 | Plan S Routes, OASPA |
| ROARMAP에 내 기관이 없어요 | 한국 30대 기관 수동 매핑 | ROARMAP |
| 내 ORCID 일괄 체크는 안전한가요? | ORCID는 공개. 본인 외는 감사 로그 | orcid.org |
| 다른 도구와 결과가 다르면? | 다중 소스 교차 검증 | JCT API, OpenAlex |
| verdict는 영원히 유효? | 평균 90일 캐시, 재검증 권장 | — |
| 모바일 동작? | DOI 단일 체크 최적화. ORCID 일괄은 데스크톱 | — |
| 내 데이터 처리? | DOI 단일 = 비저장. ORCID = 7일 캐시 | 개인정보처리방침 |
| (계속 추가) | | |

**장점**:
- 사이트 내 12개 Q&A 페이지 빌드/유지보수 비용 0
- 블로그 글 1개 = SEO 가산점 (12개 Q&A가 검색 유입)
- 외부 심화 링크 자연스럽게 포함
- 댓글 시스템 자체 운영 불요 (블로그 글 자체에 외부 토론처 명시)

### 14.6 빈 상태(Empty State) — 인라인 처리

| 화면 | 빈 상태 콘텐츠 (인라인, 1줄~3줄) |
|---|---|
| DOI 입력 전 | "DOI 10.xxxx/xxxx 입력. 예: 10.1038/s41586-020-2649-2" |
| 결과 없음 | "이 DOI는 Crossref에 없습니다. 직접 추가 [양식] 또는 doi.org에서 확인" |
| ORCID 결과 0건 | "이 ORCID에 공개 논문이 없습니다. ORCID 프로필에서 'Works' 공개 확인" |
| 펀더 없음 | "이 논문은 Crossref에 펀더 정보가 없습니다. 직접 추가 [양식]" |
| 에러(5xx) | "잠시 후 재시도. status.scholarlink.app에서 확인" |
| rate limit 초과 | "분당 30건. 30초 후 재시도" |

페이지 단위 도움말 0개. 인라인 메시지만.

### 14.7 i18n (다국어) — verdict 카드 + 툴팁만

`i18n/dictionary.ts` 확장. **verdict 라벨 + 1줄 툴팁 + verdict 카드 외부 링크 라벨**만. 자체 콘텐츠 페이지(용어집/FAQ/위저드) 없으므로 i18n 키 200+ → **20개로 축소**.

```typescript
// i18n/dictionary.ts — v1.4 축소
compliance: {
  title: 'OA 정책 준수 체크' | 'OA Policy Compliance Check',
  subtitle: '5초 안에 내 논문의 펀더/기관 정책 준수 여부' | '...',
  verdict: {
    COMPLIANT: '✅ 준수' | '✅ Compliant',
    NON_COMPLIANT: '❌ 미준수' | '❌ Non-Compliant',
    PARTIAL: '⚠️ 부분 준수' | '⚠️ Partial',
    UNCLEAR: '❔ 판단 불가' | '❔ Unclear',
  },
  cta: {
    checkDoi: 'DOI 체크' | 'Check DOI',
    share: '공유' | 'Share',
    copy: '링크 복사' | 'Copy Link',
    learnMore: '이 이슈에 대해 더 알고 싶다면' | 'Learn more about this',
    readOnBlog: '블로그에서 읽기' | 'Read on our blog',
    discussExternal: '외부 커뮤니티 토론 보기' | 'Discuss in community',
    readPolicy: '정책 원문 보기' | 'Read policy',
  },
  tooltips: { /* 8개 UI 요소별 1줄만 */ },
}
```

### 14.8 콘텐츠 마케팅 — ScholarLink 블로그 (촉매 콘텐츠)

`/blog` 경로, **자체 호스팅** (Markdown → SSG 또는 Vite 페이지). **이 사이트의 유일한 "콘텐츠 자산"**. **월 2편 발행** (한국어 우선, 영어 1주 지연).

#### 14.8.1 블로그 글의 정확한 역할 — 촉매, 딥 콘텐츠 아님 (v1.5 업데이트)

| 역할 | 함 | 안 함 |
|---|---|---|
| **촉발 (Trigger)** | verdict 결과를 받아 "왜 이렇게 나왔는지" 1,000자 내외 설명 | 정책 전체 해설, 학술 분석 |
| **번역 (Bridge Translation)** | Plan S / cOAlition S / OASPA 최신 글을 한국어로 1단락 요약 + 외부 링크 | — |
| **큐레이션 (Curated List)** | "이번 달 OA 정책 5건" — 외부 글 링크 + 1줄 코멘트 | 자체 분석 |
| **액션 가이드** | "이 verdict 받으면 즉시 할 3가지" 체크리스트 (4줄 이내) | — |
| **★ v1.5 신규: 질문 트래거의 답변** | 모든 블로그 글은 §14.8.6의 **핵심질문 트래거의 1개 이상의 질문에 연결** (relatedArticles frontmatter) | — |
| ❌ **딥 분석** | — | Plan S 원칙 5,000자 해설, 정책 비교 10개 항목 등 |
| ❌ **토론** | — | 댓글, Q&A, 의견 교환 |
| ❌ **뉴스 자체 생산** | — | 자체 취재, 1차 정보 |

**글의 80%는 외부 링크로 끝난다**. "여기서 더 읽으세요"가 매 글의 마무리가 됨.

**v1.5 추가 — 질문 트래거와의 관계**: 모든 블로그 글은 **하나 이상의 핵심질문(§14.8.6)에 매핑**됨. 시간순 글 발행이 아니라 **질문 트래거의 status 진화에 따른 발행**이 됨. 발행 시 글 frontmatter에 `questions: [slug]` 추가 → 질문 페이지에 자동으로 "관련 글" 표시.

#### 14.8.2 글 유형 4가지 + 질문 트래거 발행 모델 (v1.5 업데이트)

| 유형 | 형식 | 예시 | 분량 | 빈도 | 연결 질문 (v1.5) |
|---|---|---|---|---|---|
| **① 이슈 해설** | "이 verdict/질문이 나온 이유" 시리즈 | "한국 NRF가 Plan S에 안 들어가는 이유" | 800~1,200자 | 월 1편 | 🔴 Open → 🟡 또는 🟢 Resolved 종합 |
| **② 외부 자료 큐레이션** | "이번 달 Plan S / cOAlition S 새 글" | "OASPA 6월: Plan S 신규 FAQ — 핵심 Q&A 3가지" | 600~1,000자 | 월 1편 | 🟡 In progress 중인 질문의 심화 |
| **③ 실데이터 분석** | "ScholarLink 데이터로 본 한국 OA 현황" | "한국 50대 기관 OA 준수율 — 어느 대학이 Plan S 도입 시 가장 큰 영향?" | 1,200~1,500자 | 격월 1편 | 🔴 Open (한국 정책 질문) |
| **④ 사용자 액션 가이드** | "이 verdict를 받은 후 3가지 행동" | "NRF 과제 논문이 미준수일 때 — 즉시 행동 3가지" | 400~600자 | 비정기 | 🟡 In progress (verdict 연결 질문) |

**월 발행 2편의 발행 모델 (v1.5)**:
- 1편 = 🟡 활발한 질문 1개에 대한 분석/큐레이션
- 1편 = 🔴 신규 질문 등록 시 소개 또는 🟢 Resolved 종합
- **모든 글은 §14.8.6의 질문 트래거에 자동 연결** (frontmatter questions 필드)

**글 구조 (모든 글 동일, v1.5 추가)**:
1. **첫 1~2줄** — 이 verdict/이슈가 왜 지금 중요한지 (촉매)
2. **★ v1.5 신규**: **관련 질문 링크** (질문 페이지로)
3. **본문 60~70%** — 1,000자 이내로 압축
4. **마지막 30~40%** — "더 깊이 보고 싶다면" 외부 링크 3~5개

→ **블로그 글이 외부 깊은 논의의 다리** 역할. **v1.5 추가**: 모든 글은 **질문 트래거의 status 진화를 반영**하며, **시간이 지날수록 관련 글이 누적**되어 가치가 compound됨.

#### 14.8.3 블로그 + 질문 트래거 → 외부 연결 다이어그램 (v1.5 업데이트)

```
verdict card (5초)
      ↓
"이 이슈에 대해 더 알고 싶다면" 4개 링크
      ↓
[ScholarLink 블로그 글] (1,000자, 1~2분 읽기)
      ↓                            ↓
[관련 질문 페이지] (영구 reference)        [Plan S 원문]
      ↓                            [cOAlition S 포럼]
[ScholarLink verdict 기능]              [OASPA 분석]
      ↓                            [NRF Q&A]
(verdict_wellcome 등)                [Twitter #PlanS]
      ↓                                  [Creative Commons]
(externalDiscussions 영구 추적)            [ROARMAP]
[Plan S forum]                              ↓
[OASPA blog]                       (사용자는 외부에서 깊은 논의)
[NRF Q&A]                               (ScholarLink은 다리 역할만)
      ↓
(status 변경 근거, 🟢 Resolved 시)
      ↓
질문 페이지 status: 🔴 → 🟡 → 🟢 진화
(scholarlink.app/questions/[slug] 영구 보존)
```

**핵심 (v1.5)**: 질문 페이지가 **시간이 지날수록 외부 thread URL을 누적**하고, status가 진화. **단일 reference page가 compound value를 가짐**. ScholarLink은 다리 역할만 하고, 깊은 논의는 외부에서.
   (ScholarLink 재방문 = 새 DOI 체크 시)
```

**핵심**: ScholarLink 블로그에서 외부로 나가는 링크가 **모든 글마다 3~5개**. 한 사용자가 1편의 블로그 글을 끝까지 읽으면, 평균 2~3개 외부 사이트를 방문하게 됨. → **외부 유입의 시작점**.

#### 14.8.4 블로그 자체 디자인 (가벼움 유지)

- SSG (Astro 또는 Vite SSG) — `client/blog/` 경로
- Markdown 파일 + frontmatter (date, slug, tags, language, externalLinks)
- RSS + Atom + JSON Feed 동시 제공
- 한국어/영어 모두 발행 (영어 1주 지연)
- 댓글 시스템 **자체 운영 없음** — Disqus/Giscus 안 붙임
  - 이유: 1인 운영에 과부하 + "토론은 외부에서"라는 사이트 정체성 일관성
  - 대신 글 하단에 "이 글에 대해 논의하려면" 외부 링크 3~5개 (v1.4 §15.5 참조)

#### 14.8.5 블로그 도구 비교 및 선정 (v1.4 신규 — 사용자 요청)

> **왜 비교가 필요한가**: §14.8.1~§14.8.4에서 "SSG로 직접 빌드"라고만 했지만, 실제 도구 선택은 SEO/성능/유지보수/i18n/syndication에 큰 영향을 미친다. v1.4 사용자 요청(2026-06-29 22:24)에 따라 후보 12개를 정량 비교하고, **v1.4 권장 조합**을 명시.

##### 14.8.5.1 후보 풀 (12개)

| 분류 | 후보 | 핵심 특성 |
|---|---|---|
| **SSG (Static Site Generator)** | Astro | 콘텐츠 특화, 0 JS 기본, MDX/i18n/RSS 빌트인 |
| | Hugo | Go 기반, **빌드 가장 빠름** (1,000 페이지도 수초) |
| | Jekyll | Ruby, GitHub Pages 네이티브 |
| | 11ty (Eleventy) | JS 기반, 단순, blog 친화 |
| | Hexo | Node.js, 한국 개발자 다수, 한국어 자료 풍부 |
| | Gatsby | React 기반, 플러그인 풍부 (오버킬 가능) |
| **호스트형 CMS** | Ghost (self-hosted) | 오픈소스 CMS, 뉴스레터/RSS/i18n 빌트인 |
| | Ghost (Pro) | 매니지드 호스팅, $9~25/mo |
| | Hashnode | 개발자 특화, 무료, 자체 도메인 지원 |
| | Substack | 무료, 10% cut on paid (유료 미적용 시 0%) |
| | Beehiiv | 뉴스레터 특화, growth features 강함 |
| | Medium | 무료, reach 최대, syndication, RSS 없음 |
| **한국형 호스트** | 브런치 (brunch.co.kr) | 카카오 자회사, 글잎/유료 글, RSS 제한 |
| | 티스토리 (tistory.com) | 무료, HTML 편집 가능, RSS 제공, Kakao 계정 통합 |
| | 네이버 블로그 | reach 최대, RSS 있음, 커스터마이징 제한 |
| | 워드프레스.com | 무료 티어 제한, .com 도메인 |

##### 14.8.5.2 정량 비교 매트릭스 (v1.4 ScholarLink 기준)

| # | 도구 | 월 비용 | KR/EN i18n | RSS/Atom | syndication | SEO 강도 | 유지보수 | 1인 운영 적합도 |
|---|---|---|---|---|---|---|---|---|
| 1 | **Astro + Cloudflare Pages** | **$0** | ✅ 빌트인 (content collections) | ✅ 빌트인 | ✅ RSS → 자동 | ⭐⭐⭐⭐⭐ (정적 HTML, Lighthouse 95+) | 🟢 매우 낮음 (Markdown push만) | ⭐⭐⭐⭐⭐ |
| 2 | Astro + GitHub Pages | $0 | ✅ | ✅ | ✅ | ⭐⭐⭐⭐⭐ | 🟢 매우 낮음 | ⭐⭐⭐⭐⭐ |
| 3 | Astro + Netlify | $0 (free tier) | ✅ | ✅ | ✅ | ⭐⭐⭐⭐⭐ | 🟢 매우 낮음 | ⭐⭐⭐⭐⭐ |
| 4 | Hugo + Cloudflare Pages | $0 | △ (수동 분리 필요) | ✅ | ✅ | ⭐⭐⭐⭐⭐ | 🟢 낮음 | ⭐⭐⭐⭐ |
| 5 | Jekyll + GitHub Pages | $0 | △ | ✅ | ✅ | ⭐⭐⭐⭐ | 🟡 중간 (Ruby 의존성) | ⭐⭐⭐ |
| 6 | 11ty + Cloudflare Pages | $0 | △ | ✅ | ✅ | ⭐⭐⭐⭐ | 🟢 낮음 | ⭐⭐⭐⭐ |
| 7 | Hexo + Cloudflare Pages | $0 | ✅ (한국어 자료 多) | ✅ | ✅ | ⭐⭐⭐⭐ | 🟢 낮음 | ⭐⭐⭐⭐ |
| 8 | Ghost (self-hosted on Render) | **$7/mo** (Render Starter) | ✅ (i18n 빌트인) | ✅ | ✅ 이메일 뉴스레터 | ⭐⭐⭐⭐ (DB 의존) | 🟡 중간 (DB/Theme 업데이트) | ⭐⭐⭐ |
| 9 | Ghost (Pro) | $9~25/mo | ✅ | ✅ | ✅ | ⭐⭐⭐⭐ | 🟢 낮음 (매니지드) | ⭐⭐⭐⭐ |
| 10 | Hashnode | $0 | ✅ | ✅ | ✅ 자체 도메인 | ⭐⭐⭐ | 🟢 낮음 | ⭐⭐⭐ (개발자 특화) |
| 11 | Substack | $0 (유료 글 시 10%) | ✅ | ❌ (RSS 약함) | △ 제한 | ⭐⭐ (도메인 잠김) | 🟢 매우 낮음 | ⭐⭐⭐ (RSS 부재가 결정적) |
| 12 | Medium | $0 | ✅ | ❌ (RSS 없음) | △ | ⭐⭐⭐⭐ (reach) | 🟢 매우 낮음 | ⭐⭐ (RSS 부재) |
| 13 | 브런치 (brunch.co.kr) | $0 | 한국어 only | △ (제한) | △ (syndication 약함) | ⭐⭐ (Kakao 자회사 SEO) | 🟢 매우 낮음 | ⭐⭐⭐ (KR 단독) |
| 14 | 티스토리 (tistory.com) | $0 | 한국어 위주 | ✅ | ✅ | ⭐⭐⭐ (네이버 SEO 강함) | 🟢 매우 낮음 | ⭐⭐⭐ |
| 15 | 네이버 블로그 | $0 | 한국어 only | ✅ | △ | ⭐⭐⭐⭐⭐ (네이버 검색) | 🟢 매우 낮음 | ⭐⭐ (커스터마이징 제한) |
| 16 | 워드프레스.com | $0~4/mo (paid tier) | ✅ | ✅ | ✅ | ⭐⭐⭐ | 🟡 중간 | ⭐⭐ (오버킬) |

##### 14.8.5.3 도구별 상세 장단점

**1. Astro** (⭐ **v1.4 1순위 추천**)

| 장점 | 단점 |
|---|---|
| **2025-2026 콘텐츠 사이트 표준** — Astro 5.0 GitHub 59.2k+ stars, Netlify/Cloudflare/Vercel/Google/Microsoft採用 |  |
| **0 JS 기본** — Lighthouse/SEO 최강 (66% CWV 통과율 vs Next.js 30%, Gatsby 47%, WP 48%) | React/Vue 컴포넌트 임포트 시 약간의 학습곡선 |
| **Content Collections + i18n 빌트인** — 한국어/영어 블로그를 같은 코드베이스로 | — |
| **Markdown + MDX** — frontmatter 자유 (date, slug, tags, language, externalLinks 모두 OK) | — |
| **빌트인 RSS/Atom/JSON Feed** 생성 플러그인 (`@astrojs/rss`) | — |
| **이미지 최적화** (`astro:assets`) — 외부 링크 썸네일 자동 처리 | — |
| **Cloudflare Pages 무료 호스팅** — CDN/SSL 자동, 빌드 500/월 무료 (충분) | — |
| **Git push → 자동 빌드/배포** — 1인 운영 최적 | — |
| 한국어 자료 多 (한국 Astro 사용자 슬랙, 한국 Astro 책) | — |

**비용**: $0/월 (Cloudflare Pages 무료 티어: 빌드 500/월, 트래픽 무제한, 요청 100,000/일)
**유지보수**: 분기 1회 의존성 업데이트, Markdown 파일만 push

**2. Hugo** (v1.4 차선)

| 장점 | 단점 |
|---|---|
| **빌드 속도 최강** — 1,000 페이지도 1초 | Go 템플릿 (`.html` 직접 작성) — 한국어 자료 적음 |
| 단일 바이너리, 의존성 無 | i18n 수동 분리 (Astro보다 작업 多) |
| Cloudflare Pages/Netlify 무료 호스팅 | — |
| 한국어 자료는 Astro보다 적음 | — |

**3. Ghost (self-hosted on Render)** (옵션)

| 장점 | 단점 |
|---|---|
| **빌트인 뉴스레터 + 구독자 관리** — 추가 구현 불요 | **DB 필요** — Render Starter $7/mo (현재 인프라 $5/mo와 별도) |
| i18n 빌트인 (영어 UI, 한국어 포스트) | 유지보수: DB 백업, theme 업데이트, security patch |
| 마크다운/카드/shortcode 편집기 강력 | Astro보다 무거움 (Node.js + MySQL + nginx) |
| 자체 도메인, SEO 좋음 | 한국 SEO는 Astro보다 약함 |
| 회원/구독자 관리 (RSS + 이메일) | 댓글 시스템 별도 (또는 자체 운영 X) |

**비용**: $7/mo (Render Starter, 이미 Render $5/mo 사용 중 → 통합 시 $7~12/mo)
**유지보수**: 분기 1회 보안 업데이트, DB 백업 자동화, theme 업데이트

**4. Substack** (비추천 — RSS 부재)

| 장점 | 단점 |
|---|---|
| **무료 + 설정 0** | **RSS/Atom 없음** (외부 syndication 불가 — 촉매 역할에 결정적 결함) |
| 뉴스레터 자동 발송 | 도메인 잠김 (substack.com 도메인) |
| | 한국어 UI 약함 |
| | Substack가 정책 변경 시 통제권 없음 |

**비용**: $0/월 (유료 구독 시 10% 수수료)
**v1.4 비추천 이유**: RSS 부재 = 촉매 역할 불가. 외부 사이트 syndication이 안 됨.

**5. 브런치 (brunch.co.kr)** (KR syndication 채널로만 활용)

| 장점 | 단점 |
|---|---|
| 한국어 글 품질 인식 높음 (Kakao 자회사) | **자체 도메인/앱 외 RSS 제한** |
| 글잎 시스템 (유료) | 한국어 only (영어 발행 불가) |
| 자체 syndication 기능 없음 (canonical link 설정으로 우회) | — |
| **syndication 목적지로 추천** (메인 블로그는 Astro) | 메인 블로그로 부적합 |

**비용**: $0/월

**6. 티스토리 (tistory.com)** (옵션)

| 장점 | 단점 |
|---|---|
| 무료, RSS 제공, HTML 편집 가능 | 디자인 시스템 일부 old-fashioned |
| **네이버 SEO 매우 강함** (네이버 자회사) | 영어 발행 시 SEO 약함 |
| 댓글 자체 운영 가능 (단, 촉매 원칙상 미사용) | syndication 약함 |
| Kakao 계정 통합 | — |

**7. Hashnode** (옵션)

| 장점 | 단점 |
|---|---|
| **자체 도메인 지원** + RSS/Atom/JSON Feed | **개발자 특화** — 학술 글 audience 부적합 |
| 무료, syndication 좋음 | 한국어 자료 적음 |
| 매니지드 (유지보수 0) | — |

##### 14.8.5.4 비용 시나리오 (3가지 옵션 → 사용자 결정 반영)

| 옵션 | 스택 | 월 비용 | SEO | syndication | 유지보수 |
|---|---|---|---|---|---|
| **A. 메인 + KR syndication** (⭐ v1.4 확정) | **Astro + Cloudflare Pages** (메인 scholarlink.app/blog) + **브런치** (KR 유입) | **$0** | ⭐⭐⭐⭐⭐ | ✅ | 🟢 매우 낮음 |
| **B. 메인 + Ghost + KR syndication** (옵션, 미채택) | **Ghost on Render** (메인) + **브런치** (KR) | **$7** (Render) | ⭐⭐⭐⭐ | ✅ 이메일 뉴스레터 | 🟡 중간 |
| **C. 한국 SEO 우선** (미채택, **syndication 채널로 활용**) | **티스토리** (메인) + Astro 보조 | **$0** | ⭐⭐⭐⭐ (네이버 강함) | ✅ | 🟢 낮음 |

**v1.4 최종 확정 (사용자 결정 2026-06-29 22:28)**: **옵션 A 채택 + 옵션 C의 티스토리를 syndication 채널로 추가**. 즉:
- 메인 = Astro (옵션 A)
- syndication = 브런치(옵션 A) + **티스토리(옵션 C)** + 미디엄(EN)
- 티스토리는 메인 블로그가 아니라 **Astro 콘텐츠를 복제하여 발행하는 syndication 채널**

##### 14.8.5.5 v1.4 최종 확정 — **옵션 A (메인) + 브런치/티스토리/미디엄 syndication**

**선정 이유**:

1. **$0/월** — 이미 Render $5/mo + Neon 무료 사용 중. 추가 비용 0. ScholarLink 1인 운영의 비용 원칙과 부합.
2. **촉매 역할에 최적** — RSS/Atom/JSON Feed 빌트인, 외부 syndication (브런치/티스토리/미디엄) 가능. Substack/Ghost 대비 외부 연결성이 압도적.
3. **SEO 최강** — 정적 HTML + 0 JS + Lighthouse 95+ → Google/네이버 검색 모두 유리.
4. **유지보수 분기 1회** — Markdown 파일 push만. 1인 운영에 완벽.
5. **KR/EN i18n 빌트인** — Content Collections + i18n routing 모두 지원. 영어 1주 지연 발행 패턴 쉬움.
6. **Git 워크플로우** — 학계 사용자에게 친숙 (논문/코드와 같은 Git 기반).
7. 한국어 자료 충분 — 한국 Astro 사용자 커뮤니티 多.
8. **티스토리 syndication 추가 (v1.4 확정)** — 네이버 SEO 최강 + RSS 발행 가능. 브런치(Kakao 자회사 audience)와 채널 역할 분담.

**구현 계획** (Phase 2, Week 4~5):
```
/blog
  ├── content/
  │   ├── posts/
  │   │   ├── 2026-07-01-cc-by-meaning.md          (KR, canonical)
  │   │   ├── 2026-07-01-cc-by-meaning.en.md       (EN, 1주 지연)
  │   │   ├── 2026-07-15-korea-nrf-vs-plan-s.md    (KR)
  │   │   └── ...
  │   └── config.ts                                (frontmatter schema)
  ├── src/
  │   ├── pages/
  │   │   ├── index.astro
  │   │   ├── [lang]/
  │   │   │   ├── index.astro                      (i18n routing)
  │   │   │   └── posts/[slug].astro
  │   │   └── rss.xml.ts                            (RSS feed)
  │   └── components/
  │       ├── PostCard.astro
  │       ├── ExternalLinks.astro                   (v1.4 §15.4 매핑)
  │       └── SyndicationFooter.astro               (브런치/티스토리/미디엄 복제 안내)
  ├── astro.config.mjs
  └── package.json
```

**Cloudflare Pages 설정**:
- 빌드 명령: `astro build`
- 출력 디렉토리: `dist/`
- 환경변수: `SITE_URL=https://scholarlink.app/blog`
- 자동 배포: `main` 브랜치 push 시

**syndication 워크플로우** (월 2편, v1.4 확정 4채널, v1.5 질문 트래거 통합, **v1.6 광고/인트로 통합**):
```
★ Step 0. v1.5 신규 — 질문 트래거 업데이트 (글 발행 전 필수)
        ├─ 이 글의 주제에 해당하는 질문이 트래거에 있는지 확인
        │  → /blog/questions/index.astro (전체 질문 목록)
        │
        ├─ 기존 질문에 연결: 글 frontmatter에 questions: [slug] 추가
        │  → 질문 페이지에 자동으로 "관련 글" 표시
        │
        └─ 신규 질문 등록 (해당 질문이 트래거에 없는 경우):
           → content/questions/[category]/[slug].md 신규 작성
           → status: 🔴 Open 또는 🟡 In progress
           → externalDiscussions 초기 입력
           → §14.8.6.10 자동화 후보 트리거 (RSS, 사용자 피드백, verdict UNCLEAR)

★ Step 0.5. v1.6 신규 — 광고/인트로 통합 확인 (글 발행 전 필수)
        ├─ Astro Layout (`PostLayout.astro` / `QuestionLayout.astro`) 에
        │  TopAdBanner + BottomAdBanner + ScholarLinkIntro 자동 import 확인
        │  → 별도 작업 불요 (Layout이 자동 통합)
        │
        ├─ syndication 텍스트 fallback: 브런치/티스토리/미디엄 발행 시
        │  본문 첫 100자 안에 ScholarLink 인트로 텍스트 직접 삽입
        │  (Astro에는 자동, syndication에는 수동)
        │
        └─ bidvibe 광고는 Astro(메인) + 티스토리(HTML 모드)만 가능
           → 브런치/미디엄은 Kakao/Medium 정책상 광고 삽입 불가, 인트로만 가능
           → §14.8.7.4 채널별 삽입 매트릭스 참조

Step 1. KR Markdown 작성 (canonical)
        (Astro content/posts/2026-07-01-cc-by-meaning.md)
        → frontmatter.questions: [what-is-plan-s] (★ v1.5)
        → 본문 첫 줄에 "관련 질문: [질문 페이지 링크]" 추가 (★ v1.5)
        → 외부 링크 3~5개 포함 (Plan S, OASPA, CC, NRF, cOAlition S)

Step 2. Git push → Astro build → Cloudflare Pages 자동 배포
        → scholarlink.app/blog/cc-by-meaning (canonical URL)
        → RSS/Atom/JSON Feed 자동 갱신
        → ★ v1.5: /blog/questions/index.astro에 relatedArticles 카운트 자동 갱신
        → ★ v1.5: 질문 페이지에 "관련 글" 자동 추가

Step 3. 1주 후 EN Markdown 작성
        (Astro content/posts/2026-07-01-cc-by-meaning.en.md)
        → scholarlink.app/en/blog/cc-by-meaning
        → canonical = KR 포스트
        → frontmatter.questions 동일 (★ v1.5)

Step 4. KR syndication (24시간 이내, 한국 시간 기준)
        ├─→ 브런치 (brunch.co.kr) 60~70% 본문 + canonical link
        └─→ 티스토리 (tistory.com) 60~70% 본문 + canonical link
            ※ 티스토리 발행 시 HTML 모드 사용 (canonical <link> 태그 삽입 가능)
            ※ 본문 첫 줄 또는 말미에 "원문: scholarlink.app/blog/[slug]" 명시
            ※ ★ v1.5: syndication 글에도 "관련 질문" 섹션 포함

Step 5. EN syndication (Astro EN 발행 후)
        └─→ 미디엄 (medium.com) 60~70% 본문 + canonical link
            ※ 미디엄은 canonical = KR 또는 EN 본편 중 traffic 많은 쪽

Step 6. Twitter에 OG 카드 자동 트윗
        → @scholarlink_app, 외부 토론처 mention (Plan S, cOAlition S 등)
```

**티스토리 발행 가이드 (v1.4 신규, §15.9에서 상세)**:
- HTML 모드 사용 → `<link rel="canonical" href="https://scholarlink.app/blog/[slug]">` 삽입
- 본문 첫 줄: "원문: https://scholarlink.app/blog/cc-by-meaning" 명시
- 카테고리: 학술연구 / 오픈액세스 / 정책
- 태그: 오픈액세스, OA, PlanS, NRF, 학술정책 (3~5개)
- 발행 시간: 평일 오전 9~11시 (네이버 노출 최적)
- **중요**: 티스토리 글 자체에는 댓글 자체 운영 X (촉매 원칙 일관성). 글 하단 외부 토론처 링크만 표시.

**복제 정책 (canonical = Astro) — v1.4 확정**:
- **Astro (canonical)**: 본문 100% + 모든 외부 링크
- **브런치/티스토리/미디엄**: 본문 60~70% + 외부 링크 3~5개 + canonical link
- **Twitter**: OG 카드 + canonical URL + 1줄 인사이트
- **모든 syndication 글에는 "이 글에 대해 논의하려면" 외부 링크 3~5개 포함** (촉매 원칙)

##### 14.8.5.6 마이그레이션 안전망

- 모든 글은 **Git 히스토리**에 보존 (Astro는 Git 기반)
- 도구 변경 시 Markdown 파일만 새 도구로 import 가능 (Hugo/Jekyll/Eleventy 모두 Markdown 호환)
- **vendor lock-in 위험 0** — 정적 HTML이라 언제든 이전 가능
- Ghost/Tistory → Astro 이전 시: RSS export → Markdown 변환 (pandoc) → Astro import

##### 14.8.5.7 Substack / Ghost / Medium을 v1.4에서 **비추천**하는 이유

| 도구 | 결정적 결함 | 촉매 원칙 충돌 |
|---|---|---|
| Substack | RSS/Atom 거의 부재 (외부 syndication 불가) | "외부 연결" 촉매 역할 불가 |
| Ghost (Pro) | $9-25/mo 추가 비용 + DB 의존 | "추가 비용 0" 원칙 위배 + 유지보수 부담 |
| Ghost (self-host) | $7/mo + DB + theme 업데이트 | 1인 운영 부담 + 외부 RSS는 OK지만 Astro 대비 비용↑ |
| Medium | RSS 없음 + 도메인 잠김 + reach는 좋지만 syndication 약함 | "자체 도메인" 위배 + RSS 부재 |
| Hashnode | 개발자 특화, 한국 학술 audience 부적합 | 학술 콘텐츠 audience 미스매치 |
| 티스토리 | 디자인 old + 영어 SEO 약함 + syndication 약함 | 국제 reach 약함 (메인으로는 부적합, 보조 채널로 OK) |
| 네이버 블로그 | 커스터마이징 제한 + RSS 약함 + 네이버 외 reach 제한 | 글로벌 reach 불가 |
| 브런치 | 한국어 only + syndication 약함 | 메인 블로그로 부적합, **syndication 채널로만 OK** |
| 워드프레스 | 오버킬 + DB + 보안 패치 + 비용 | 1인 운영 부담 |

→ **메인 블로그 = Astro + Cloudflare Pages (1순위)**. Ghost는 예산 + 뉴스레터 니즈 강할 때만 고려. Substack/Medium/Hashnode/티스토리/네이버/브런치/워드프레스는 syndication 채널 또는 보조 채널로만 활용.

#### 14.8.6 핵심질문 트래거 (Living Issue Tracker) — v1.5 신규

> **왜 필요한가**: v1.4의 블로그는 "월 2편 발행"의 **콘텐츠 스트림**이었다. 시간순 글 목록은 발행 직후엔 가치가 있지만, 시간이 지나면 묻힌다. 사용자 추가 방향성 (2026-06-29 22:57): **"OA논문과 관련된 이슈 및 정책에 대한 핵심질문을 지속적으로 업데이트하고, 해결점에 대한 글과 논의가 진행되는 것이 블로그의 내용으로 추가되어야 한다"**.
>
> **핵심 통찰**: 블로그는 "글의 컬렉션"이 아니라 **"질문과 그 해결의 진행 상황"**을 다루는 살아있는 문서여야 한다. 글은 질문에 대한 답변/분석의 형태. 질문은 영구 reference. 시간이 지날수록 콘텐츠 가치가 **누적(compound)**된다.

##### 14.8.6.1 핵심질문 트래거의 5가지 역할

| 역할 | 설명 |
|---|---|
| **① 스파인(Spine)** | 모든 블로그 글의 뼈대. 글 = 질문에 대한 답변/분석/논의. 시간순 글 목록 외에 **주제 중심 reference** 제공 |
| **② 진행 상황 추적** | 각 질문이 🔴 Open / 🟡 In progress / 🟢 Resolved인지 status badge로 표시. 시간이 지나면서 status가 진화 |
| **③ 외부 논의 영구 연결** | 각 질문에 Plan S forum, OASPA, NRF Q&A 등 외부 토론 thread URL을 **영구 추적**. status 변경의 근거가 외부 토론에서 옴 |
| **④ SEO 영구 reference** | 단일 reference page가 누적되어 검색 유입의 1차 진입점. 발행 시점이 아닌 **누적 reference 가치** |
| **⑤ 콘텐츠 컴파운딩** | 새 글이 기존 질문에 추가되어 시간이 지날수록 가치가 증가. 한 질문에 5편, 10편이 누적되면 reference로서 압도적 가치 |

##### 14.8.6.2 디렉토리 구조 (Astro Content Collections)

```
/blog/questions/
  ├── index.astro                          ← 전체 질문 목록 (status별, 카테고리별)
  ├── [category]/
  │   ├── index.astro                      ← 카테고리별 목록
  │   └── [slug].astro                     ← 개별 질문 페이지
  └── ...

content/questions/
  ├── _meta.ts                             ← Astro Content Collection 스키마
  ├── funder-policy/
  │   ├── what-is-plan-s.md
  │   ├── why-nrf-not-join-coalition-s.md
  │   ├── nih-2024-public-access.md
  │   ├── wellcome-oa-policy-2021.md
  │   ├── ukri-vs-plan-s.md
  │   ├── erc-transformative-agreement.md
  │   ├── rights-retention-strategy.md
  │   ├── transformative-journals.md
  │   ├── dfg-why-not-coalition-s.md
  │   └── no-funder-policy.md
  ├── korean-policy/
  │   ├── when-korea-plan-s.md
  │   ├── kisti-vs-nrf.md
  │   ├── kaist-repository-deposit.md
  │   ├── nrf-actual-policy-2026.md
  │   ├── why-korean-researchers-lag.md
  │   ├── dbpia-riss-koreamed.md
  │   └── b2b-opportunity-korea.md
  ├── license/
  │   ├── cc-by-why-plan-s.md
  │   ├── cc-by-nc-vs-plan-s.md
  │   ├── cc-by-vs-cc-by-sa.md
  │   ├── cc0-when.md
  │   ├── publisher-contracts-license.md
  │   └── am-vs-vor.md
  ├── embargo/
  │   ├── why-embargo-exists.md
  │   ├── 0-month-embargo.md
  │   ├── nrf-12-months-why.md
  │   └── rrs-shorten-embargo.md
  └── infrastructure/
      ├── kaist-repository-howto.md
      ├── ir-role-plan-s.md
      ├── how-to-check-repo.md
      └── no-institutional-repo.md
```

##### 14.8.6.3 질문 페이지 Frontmatter 스키마 (Astro Content Collections)

```typescript
// content/questions/_meta.ts
import { defineCollection, z } from 'astro:content';

const questionsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),                    // "What is Plan S?"
    question: z.string(),                 // 짧은 질문 (한 줄)
    koreanQuestion: z.string().optional(), // 한국어 번역 (선택)
    category: z.enum(['funder-policy', 'korean-policy', 'license', 'embargo', 'infrastructure']),
    status: z.enum(['open', 'in-progress', 'resolved']),  // 🔴 / 🟡 / 🟢
    priority: z.enum(['high', 'medium', 'low']),
    createdAt: z.date(),
    updatedAt: z.date(),
    
    // ★ 핵심: 블로그 글과의 양방향 연결
    relatedArticles: z.array(z.string()).default([]),   // 글 slug 목록
    
    // ★ 핵심: 외부 토론 thread의 영구 추적
    externalDiscussions: z.array(z.object({
      title: z.string(),
      url: z.string(),
      lastChecked: z.date(),
      summary: z.string().optional(),    // 마지막 확인 시 요약
    })).default([]),
    
    // ★ 핵심: ScholarLink 기능과의 연결 (verdict 카드 외부 링크 매핑)
    relatedFeatures: z.array(z.string()).default([]),   
    // 예: ['verdict_wellcome', 'verdict_erc', 'route_gold_oa']
    
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { questions: questionsCollection };
```

##### 14.8.6.4 질문 카테고리 (5개, 초기 시드 30개)

| 카테고리 | 설명 | 초기 질문 수 | 예시 |
|---|---|---|---|
| **Funder Policy** | cOAlition S / Plan S / NIH / Wellcome / NRF / ERC / DFG | 10 | "What is Plan S?", "Why doesn't NRF join cOAlition S?", "NIH 2024 Public Access Policy — what changed?" |
| **Korean Policy** | NRF, KISTI, 한국 OA 정책 흐름, KORL/DBpia/RISS | 7 | "When will Korea adopt Plan S?", "How does KISTI compare to NRF?" |
| **License** | CC 라이선스, RRS, TA, TJ, AM vs VoR | 6 | "Why does Plan S require CC-BY?", "CC-BY-NC vs Plan S" |
| **Embargo** | Embargo 정책, 0/6/12/24개월, RRS로 단축 | 4 | "Why do embargoes exist?", "Can RRS shorten embargo?" |
| **Infrastructure** | 리포지토리 (KAIST/IR), DBpia, RISS, KoreaMed | 4 | "How do I deposit in KAIST Repository?", "What if no IR exists?" |
| **합계** | | **30개 (시드)** | 신규 질문은 분기 1~3개 추가 |

##### 14.8.6.5 Status 의미 + ScholarLink 자동 행동

| Status | Badge | 의미 | ScholarLink 행동 |
|---|---|---|---|
| 🟢 **Resolved** | 정책/답이 명확하고 외부 합의에 도달 | verdict 카드 외부 링크 풀에 **이 질문 페이지 추가** |
| 🟡 **In progress** | 분석 중, 외부 논의 진행 중 | 매월 1회 status 변경 후보 검토 (cron) |
| 🔴 **Open** | 답 모름, 신규 질문 | 신규 등록 시 분기 뉴스레터 + Twitter 자동 알림 |

**status 변경 워크플로우**:
1. 자동 cron (Phase 3+): 외부 thread 댓글/답변 감지 → status 변경 후보 표시
2. 수동 curator (Phase 2): 1인 운영자가 매주 status 검토 + 변경
3. 사용자 피드백: 댓글/이메일 → curator 검토 → status 변경 후보

##### 14.8.6.6 질문 ↔ 블로그 글 관계 모델 (v1.5 신규)

**핵심**: 매달 발행되는 2편의 블로그 글은 **임의 주제가 아니라, 질문 트래거의 status 진화에 연결됨**.

| 질문 status | 블로그 글 발행 빈도 | 글 유형 (§14.8.2 4유형) |
|---|---|---|
| 🔴 **Open** (신규 등록) | 1편 = 질문 소개 | ① 이슈 해설 (200자 요약) |
| 🟡 **In progress** (활발) | 월 1~2편 = 심층 분석 | ② 외부 자료 큐레이션 + ③ 실데이터 분석 |
| 🟢 **Resolved** (해결) | 1편 = 최종 정리 | ① 이슈 해설 (종합) |
| (질문과 무관한突发 이슈) | 분기 1편 | ② 외부 자료 큐레이션 (Plan S 신규 발표 등) |

**월 발행 2편의 예시** (8월 시나리오):
- 1편: "What is Plan S?" (🟡 In progress) → ② OASPA 6월 Plan S FAQ 큐레이션
- 1편: "When will Korea adopt Plan S?" (🔴 Open → 🟡 In progress 변경) → ① KISTI 신규 발표 분석

##### 14.8.6.7 초기 질문 30개 시드 (현실적 예시)

**Funder Policy (10개)**:
1. 🔴 What is Plan S and how does it work? (cOAlition S 가입 30+ 펀더 정책)
2. 🟡 Why doesn't NRF join cOAlition S? (한국 NRF 미가입 배경)
3. 🟢 NIH 2024 Public Access Policy — what changed? (2024년 7월 변경)
4. 🟢 Wellcome OA Policy 2021 — what does it require? (즉시 OA + CC-BY)
5. 🟡 How does UKRI's policy differ from Plan S? (UKRI는 1년 후 적용)
6. 🟡 What is the Rights Retention Strategy (RRS)? (저자 권리 보존)
7. 🟡 How are Transformative Journals (TJ) different from TA? (TA vs TJ)
8. 🟡 Why are some funders (e.g., DFG) not in cOAlition S? (독일/일본 정책 자율)
9. 🟡 What happens if my funder has no policy? (NRF 한국처럼)
10. 🔴 What is OSTI / DOE Public Access Plan 2024? (미국 에너지성 Plan S 채택)

**Korean Policy (7개)**:
1. 🔴 When will Korea adopt a Plan S-like mandate? (NRF 의무화 미정)
2. 🟡 How does KISTI's role compare to NRF in OA? (KISTI 인프라도 OAI-PMH)
3. 🟢 KAIST institutional repository — who can deposit? (KAIST IR 정책)
4. 🟡 NRF's actual OA policy 2026 — what does it require? (NRF 학술연구정책 원문 분석)
5. 🔴 Why do Korean researchers lag in OA compliance? (한국 38% vs 글로벌 60~75%)
6. 🟢 What is DBpia / RISS / KoreaMed's role? (3대 한국 학술 DB)
7. 🟡 Is there any B2B opportunity in Korea for ScholarLink? (도서관/IR 컨설팅)

**License (6개)**:
1. 🟢 Why does Plan S require CC-BY specifically? (가장 개방적 라이선스)
2. 🟢 Can I publish CC-BY-NC if my funder requires CC-BY? (불가, plan S 위반)
3. 🟢 What is the difference between CC-BY and CC-BY-SA? (SA는 동일조건)
4. 🟢 What is CC0 and when is it appropriate? (데이터/저장소에 적합)
5. 🟡 How do publisher contracts affect license choice? (출판사 양식, RRS로 대응)
6. 🟡 What is the difference between Accepted Manuscript and Version of Record? (AM vs VoR)

**Embargo (4개)**:
1. 🟢 Why do embargoes exist at all? (출판사 매출 보호)
2. 🟢 What does 0-month embargo mean in practice? (즉시 OA)
3. 🟡 Why does NRF recommend 12 months instead of 0? (한국 현실)
4. 🟢 Can I shorten embargo with RRS? (RRS로 0 가능)

**Infrastructure (4개)**:
1. 🟢 How do I deposit in KAIST Repository? (KAIST IR 절차)
2. 🟡 What is the role of institutional repositories in Plan S compliance? (Green OA 경로)
3. 🟡 How do I check if my paper is in a repository? (검색 절차)
4. 🟡 What if my institution has no repository? (대안: 분야별 리포지토리 arXiv 등)

**Total: 30 questions** (현실적 시드, 2026-07 기준)

##### 14.8.6.8 v1.4 글 발행 워크플로우 → v1.5 확장 (Step 0 추가)

```
Step 0. ★ v1.5 신규 — 질문 트래거 업데이트
        ├─ 신규 질문 발견 (외부 RSS, 사용자 피드백, verdict UNCLEAR 패턴)
        │  → /blog/questions/[category]/[slug] 신규 페이지 작성
        │  → status: 🔴 Open, priority 설정
        │  → externalDiscussions 초기 입력
        │
        └─ 기존 질문 status 변경 후보
           → /admin/questions 페이지에서 curator가 검토
           → status 변경 (🔴→🟡, 🟡→🟢)
           → externalDiscussions 추가/갱신
           → relatedArticles 매핑

Step 1. KR Markdown 작성 (canonical, Astro content/posts/)
        → 글 frontmatter에 questions: [질문 slug] 추가  ★ v1.5 신규
        → 본문에 "관련 질문: [질문 페이지로의 링크]" 자동 표시  ★ v1.5 신규
        → 외부 링크 3~5개 포함

Step 2. Git push → Astro build → Cloudflare Pages 자동 배포
        → /blog/posts/[slug] 발행
        → 질문 페이지에 자동으로 "관련 글" 추가 (frontmatter 매핑)
        → /blog/questions/index.astro도 자동 갱신 (relatedArticles 카운트)

Step 3. 1주 후 EN Markdown 작성 (Astro)
        → scholarlink.app/en/blog/[slug]
        → canonical = KR 포스트

Step 4. KR syndication (24h 이내, 한국 시간 기준)
        ├─→ 브런치 (canonical link 포함)
        └─→ 티스토리 (canonical link 포함)

Step 5. EN syndication (Astro EN 발행 후)
        └─→ 미디엄 (canonical link 포함)

Step 6. Twitter에 OG 카드 자동 트윗
        → "@scholarlink_app 새 글: [제목] [canonical URL] #PlanS #OA"
        → status 변경 시 별도 트윗: "Q: [질문] status 🔴→🟡 — [이유]"  ★ v1.5 신규
```

##### 14.8.6.9 예시: 질문 페이지 디자인 (마크다운 렌더링 결과)

```markdown
---
title: "What is Plan S?"
question: "Plan S가 정확히 무엇이고 어떻게 작동하는가?"
koreanQuestion: "Plan S가 정확히 무엇이고 어떻게 작동하는가?"
category: funder-policy
status: in-progress
priority: high
createdAt: 2026-07-01
updatedAt: 2026-07-15
relatedArticles:
  - posts/2026-07-01-cc-by-meaning
  - posts/2026-07-15-korea-nrf-vs-plan-s
externalDiscussions:
  - title: "Plan S Principles (cOAlition S 공식)"
    url: https://www.coalition-s.org/plan-s-principles/
    lastChecked: 2026-07-10
  - title: "Plan S Forum: Korean researcher thread"
    url: https://discuss.coalition-s.org/korean-researchers
    lastChecked: 2026-07-12
relatedFeatures:
  - verdict_wellcome
  - verdict_erc
  - verdict_ukri
tags: [PlanS, cOAlitionS, wellcome, NIH, ERC, UKRI, korea]
---

# What is Plan S?

🟡 **In progress** | Last updated: 2026-07-15

## 짧은 답변 (TL;DR)

Plan S는 2018년 cOAlition S(유럽 주요 펀더 연합)가 시작한 OA 정책으로, **2021년부터 공공자금으로 수행된 연구는 출판 즉시 OA + CC-BY 라이선스 필수**를 요구합니다. 30+ 펀더가 가입 (Wellcome, ERC, UKRI, NIH, Gates 등).

## 왜 이 질문이 중요한가

한국 NRF는 2026-06 기준 미가입. 한국 연구자가 Plan S 이해 필요성:
- 해외 공동연구 시 Plan S 위반 위험
- Wellcome/ERC/NIH 펀딩 시 Plan S 자동 적용
- RRS (Rights Retention Strategy) 출판사 거부권

## 외부 자료 (이 질문의 핵심 소스)

- 📚 [cOAlition S Plan S 원칙](https://www.coalition-s.org/plan-s-principles/) — 원문
- 💬 [Plan S Forum: 이 질문 관련 토론](https://discuss.coalition-s.org/plan-s-korea) — 외부
- 📊 [OASPA: Plan S 영향 분석](https://oaspa.org/analysis) — 큐레이션
- 🇰🇷 [NRF 학술연구정책](https://www.nrf.re.kr/page/oa-policy) — 한국 비교

## ScholarLink 관련 글 (이 질문에 대한 분석)

- 📝 [2026-07-01 CC-BY 라이선스의 진짜 의미](/blog/posts/2026-07-01-cc-by-meaning)
- 📝 [2026-07-15 한국 NRF vs Plan S](/blog/posts/2026-07-15-korea-nrf-vs-plan-s)

## ScholarLink 기능 (이 질문과 연결)

- **verdict_wellcome**: Wellcome Plan S 정책 자동 판정 → ScholarLink verdict
- **verdict_erc**: ERC Plan S 정책 자동 판정
- **verdict_ukri**: UKRI Plan S 정책 자동 판정
- **/help/oa-mandate**: OA Mandate 용어 설명

## 더 깊이 논의하려면 (외부)

🐦 Twitter @scholarlink_app
💬 discuss.coalition-s.org
🌐 oaspa.org/connect
🇰🇷 NRF 정책 Q&A: nrf.re.kr/qna
```

##### 14.8.6.10 신규 질문 등록 트리거 (Phase 2~3 자동화)

| 트리거 | 감지 방법 | 신규 질문 등록 |
|---|---|---|
| **Plan S 뉴스 RSS** | cOAlition S RSS 주 1회 cron | keyword matching → curator 승인 |
| **OASPA 블로그 RSS** | OASPA RSS 주 1회 cron | keyword matching → curator 승인 |
| **NRF/KISTI 발표** | 한국 RSS + 보도자료 모니터링 | curator 수동 |
| **ScholarLink verdict UNCLEAR 패턴** | verdict 결과 분석 | "왜 데이터가 부족한가" → curator 검토 |
| **사용자 피드백** | 이메일/댓글 (자체 운영 X지만 외부) | curator 수동 |
| **분기 회의 (1인)** | curator 정기 검토 | curator 수동 |

##### 14.8.6.11 v1.4 → v1.5 콘텐츠 발행 빈도 재정의

| 빈도 | v1.4 (이전) | v1.5 (신규) |
|---|---|---|
| 메인 블로그 (Astro, canonical) | 월 2편 (자유 주제) | 월 2편 (모두 **하나 이상의 질문에 연결**) |
| syndication 4채널 (브런치/티스토리/미디엄/Twitter) | 메인 발행 시 자동 | 메인 발행 시 자동 (동일) |
| **질문 트래거 status 업데이트** | — | **월 2~5개** (curator 수동 + 자동 후보) |
| **외부 thread 자동 모니터링** | — | cron 주 1회, status 변경 후보 알림 |
| **분기 뉴스레터에 "status 변경된 질문 5개"** | — | 분기 1회 (v1.5 §15.6에 추가) |

##### 14.8.6.12 운영 메트릭 (질문 트래거 활성도)

| 메트릭 | 정의 | 목표 (6개월) |
|---|---|---|
| **활성 질문 수** | 🔴 + 🟡 (Resolved 제외) | 20+ |
| **Resolved 질문 누적** | 🟢로 status 변경된 질문 누적 | 10+ |
| **월간 status 변경 횟수** | (🔴→🟡, 🟡→🟢) 합계 | 5+ / 월 |
| **질문당 평균 관련 글 수** | relatedArticles.length 평균 | 1.5+ |
| **외부 thread 영구 연결 수** | externalDiscussions.length 합계 | 50+ |
| **질문 페이지 organic 유입** | Google Analytics (질문 페이지) | 월 100+ |
| **status 변경 Twitter 도달** | status 변경 트윗 impressions | 분기 1,000+ |

### 14.8.7 광고 배너 & ScholarLink 인트로 통합 — v1.6 신규

> **왜 필요한가**: v1.4의 블로그는 "촉매로서 외부 연결"이 목표였지만, v1.4 자체로는 **사이트 자가 노출**과 **수익화**가 부재했다. v1.5가 추가한 질문 트래거로 SEO와 콘텐츠 가치가 누적되는 만큼, 블로그 트래픽 자체도 자가 노출 채널이자 잠재 수익원이 된다. 사용자 추가 방향성 (2026-07-02 11:36): **"각 블로그 글에 현재 랜딩페이지에 있는 bidvibe에 대한 광고 배너(KR/EN)와 scholarlink 소개 및 링크주소가 적절하게 삽입되어야 한다."**

##### 14.8.7.1 통합의 3가지 목표

| 목표 | 설명 | 측정 KPI |
|---|---|---|
| **① 수익화** | bidvibe 광고 (랜딩 페이지와 동일 디자인 재사용) 를 blog 모든 페이지에 적용 | #15 bidvibe CTR (§16) |
| **② 자가 노출 (ScholarLink 인트로)** | 각 블로그 글 헤더에 **ScholarLink 인트로 박스** 표시 → 본사이트 verdict 도구로 자연스러운 복귀 동선 | #16 인트로 박스 CTR (§16) |
| **③ 자가 노출 (canonical → 본사이트)** | syndication 모든 글에 **Astro canonical URL (= scholarlink.app/blog/[slug]) 명시** + **ScholarLink 인트로 박스 삽입** | syndication → scholarlink.app 체류 전환 |

##### 14.8.7.2 bidvibe 광고 배너 — 2개 슬롯 (Top + Bottom)

**랜딩 페이지와 동일 디자인 재사용** (`client/src/components/ads/`) — Astro Layout에 그대로 import:

| 슬롯 | 컴포넌트 | 표시 위치 | KR 메시지 | EN 메시지 | CTA URL |
|---|---|---|---|---|---|
| **Top Fixed Banner** | `TopAdBanner.tsx` 재사용 | viewport 최상단 fixed (z-index 9999) | "연구자 비용 0원, 엑셀로 공급사 그만 찾기" + CTA "지금 등록 →" | "Researchers private. Quotes public. Suppliers confidential." + CTA "Sign up now →" | `https://ai-traffic.kr` |
| **Bottom Fixed Banner** | `BottomAdBanner.tsx` 재사용 | viewport 최하단 fixed (z-index 9998) | "시약/장비 일단 띡! 견적요청만 올리면 됨" + BidVibe 로고 | "Bring your suppliers, researchers — stop looking at the spreadsheet." + BidVibe 로고 | `https://ai-traffic.kr` |

**디자인 일관성 (bidvibe 브랜드 가이드)**:
- 강조색: `#1AACDA` (시안), 다크 시안: `#0E7490`, 본문 네이비: `#132B43`
- 로고 자산: `client/src/assets/bidvibe-logo.svg` (재사용)
- KR/EN 자동 전환: `getLang()` 헬퍼 (기존 패턴)
- 라벨: "광고" / "Ad" (각국 광고 표시 표준 준수)
- Top: min-height 56px, Bottom: min-height 104px

**Astro로 포팅 시 차이점**:
- TopAdBanner/BottomAdBanner는 React 컴포넌트 → **Astro는 `.astro` 컴포넌트가 기본**
- 방안 A: React 컴포넌트를 그대로 import + 클라이언트 hydration (`client:load`) — 동일 디자인 즉시 사용
- **방안 B (v1.6 권장)**: 디자인 CSS/HTML 그대로 `.astro` 컴포넌트로 재작성 — 번들 0KB, 더 가벼움
- 두 방안 모두 가능. **방안 A는 30분 작업**, 방안 B는 2~3시간 작업. Phase 2 Week 4 일정 압박 시 방안 A 우선

##### 14.8.7.3 ScholarLink 인트로 박스 (BlogPostHeader) — v1.6 신규 컴포넌트

각 블로그 글 상단에 **ScholarLink 인트로 박스** 자동 표시:

```html
┌────────────────────────────────────────────────────────────────┐
│  📘 ScholarLink 소개                                            │
│                                                                │
│  ScholarLink는 DOI / PMID / arXiv ID만 입력하면                  │
│  오픈액세스 학술논문 PDF를 5초 안에 찾아주는 무료 도구입니다.      │
│                                                                │
│  ✨ 내 논문이 내 펀더의 OA 정책을 준수하는지 즉시 확인            │
│     → scholarlink.app/compliance                               │
│                                                                │
│  [ScholarLink 무료로 사용해보기 →]  (https://scholarlink.app)    │
└────────────────────────────────────────────────────────────────┘
```

**구현 파일** (v1.6 신규):
- `client/blog/src/components/ScholarLinkIntro.astro` (방안 B = .astro 직접)
- 또는 `client/blog/src/components/ScholarLinkIntro.tsx` (방안 A = React 포팅)

**모든 blog post + question page에 자동 삽입**: `PostLayout.astro` / `QuestionLayout.astro` Header slot 내부.

**ScholarLink 인트로 카피 (KR/EN)** — `client/blog/src/i18n/blogDictionary.ts` (v1.6 신규):

| 언어 | 인트로 본문 | CTA 라벨 | CTA URL |
|---|---|---|---|
| **KR** | "ScholarLink는 DOI / PMID / arXiv ID만 입력하면 오픈액세스 학술논문 PDF를 5초 안에 찾아주는 무료 도구입니다. 내 논문이 내 펀더의 OA 정책을 준수하는지 즉시 확인하세요." | "ScholarLink 무료로 사용해보기 →" | `https://scholarlink.app` |
| **EN** | "ScholarLink finds open-access research papers in 5 seconds using just a DOI / PMID / arXiv ID. Check whether your paper complies with your funder's OA policy instantly." | "Try ScholarLink free →" | `https://scholarlink.app/en` |

**왜 헤더인가 (UX 근거)**:
- 글 상단 = **읽기 시작 직후** ScholarLink 자가 노출이 가장 효과적 (첫 인상 CTR ↑)
- v1.5의 "관련 질문" 박스와 자연스럽게 인접 배치 (둘 다 헤더)
- 글 하단보다 **첫 30초 노출**이 강해 자가 노출 효율 ↑
- syndication 4채널 (브런치/티스토리/미디엄)에도 **본문 첫 100자 이내**에 동일 삽입 (canonical link + 인트로)

##### 14.8.7.4 syndication 4채널 통합 정책 (채널별 매트릭스)

**정책**: bidvibe 광고와 ScholarLink 인트로는 syndication 4채널에 **일관되게** 삽입. 단, **각 채널의 정책상 허용 범위 내에서** 통합.

| 채널 | bidvibe 광고 | ScholarLink 인트로 | 비고 |
|---|---|---|---|
| **Astro (canonical)** | ✅ Top + Bottom fixed (Layout) | ✅ 헤더 박스 (Layout) | 모든 페이지 자동 |
| **브런치 (brunch.co.kr)** | ❌ Kakao 정책상 자체 광고 영역 외 외부 광고 삽입 불가 | ✅ 본문 첫 100자 (수동 삽입) | KR syndication |
| **티스토리 (tistory.com)** | ⚠️ 티스토리 기본 배너 영역은 자체 광고 — HTML 모드 사용 시 직접 삽입 가능 | ✅ 본문 첫 100자 (수동 삽입) | KR syndication, HTML 모드 권장 |
| **미디엄 (medium.com)** | ❌ Medium 정책상 외부 광고 절대 불가, 인트로만 가능 | ✅ 본문 첫 100자 (수동 삽입) | EN syndication |
| **Twitter OG 카드** | ❌ Twitter 자체 광고 정책 외 외부 광고 불가 | ⚠️ OG 카드 description에 "via scholarlink.app" 명시 | 단축 링크만 |

**canonical 우선 정책 (v1.4 확정 + v1.6 갱신)**:
- Astro가 canonical이므로 **모든 syndication 글 헤더에 "원문: scholarlink.app/blog/[slug]" 명시** + **Astro 글 URL로의 링크** (= ScholarLink 자가 노출 보강)
- syndication 글에도 "ScholarLink 인트로 박스" 동일 내용 삽입 (브런치/티스토리/미디엄 모두)
- bidvibe 광고는 Astro(메인) + 티스토리(HTML 모드)만 가능. 브런치/미디엄은 플랫폼 정책상 불가 — **인트로 박스가 자가 노출의 보완 채널**

##### 14.8.7.5 질문 페이지 (questions/[category]/[slug])에도 광고/인트로 통합

질문 페이지도 blog의 일부이므로 동일 패턴 적용:

| 위치 | 표시 |
|---|---|
| Top | ✅ bidvibe TopAdBanner |
| Bottom | ✅ bidvibe BottomAdBanner |
| 헤더 (질문 위) | ✅ ScholarLink 인트로 박스 |
| 질문 본문 하단 (relatedArticles 옆) | ✅ "이 질문을 해결하려면 ScholarLink의 verdict 도구를 사용해보세요" CTA |
| 질문 페이지 하단 (외부 토론처 박스 위) | ✅ "이 페이지가 도움이 됐다면 → scholarlink.app" CTA |

→ 질문 페이지 = 30개 시드 × 4 카테고리 = 영구 reference. **질문 페이지가 누적될수록 광고 + 인트로 노출도 누적**. 6개월 후 30개 × 평균 200 PV = 6,000 PV/월 추정 → bidvibe 클릭 ~20/월.

##### 14.8.7.6 Astro Layout 구조 변경 (자동 통합 패턴) — v1.6 신규

`client/blog/src/layouts/PostLayout.astro` + `QuestionLayout.astro` 모두 동일 패턴 (v1.6 신규 통합):

```astro
---
// PostLayout.astro / QuestionLayout.astro (v1.6 패치)
import TopAdBanner from '../components/ads/TopAdBanner.astro';  // 방안 B (v1.6 권장) 또는 React 포팅
import BottomAdBanner from '../components/ads/BottomAdBanner.astro';
import ScholarLinkIntro from '../components/ScholarLinkIntro.astro';
const { frontmatter } = Astro.props;
const isEn = Astro.url.pathname.startsWith('/en/');
---

<TopAdBanner lang={isEn ? 'en' : 'ko'} />
<div class="blog-shell">
  <header class="post-header">
    <ScholarLinkIntro lang={isEn ? 'en' : 'ko'} />
    <h1>{frontmatter.title}</h1>
    <p class="meta">
      <time datetime={frontmatter.date}>{frontmatter.date}</time> ·
      <a href={`/blog/questions/${frontmatter.questions?.[0]?.category}/${frontmatter.questions?.[0]?.slug}`}>
        관련 질문 보기 (v1.5)
      </a>
    </p>
  </header>
  <article>
    <slot />
  </article>
  <footer class="post-footer">
    <slot name="related-articles" />     {/* v1.5 관련 글 */}
    <slot name="external-links" />       {/* §14.8 외부 링크 */}
  </footer>
</div>
<BottomAdBanner lang={isEn ? 'en' : 'ko'} />
```

→ **모든 blog post + question page가 자동으로 광고 + 인트로를 표시**. 글 작성 시 별도 작업 불요.

**blog root layout (`client/blog/src/layouts/BaseLayout.astro`)**:
- GA4 + 자체 분석 스크립트 (v1.4 §16 `analytics.ts`에서 분리)
- bidvibe 추적: `data-ad-slot="scholarlink-blog"` 속성 + 클릭 시 `bidvibe_click` GA 이벤트
- ScholarLink 인트로 추적: `data-intro-cta="scholarlink-blog"` 속성 + 클릭 시 `intro_cta_click` GA 이벤트

##### 14.8.7.7 KR/EN 자동 전환 + 다크 모드 정책

**KR/EN 자동 전환** (방안 B .astro 권장):
```astro
---
const lang = Astro.url.pathname.startsWith('/en/') ? 'en' : 'ko';
const kpi = lang === 'en' ? MESSAGES_EN : MESSAGES_KO;
---
<TopAdBanner messages={kpi} />
```

**다크 모드 정책**:
- bidvibe 브랜드 가이드는 **라이트 모드 고정** (그라데이션 `linear-gradient(180deg, #ffffff 0%, #e6f6fb 100%)`)
- ScholarLink 인트로 박스는 라이트/다크 모두 호환되는 카드 스타일 (border + subtle shadow)
- 다크 모드 사용자가 많아지면 bidvabe는 별도 다크 variant 추가 검토 (Phase 4 후반)

**모바일 정책**:
- TopAdBanner: mobile-first (TRUNCATE 대신 wrap 허용, 클램프 폰트 크기)
- BottomAdBanner: 2줄 레이아웃 + BidVibe 로고 우측 정렬
- ScholarLink 인트로 박스: mobile에서 카드 전체 표시 (스크롤 가능)

##### 14.8.7.8 운영/추적 메트릭 — bidvibe CTR + 인트로 박스 CTR

| 이벤트 | 정의 | 측정 위치 |
|---|---|---|
| `bidvibe_top_click` | TopAdBanner 클릭 | GA4 + 자체 analytics.ts |
| `bidvibe_bottom_click` | BottomAdBanner 클릭 | GA4 |
| `bidvibe_impression` | bidvibe 배너 노출 (페이지뷰 기반) | GA4 (page_view + custom dimension) |
| `intro_cta_click` | ScholarLink 인트로 박스의 CTA 클릭 | GA4 + 자체 analytics.ts |
| `intro_box_impression` | 인트로 박스 노출 (blog post page_view) | GA4 |
| `intro_box_dwell` | 인트로 박스 5초+ 체류 (관심도 측정) | GA4 scroll_depth event |

**GA4 이벤트 매니페스트** (§16.2에 추가):
```
event: bidvibe_top_click   → { slot: 'top', page_type: 'blog_post' | 'question' }
event: bidvibe_bottom_click → { slot: 'bottom', page_type }
event: intro_cta_click      → { lang: 'ko' | 'en', page_type }
```

**§16 KPI 신규 (2개)**:
- #15 bidvibe CTR — bidvibe 클릭 / bidvibe 노출
- #16 인트로 박스 CTR — intro CTA 클릭 / intro 박스 노출

---

### 14.9 인앱 콘텐츠 v1.3 → v1.4 변경 요약 (명시)

| v1.3 자체 호스팅 콘텐츠 | v1.4 처리 | 이유 |
|---|---|---|
| `/help/glossary` (15개 용어) | **폐기** | 백과사전 운영은 촉매 역할 밖 |
| `/help/oa-mandate` 등 8개 도움말 페이지 | **폐기** | verdict 카드의 외부 링크로 충분 |
| `/help/faq` (12개 Q&A) | **폐기** → 블로그 "질문 모음" 시리즈 | FAQ 자체 호스팅 = 촉매 아님 |
| 5단계 온보딩 위저드 | **1단계로 축소** (verdict 자체가 학습) | 5분 학습은 촉매가 안 함 |
| 3-tier 도움말 (인라인/모달/외부 페이지) | **1-tier로 축소** (1줄 인라인만) | 페이지 과잉 |
| i18n 키 200+ | **20개로 축소** | 자체 콘텐츠 최소화 |
| 콘텐츠 마케팅 5편 시리즈 (자체 발행) | **월 2편 블로그 + 외부 큐레이션** | 사이트 내 자체 콘텐츠는 촉매만 |

---

## 15. 참여 전략 (Engagement) — 촉매 + 아웃바운드

> **왜 이 섹션이 재작성되는가**: v1.3 §15의 "5단계 퍼널 + 리더보드 + 7종 뱃지 + 한국형 8채널"은 ScholarLink을 **자체 커뮤니티가 있는 서비스**로 만들었다. 사용자 방향성: **이 사이트는 촉매이지 커뮤니티 사이트가 아니다**. 따라서 인게이지먼트 목표는 "사이트 내 머무름 시간"이 아니라 **"verdict 후 외부 깊은 논의로 자연스럽게 흘러가는 비율"**로 재정의.

### 15.1 재정의된 참여 목표 — 머무름 → 외부 연결

| v1.3 (폐기) | v1.4 (신규) | 측정 |
|---|---|---|
| DAU 50+ | verdict 후 외부 링크 클릭률 30%+ | verdict 카드의 외부 link click-through |
| 위저드 완주율 60% | (위저드 자체를 1단계로 축소 — 측정 불요) | — |
| D7 retention 18% | D7 외부 사이트 방문 (블로그 + Plan S 등) 25%+ | UTM 추적 후 7일 내 재방문 |
| ORCID 연결 → 분기 리포트 이메일 | ORCID 연결 → 분기 **뉴스레터 (외부 자료 큐레이션)** | Resend |
| 5단계 퍼널 (인지→옹호) | **3단계 아웃바운드 깔때기** (Spark → Bridge → Transfer) | §15.2 |
| 7종 인센티브 뱱지 | **외부 활용 사례 명예의 벽** (인용/기사에 활용) | 분기 모니터링 |

**핵심 전환**: ScholarLink은 "사용자가 자주 방문하는 사이트"가 아니라 **"한 번 verdict를 보고 다음 외부 논의를 찾는 다리"**. 머무를 시간이 짧아도 **외부 연결을 잘 만들어주는 게 핵심**.

### 15.2 3단계 아웃바운드 깔때기 (Outbound Funnel)

```
┌─────────────────────────────────────────────────────┐
│  ① Spark (촉발)                                      │
│     verdict 카드 (5초 안에 명확한 결과)               │
│     → 100% 사용자                                    │
└──────────────────┬──────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────┐
│  ② Bridge (다리)                                      │
│     verdict 카드의 "더 알고 싶다면" 외부 링크 3~5개    │
│     → 30%+ 사용자가 1개 이상 외부 클릭                 │
└──────────────────┬──────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────┐
│  ③ Transfer (이전)                                    │
│     ScholarLink 블로그 1편 (1,000자, 1~2분 읽기)       │
│     → 15%+ 사용자가 블로그 글 끝까지 읽기              │
│     → 블로그 글의 외부 링크 → Plan S, OASPA, NRF 등  │
└──────────────────┬──────────────────────────────────┘
                   ↓
        (사용자는 외부에서 깊은 논의)
        (ScholarLink 재방문 = 새 DOI 체크 시)
```

**KPI 분기** (3개월 목표):
- ① → ② 전환: **30%+** (외부 클릭)
- ② → ③ 전환: **50%+** (외부 클릭 → 블로그 읽기)
- ③ → 외부: **80%+** (블로그에서 외부 링크 클릭)

### 15.3 Spark 단계 — Verdict 카드 디자인 (v1.4 §14.2 참조)

- 5초 안에 verdict 표시
- 카드 안에 3~5개 외부 링크 인라인 (블로그 1 + 외부 3~4)
- 별도 페이지/위저드/FAQ 안 함
- **모든 verdict 카드는 외부로 향하는 4~5개 링크를 항상 표시**

### 15.4 Bridge 단계 — 외부 링크 큐레이션 (verdict 유형별)

verdict 유형별 자동 매핑 (`verdictRouter.ts`):

| verdict 유형 | 1순위 (ScholarLink 블로그) | 2순위 (외부) | 3순위 (외부) | 4순위 (외부) | 5순위 (외부) |
|---|---|---|---|---|---|
| Wellcome Plan S 위반 | /blog/wellcome-2024-policy | coalition-s.org | wellcome.org/oa | Twitter #PlanS | discuss.coalition-s.org |
| NRF (한국) 위반 | /blog/korea-nrf-vs-plan-s | nrf.re.kr/page/oa | ROR KR | Twitter @NRF_Korea | oa.kisti.re.kr |
| NIH 위반 | /blog/nih-2024-policy | publicaccess.nih.gov | PMC FAQ | Europe PMC | RePORTER |
| Wellcome embargo 위반 | /blog/embargo-period | cOAlition S FAQ | Sherpa Romeo | Wellcome blog | — |
| CC0 라이선스 | /blog/cc-by-meaning | creativecommons.org/about/cc0 | Plan S FAQ | — | — |
| CC-BY-NC 위반 (Plan S 펀더) | /blog/cc-by-nc-vs-plan-s | creativecommons.org/licenses | OASPA blog | — | — |
| DOI/펀더 미등록 (UNCLEAR) | /blog/why-unclear | crossref.org/funderregistry | ROR | — | — |

**자동 매핑 로직**:
```typescript
// server/src/services/verdictRouter.ts (의사코드)
function getOutboundLinks(verdict: ComplianceVerdict): OutboundLink[] {
  const reasons = verdict.perFunder[0]?.reasons ?? [];
  const firstReason = reasons[0] ?? '';

  // 1. 펀더 DOI 기반 매핑
  if (verdict.perFunder[0]?.funder_doi === '10.13039/100000002') {
    return NIH_LINKS;  // 위 표
  }
  if (verdict.perFunder[0]?.funder_doi === '10.13039/501100000780') {
    return WELLCOME_LINKS;
  }
  if (verdict.perFunder[0]?.funder_doi === '10.13039/501100003621') {
    return NRF_LINKS;
  }
  // ... 20개 펀더 매핑

  // 2. 폴백: 기본 외부 링크
  return DEFAULT_LINKS; // Plan S + OASPA + NRF + Creative Commons
}
```

**수동 큐레이션**: 1순위 블로그 글 1개 + 외부 3~4개 = **모든 verdict가 외부 연결을 4~5개 보유**.

### 15.5 Transfer 단계 — ScholarLink 블로그 + 질문 트래거 (§14.8, v1.5 업데이트)

- `/blog` 경로, 자체 호스팅 (SSG, Markdown 기반, Astro + Cloudflare Pages — v1.4 §14.8.5 확정)
- **`/blog/questions` 경로 추가 (v1.5)** — 핵심질문 트래거 (영구 reference)
- RSS + Atom + JSON Feed 동시 제공 (글 발행 시 자동 갱신)
- 한국어/영어 모두 발행 (영어 1주 지연)
- 댓글 시스템 **자체 운영 없음** — Disqus/Giscus 안 붙임
  - 이유: 1인 운영에 과부하 + "토론은 외부에서"라는 사이트 정체성 일관성
  - 대신 글 하단에 "이 글에 대해 논의하려면" 외부 링크 3~5개

**★ v1.5 신규: 질문 트래거 운영**:
- 모든 블로그 글은 §14.8.6의 **핵심질문 트래거의 1개 이상의 질문에 연결**
- 질문 페이지(`/blog/questions/[category]/[slug]`)는 영구 reference. 시간이 지날수록 관련 글이 누적되어 가치가 compound됨
- status badge: 🔴 Open / 🟡 In progress / 🟢 Resolved
- 외부 토론 thread URL을 영구 추적 (externalDiscussions)
- 매월 2~5개 status 변경 (curator 수동 + 자동 후보)

**syndication 채널** (v1.4 확정, 사용자 결정 2026-06-29 22:28):

| 채널 | 언어 | canonical URL | 목적 | 발행 시점 |
|---|---|---|---|---|
| **Astro (메인)** | KR | `scholarlink.app/blog/[slug]` | 본편 (canonical) | 즉시 |
| Astro (메인) | EN | `scholarlink.app/en/blog/[slug]` | 본편 (canonical) | KR 발행 1주 후 |
| **브런치 syndication** | KR | canonical = KR Astro | Kakao 자회사 audience | KR Astro 발행 24시간 이내 |
| **티스토리 syndication** ⭐ v1.4 신규 | KR | canonical = KR Astro | 네이버 SEO 최강 | KR Astro 발행 24시간 이내 |
| **미디엄 syndication** | EN | canonical = EN Astro (또는 KR Astro) | 글로벌 reach | EN Astro 발행 24시간 이내 |
| Twitter OG 카드 | — | canonical URL | 단축 링크 | 본편 발행 시 자동 |
| **★ v1.5 신규: 질문 트래거 status 변경 트윗** | — | `/blog/questions/[slug]` | "Q: [질문] status 🔴→🟡" | status 변경 시 자동 |

**★ v1.6 신규: syndication 4채널 + bidvibe 광고 + ScholarLink 인트로 통합 표**:

| 채널 | bidvibe 광고 | ScholarLink 인트로 | 비고 |
|---|---|---|---|
| **Astro (canonical)** | ✅ Top + Bottom fixed (Layout 자동) | ✅ 헤더 박스 (Layout 자동) | Layout 1개 변경으로 자동 통합 |
| 브런치 | ❌ Kakao 정책상 불가 | ✅ 본문 첫 100자 (수동) | KR |
| 티스토리 | ⚠️ HTML 모드 직접 삽입 | ✅ 본문 첫 100자 (수동) | KR, HTML 모드 권장 |
| 미디엄 | ❌ Medium 정책상 불가 | ✅ 본문 첫 100자 (수동) | EN |
| Twitter | ❌ 정책상 불가 | ⚠️ OG description "via scholarlink.app" | 단축 링크만 |

→ §14.8.7.4 채널별 매트릭스 참조. Astro가 canonical이므로 syndication 모든 글에 "원문: scholarlink.app/blog/[slug]" 명시 + **Astro 글 링크 (= ScholarLink 자가 노출 보강)**.

**블로그 글 하단 표준 패턴** (모든 syndication 채널에 동일 적용):
```
─── 이 글에 대해 논의하고 싶다면 ───

🐦 Twitter @scholarlink_app 에 멘션
📧 news@scholarlink.app 메일
💬 Plan S 포럼: discuss.coalition-s.org
🇰🇷 NRF 정책 Q&A: nrf.re.kr/qna
🌐 OASPA: oaspa.org/connect
```

**★ v1.5 신규: 글 상단 "관련 질문" 박스** (모든 syndication 채널에 동일 적용):
```
📌 관련 질문: "What is Plan S?" 🟡 In progress
   → scholarlink.app/questions/funder-policy/what-is-plan-s
   (이 글은 위 질문에 대한 분석입니다)
```

→ 사용자가 ScholarLink에 댓글을 남기는 게 아니라 **외부에서** 토론. 사이트는 그 토론이 일어나는 장소를 **알려주는 역할**.

**canonical link 명시 정책** (v1.4 신규):
- Astro 글 헤더에 `<link rel="canonical" href="https://scholarlink.app/blog/[slug]">` 자동 삽입
- 브런치/티스토리/미디엄 발행 시 본문 첫 줄 또는 말미에 "**원문: https://scholarlink.app/blog/[slug]**" 명시
- 티스토리 HTML 모드 사용 시 `<link rel="canonical">` 메타 삽입 가능 (검색엔진 중복 인식)
- 모든 syndication 글 마지막에 "**원문 보기: scholarlink.app/blog/[slug]**" 버튼/링크 배치
- **★ v1.5 신규**: syndication 글에도 "관련 질문" 섹션 포함 (canonical link + 질문 페이지로의 링크)

**티스토리 발행 상세 (v1.4 신규)**:
- HTML 모드 사용 (마크다운 변환 결과 붙여넣기)
- 카테고리: `학술연구` / `오픈액세스` / `정책`
- 태그: `오픈액세스`, `OA`, `PlanS`, `NRF`, `학술정책` (3~5개)
- 발행 시간: 평일 오전 9~11시 (네이버 노출 최적 시간대)
- **댓글 자체 운영 X** (촉매 원칙 일관성) — 티스토리 기본 댓글 OFF 설정
- 본문 길이: Astro 원문의 60~70% (1,000자 → 600~700자)
- 외부 링크 3~5개 모두 포함 (Astro 본편과 동일)
- 글 하단 "이 글에 대해 논의하려면" 외부 링크 3~5개 포함

### 15.6 ORCID 연결 — 외부 자료 강조 뉴스레터 (v1.5 질문 트래거 통합)

v1.3 §15.4의 "분기 리포트 이메일" (자체 컴플라이언스 통계) → **분기 뉴스레터 (외부 연결 강화 + v1.5 질문 트래거 status 변경)**:

```
Subject: [ScholarLink] 2026 Q2 OA 컴플라이언스 + 질문 트래거 뉴스레터

안녕하세요, ScholarLink입니다.

지난 분기 자동 verdict 결과:
- ✅ 준수: 9 / ❌ 미준수: 2 / ⚠️ 부분: 1

[미준수 2건 자세히 보기 →]

─── 이번 분기 status 변경된 핵심질문 5개 ───  ★ v1.5 신규

🟡→🟢 "NIH 2024 Public Access Policy — what changed?"
   → 정책 변경 + 새 글 발행: scholarlink.app/questions/funder-policy/nih-2024

🔴→🟡 "When will Korea adopt a Plan S-like mandate?"
   → KISTI 신규 발표 분석: scholarlink.app/questions/korean-policy/when-korea-plan-s

🟡 "Why doesn't NRF join cOAlition S?" (관련 글 1편 추가)
   → scholarlink.app/questions/korean-policy/why-nrf-not-join-coalition-s

🔴 (신규) "What is OSTI / DOE Public Access Plan 2024?"
   → 등록: scholarlink.app/questions/funder-policy/osti-doe-2024

🟡 "What is the Rights Retention Strategy (RRS)?"
   → 심화: scholarlink.app/questions/license/rights-retention-strategy

[질문 트래거 전체 보기 (30개): scholarlink.app/questions]

─── 이번 분기 추천 외부 자료 ───

🇰🇷 [한국 NRF가 Plan S를 안 받는 이유] (ScholarLink 블로그)
   → 외부 토론: discuss.coalition-s.org/nrf

🌍 [OASPA: Plan S 2단계 신규 FAQ] (번역 큐레이션)
   → 원문: oaspa.org/news/plan-s-faq-2026

📊 [한국 50대 기관 OA 준수율 leaderboard] (ScholarLink 데이터)
   → 데이터 인용 가이드: scholarlink.app/blog/citation

📚 [NIH 2024 Public Access Policy 변경점] (NIH 원문)
   → 한국어 요약: scholarlink.app/blog/nih-2024

[블로그 RSS 구독]  [뉴스레터 구독 취소]
```

**목적**: verdict를 한 번 받고 잊는 게 아니라, **분기마다 외부 자료와 함께 인사이트** 받음 → 외부 사이트 방문 유도. **자체 통계는 보조**, 외부 자료 큐레이션이 본문.

**★ v1.5 신규**: 분기마다 **"status 변경된 핵심질문 5개"** 섹션 추가. 단순 추천 자료가 아니라 **"질문 트래거의 진화"** 자체가 본문. 사용자는 status 변경을 통해 OA 정책 흐름을 자연스럽게 학습.

**★ v1.6 갱신 — 뉴스레터 자체에는 bidvibe 광고를 삽입하지 않음**. 이유:
- 이메일은 **2-click user 모델** — 광고 클릭률 < 0.1% (vs 웹 0.3~0.5%)
- 뉴스레터는 ScholarLink 자가 노출 + 외부 자료 큐레이션에 집중
- **bidvibe/인트로는 블로그 본편에서만** → 뉴스레터 하단에 "이 뉴스레터가 도움이 됐다면 → 블로그 본편" CTA 1개만 추가
- **뉴스레터 발송 시 자동 분석**: Resend webhook으로 `bidvibe_*` / `intro_*` 이벤트 보고 (월간 CTR)

### 15.7 SNS 공유 — 촉매 역할에 부합 (유지)

OG 카드는 촉매에 부합 — 공유받은 사람이 verdict 결과를 보고 → 외부로 흐름. **v1.3 §15.5 유지**.

#### OG 카드 자동 생성

결과 verdict마다 **SNS 공유용 OG 카드** 자동 생성:

```html
<!-- /compliance/results/{id} -->
<meta property="og:title" content="내 NRF 과제 논문 12건 중 9건 OA 정책 준수">
<meta property="og:description" content="한국 평균 38% 대비 +37%p. ScholarLink 무료 체크">
<meta property="og:image" content="https://scholarlink.app/og/{id}.png">
<meta property="og:url" content="https://scholarlink.app/compliance/results/{id}">
```

**자동 생성 이미지** (1200×630px):
- 좌측: verdict 배지 (큰 글씨)
- 우측: 차트 (한국 평균 vs 본인)
- 하단: "@scholarlink_app" 워터마크
- 색상: COMPLIANT=초록 / NON_COMPLIANT=빨강 / PARTIAL=노랑 / UNCLEAR=회색

**공유 시 OG 카드에 외부 링크도 포함**:
```html
<meta property="og:see_also" content="https://coalition-s.org">
<meta property="og:see_also" content="https://www.nrf.re.kr/page/oa-policy">
```

#### 공유 템플릿 (5종)

| 플랫폼 | 메시지 템플릿 |
|---|---|
| Twitter/X | "내 100편 논문 중 {N}%(한국 평균 {avg}%)가 OA 정책 준수. 더 알아보기: {url}" |
| LinkedIn | "I checked my OA mandate compliance on ScholarLink — {N}% compliant, vs {avg}% in Korea. Discussion: {url}" |
| KakaoTalk | "📚 내 논문 OA 준수율 {N}%! 한국 평균 {avg}%보다 높아요. 더 읽기: {url}" |
| 이메일 | "한국 NRF 과제 OA 준수 체크해보세요 — {url}" |
| 블로그/카페 | "[스칼라링크 후기] 내 NRF 과제 12건 일괄 OA 컴플라이언스 결과 (Plan S/NRF 외부 토론처 포함)" |

**모든 공유 템플릿에 외부 토론처 링크가 포함**됨.

### 15.8 인센티브 시스템 — 완전 폐기, 외부 활용 사례로 전환

v1.3 §15.7의 7종 뱃지 시스템 **완전 폐기**. 이유:
- 1인 운영에 과부하 (뱃지 발급/표시 로직)
- "경쟁/순위"가 촉매 역할과 충돌 (사용자 간 비교는 사이트 내 머무름 유도)
- **대체**: ScholarLink 블로그에 "**이 데이터를 인용한 사용자/기관**" 명예의 벽 (수동 큐레이션)

#### 명예의 벽 — 외부 활용 사례 (분기 1회 업데이트)

`/blog/featured-citations` (또는 `/about/used-by`):

> "**ScholarLink 데이터/verdict가 외부에서 활용된 사례**" (수동 큐레이션, 분기 1회)

**사례 유형**:
- "한국연구재단 2026 정책 백서가 ScholarLink 데이터를 인용했습니다"
- "KAIST 도서관이 2026 Q2 보고서에 ScholarLink leaderboard 활용"
- "OO 기자의 한국 OA 정책 기사에 ScholarLink 통계 활용"
- "브런치 사용자 'OA 정책 입문' 글에 ScholarLink verdict 카드 인용"
- "외부 연구자 A 씨의 박사학위 논문 '한국 OA 정책 분석'이 ScholarLink 데이터를 1차 소스로 활용"

**자동 모니터링** (`docs/citations/` + cron):
- Google Scholar 알림: "ScholarLink" 검색
- Twitter 모니터링: "@scholarlink_app" 멘션, "scholarlink.app" URL 포함 트윗
- 한국 NRF/KISTI/과기정통부 보도자료 모니터링
- 분기 1회 자동 리포트

**인센티브가 사이트 내 점수가 아니라 외부 활용 사례로 전환** — 이게 촉매의 진짜 성공 지표.

### 15.9 한국형 촉매 채널 (재정렬, v1.4 티스토리 추가)

v1.3 §15.8의 "B2C + 입소문" → **촉매 + 외부 연결**로 재정의. v1.4 사용자 결정에 따라 **티스토리 syndication 추가**:

| 채널 | 역할 | KPI | v1.4 상태 |
|---|---|---|---|
| **ScholarLink 블로그 (Astro, 메인)** | 촉매 콘텐츠 1차 발행처 (canonical) | 월 2편 발행, RSS 구독 500+ (6개월) | ⭐ 메인 확정 |
| **브런치(brunch.co.kr) syndication** | Kakao 자회사 audience, KR 발행 24h 이내 복제 | 조회수 + 백링크 | v1.4 syndication #1 |
| **티스토리(tistory.com) syndication** ⭐ v1.4 신규 | **네이버 SEO 최강** + RSS + Kakao 계정 통합 | 네이버 검색 유입 + 백링크 | **v1.4 syndication #2 (사용자 결정)** |
| **미디엄(Medium) syndication** | 영어 글 글로벌 reach | 팔로워 1,000+ (6개월) | v1.4 EN syndication |
| **Substack (선택, Phase 4)** | 외부 큐레이션 뉴스레터 (월 1회) | 구독 200+ | 옵션 (Phase 4) |
| **Twitter/X @scholarlink_app** | verdict → 블로그 글 → 외부 토론 단축 링크 | 팔로워 2,000+ (6개월) | v1.4 |
| **네이버 카페 (KAIST/SNU/POSTECH)** | 사용자 동의 시 verdict 결과 공유 (외부 카페로) | 게시 수 (월 10+) | v1.4 |
| **인스타 / 스레드** | verdict 결과 인포 카드 (외부 link in bio) | 팔로워 1,000+ | v1.4 |
| **학회/세미나** | "한국 OA 정책 데이터" 라이트 토크 (10분) | 리드 30/회 | v1.4 |
| **대학교 도서관 MOU** | 분기 데이터 feed (외부) | MOU 3건+ (6개월) | v1.4 |

**브런치 vs 티스토리 — 채널 역할 분담 (v1.4 확정)**:

| 차원 | 브런치 (syndication #1) | 티스토리 (syndication #2) |
|---|---|---|
| **모회사** | Kakao | 다음 (카카오 자회사) |
| **강점** | 글잎/유료 글 시스템, Kakao 푸시, 메인 reader quality | **네이버 검색 SEO 최강**, RSS/Atom 제공, HTML 편집 가능 |
| **약점** | syndication 약함, 자체 도메인 없음 | 디자인 old-fashioned, syndication 일부 |
| **audience** | KakaoTalk 연동, MZ/30대 reader 多 | 네이버 검색 유입, 학술/40대+ reader 多 |
| **canonical link** | 본문 첫 줄에 명시 | HTML 모드로 `<link rel="canonical">` 메타 삽입 가능 |
| **발행 빈도** | KR Astro 발행 24h 이내 | KR Astro 발행 24h 이내 (브런치와 동시 또는 시차) |
| **본문 길이** | 60~70% (Astro 원문 기준) | 60~70% |
| **외부 링크** | 3~5개 모두 포함 (Astro 본편과 동일) | 3~5개 모두 포함 |
| **댓글** | 자체 운영 X (촉매 원칙) | 자체 운영 X (기본 댓글 OFF) |
| **상호 cross-link** | 티스토리 글 하단 "브런치에서 보기" 없음 (각각 독립) | 브런치 글 하단 "티스토리에서 보기" 없음 (각각 독립) |

**핵심**: 두 채널은 **각각 다른 audience에게 reach**하기 위한 **독립적 syndication**. Kakao 푸시 reach (브런치) + 네이버 검색 reach (티스토리) → 2개 채널 합쳐서 KR reach 극대화.

**핵심 변화**: 모든 채널이 **ScholarLink으로의 유입**이 아니라 **ScholarLink → 외부로의 연결**. "한 번 verdict 보고, 외부 토론으로"의 다리 역할. **티스토리 syndication 추가로 네이버 검색 노출 강화** (v1.4 사용자 결정).

### 15.10 폐기된 v1.3 기능 목록 (명시)

| v1.3 기능 | v1.4 처리 | 이유 |
|---|---|---|
| 7종 인센티브 뱃지 (Bronze/Silver/Gold/Platinum/...) | **완전 폐기** → 외부 활용 사례 명예의 벽 | 사이트 내 점수제 = 촉매 역할 충돌 |
| 5단계 퍼널 (인지→옹호) | **재설계** → 3단계 아웃바운드 깔때기 | 외부 연결이 목표 |
| 8개 한국형 유통 채널 (입소문 중심) | **재정렬** → 촉매 + 외부 연결 관점 | 사이트 내 머무름 아닌 외부 연결 |
| 기관 인증 마크 + 인증 마크 발급 | **폐기** | 사이트 내 점수/순위 |
| ORCID ResearchGate/Academia.edu 위젯 (외부 사이트 임베드) | **재평가** — 자체 외부 위젯은 점수 노출 가능, 보류 | 위젯이 점수/순위 노출 = 촉매 아님 |
| 5단계 온보딩 위저드 | **1단계로 축소** | verdict 자체가 학습 |
| 분기 리포트 이메일 (자체 통계 중심) | **변경** → 외부 자료 강조 뉴스레터 | 외부 연결 강화 |
| 기관 보고서 B2B | **유지** (v1.4 §16) | 정책 입안자/도서관 담당자는 유료 가치 지불 의향 |
| OG 카드 자동 생성 | **유지** | SNS 공유는 촉매에 부합 |
| OG 카드 → 외부 토론 | **추가** | OG 카드의 see_also에 외부 토론처 |

### 15.11 참여 전략 실행 우선순위 (Phase 1~4, v1.4 재정의)

| Phase | 참여 기능 | 촉매 단계 | 비고 |
|---|---|---|---|
| **Phase 1 (MVP, Week 1~3)** | verdict 카드 + 1단계 onboarding + verdict 카드 외부 링크 자동 매핑 + OG 카드 | Spark + Bridge | 5초 안에 외부 4~5개 노출 |
| **Phase 2 (블로그, Week 4~5)** | /blog SSG + 월 2편 발행 + RSS + 분기 뉴스레터 (외부 큐레이션) | Transfer | 블로그가 외부로의 다리 |
| **Phase 3 (ORCID 일괄, Week 6~7)** | ORCID 일괄 + 신규 논문 자동 verdict + 분기 뉴스레터 자동 발송 | Bridge + Transfer (자동화) | 습관 → 외부 연결 자동화 |
| **Phase 4 (고도화, 지속)** | 외부 활용 사례 명예의 벽 + B2B 기관 보고서 + syndication (브런치/미디엄) | 외부 영향력 측정 | 분기 1회 명예의 벽 업데이트 |

### 15.12 위험 & 대응 (촉매 관점)

| 위험 | 영향 | 대응 |
|---|---|---|
| 한국 NRF가 OA를 의무화하지 않음 | 동기 부족 → 사용 저조 | "한국이 Plan S를 도입한다면?" 시뮬레이션 블로그 글 + 외부 토론처 라우팅 |
| 다른 도구(Sherpa, JCT)가 동일 verdict 제공 | 차별성 부재 | ScholarLink는 "한국어 + 한국 기관 + verdict 카드의 외부 4~5개 링크 자동 매핑" 3축 차별화 |
| 사용자 데이터 프라이버시 우려 | ORCID 연결 거부 | "익명화 + 7일 캐시 + 옵트아웃" 정책 명시 + GDPR/개인정보보호법 준수 |
| 정책 false negative (UNCLEAR 빈발) | 신뢰 하락 | "UNCLEAR = 데이터 부족" 명시 + 수동 추가 폼 + 시드 DB 지속 보강 + 블로그 글로 설명 |
| SNS 공유 시 오해 (verdict = 연구자 평가) | 평판 손상 | verdict는 "정책 준수"이며 "연구 품질"과 무관함을 모든 공유 카드 + 블로그에 명시 |
| 블로그 글 발행 부담 (월 2편) | 발행 지속성 | 글 80%는 외부 자료 큐레이션 (Plan S 뉴스 → 한국어 1단락 + 외부 링크). 자체 분석은 격월 1편 |
| 외부 링크 dead link | 사용자 신뢰 하락 | 분기 1회 자동 체크 (cron) + 404 발견 시 갱신 |
| 자체 콘텐츠가 너무 적어 SEO 약함 | 자연 유입 부족 | 블로그 글 = SEO 1차 자산 + 분기 뉴스레터 = 보조 |

---

## 16. KPI & 측정 — 촉매 지표로 재정의

> **왜 재정의되는가**: v1.3 §16의 KPI 9선은 "DAU/D7 retention/NPS" 중심이었다. v1.4에서는 **"사이트 머무름"이 아닌 "외부 연결 성공률"**이 목표이므로, KPI 자체를 촉매 관점으로 교체.

### 16.1 핵심 KPI 9선 — 촉매 지표 (v1.4 신규) + 질문 트래거 메트릭 (v1.5 신규)

| # | KPI | 정의 | 목표 (3개월) | 측정 |
|---|---|---|---|---|
| 1 | **verdict 후 외부 클릭률** | verdict 카드의 외부 링크 클릭 / verdict 본 사용자 | **30%+** | verdict_shown → outbound_link_clicked 전환율 |
| 2 | **첫 verdict까지 시간** | DOI 입력 → verdict 표시 (p95) | ≤ 60초 | 클라이언트 분석 |
| 3 | **ORCID 연결률** | verdict 본 사용자 중 ORCID 연결 | 8% | 백엔드 이벤트 |
| 4 | **D7 외부 재방문** | 외부 링크 클릭 후 7일 내 동일 외부 사이트 재방문 | **25%+** | UTM 추적 + 외부 사이트 referrer (3rd party 한계 인정) |
| 5 | **블로그 read-through** | verdict → 블로그 글 클릭 → 글 80%+ 스크롤 | **15%+** | blog_post_read_complete 이벤트 |
| 6 | **뉴스레터 외부 링크 CTR** | 분기 뉴스레터에서 외부 링크 클릭률 | **20%+** | Resend webhook |
| 7 | **외부 활용 인용 수** | ScholarLink 데이터/verdict가 외부(논문/보고서/기사/블로그)에서 인용 | **5건/분기** | Google Scholar + Twitter + 보도자료 모니터링 |
| 8 | **SNS share rate** | verdict OG 카드 공유 / verdict 100건 | 5% | OG 카드 /track endpoint |
| 9 | **OG 카드 → 외부 토론** | OG 카드 클릭 → 외부 사이트 도달 | **10%+** | OG 이미지 내 see_also 메타 → 외부 클릭 |
| **10** ⭐ v1.5 신규 | **활성 질문 수** | 🔴 + 🟡 (Resolved 제외) | **20+** | /blog/questions/ 카운트 |
| **11** ⭐ v1.5 신규 | **Resolved 질문 누적** | 🟢로 status 변경된 질문 누적 | **10+** | cron monthly snapshot |
| **12** ⭐ v1.5 신규 | **질문 페이지 organic 유입** | Google Analytics (질문 페이지) | **월 100+** | GA4 |
| **13** ⭐ v1.5 신규 | **질문당 평균 관련 글 수** | relatedArticles.length 평균 | **1.5+** | frontmatter 집계 |
| **14** ⭐ v1.5 신규 | **status 변경 Twitter 도달** | status 변경 트윗 impressions | **분기 1,000+** | Twitter Analytics |
| **15** ⭐ v1.6 신규 | **bidvibe 광고 CTR** | bidvibe 클릭 / bidvibe 노출 (blog + question 페이지) | **0.3~0.5%** | GA4 + 자체 analytics (`bidvibe_top_click`, `bidvibe_bottom_click`) |
| **16** ⭐ v1.6 신규 | **ScholarLink 인트로 박스 CTR** | intro CTA 클릭 / intro 박스 노출 | **5~10%** | GA4 + 자체 analytics (`intro_cta_click`) |

**v1.5 신규 메트릭의 의미**:
- #10, #11: 질문 트래거의 **활성도** (단순 발행 수가 아니라 **시간이 지남에 따라 status가 진화**하는 정도)
- #12: 질문 페이지가 **SEO 영구 reference**로서 가치를 축적하는 정도
- #13: 한 질문에 **관련 글이 누적**되는 정도 (compound value)
- #14: **status 변경 알림**이 외부 reach를 만드는 정도

**폐기된 v1.3 KPI**:
- ❌ DAU 50+ (사이트 머무름이 아님)
- ❌ D7 retention 18% (외부 재방문으로 대체)
- ❌ NPS +30 (자체 설문 부담, 외부 활용 인용으로 대체)
- ❌ 위저드 완주율 60% (위저드 자체를 1단계로 축소)
- ❌ CSV 다운로드 (Phase 2+ 데이터 export 기능으로 변경)

### 16.2 촉매 퍼널 트래킹 이벤트

`client/src/services/analytics.ts` 이벤트 (v1.4 재정의):

| 이벤트 | 시점 | 촉매 단계 | 비고 |
|---|---|---|---|
| `verdict_shown` | verdict 카드 표시 | ① Spark | verdict_type, funder_count, is_korean |
| `outbound_link_clicked` | verdict 카드의 외부 링크 클릭 | ② Bridge | link_target, link_type (blog/external) |
| `blog_post_view` | 블로그 글 조회 | ② Bridge | post_slug, language |
| `blog_post_read_complete` | 블로그 글 80%+ 스크롤 | ③ Transfer | post_slug, read_time_sec |
| `blog_external_click` | 블로그 글에서 외부 링크 클릭 | ③ → 외부 | link_target |
| `newsletter_open` | 분기 뉴스레터 오픈 | (습관) | Resend webhook |
| `newsletter_external_click` | 뉴스레터 외부 링크 클릭 | (습관 → 외부) | link_target |
| `og_card_shared` | OG 카드 공유 (SNS) | ① Spark (재진입) | platform |
| `og_card_external_seen` | OG 카드 see_also 외부 링크 노출 | ② Bridge | link_target |

### 16.3 외부 활용 사례 자동 모니터링

`docs/citations/` 디렉토리 + cron job (v1.4 신규):

| 모니터링 대상 | 주기 | 알림 채널 |
|---|---|---|
| Google Scholar "ScholarLink" 검색 결과 | 주 1회 | admin@scholarlink.app |
| Twitter "scholarlink.app" URL 포함 트윗 | 실시간 (API) | /admin/mentions 대시보드 |
| Twitter "@scholarlink_app" 멘션 | 실시간 (API) | /admin/mentions 대시보드 |
| 한국 NRF/KISTI/과기정통부 보도자료 | 주 1회 (RSS) | admin 이메일 |
| 한국 정책 보고서/논문 Google Scholar | 주 1회 | admin 이메일 |

→ 모니터링 결과는 **분기 1회 자동 리포트 + 명예의 벽 수동 큐레이션** 입력으로 사용.

### 16.4 운영자 대시보드 (재정의)

`/admin` 내부 페이지에 신규 탭 (v1.4):

- **실시간 verdict** 카운트 (시간대별)
- **verdict 분포** (COMPLIANT/NON_COMPLIANT/PARTIAL/UNCLEAR) 파이차트
- **외부 클릭률** (Spark → Bridge 전환) — **v1.4 신규 핵심 지표**
- **블로그 read-through** (Transfer 전환) — v1.4 신규
- **외부 활용 인용** (분기 누적) — v1.4 신규
- **뉴스레터 발송 + 외부 CTR** — v1.4 신규
- 외부 링크 dead link 모니터링
- **"인용/활용 사례" 큐레이션 입력 폼** (수동 등재) — v1.4 신규

### 16.5 월간 리포트 (촉매 관점)

`node-cron` 매월 1일 자동 발송 (admin 이메일):
- 지난 30일 verdict 수
- **외부 클릭률 추이** (v1.4 핵심)
- **외부 활용 인용 발생** (v1.4 핵심)
- 외부 링크 dead link 목록
- 블로그 발행 현황
- 가장 많이 클릭된 외부 링크 Top 5 (어떤 외부 사이트가 효과적인지 학습)

---

## 17. (기존 §13 다음 단계 보완) v1.4 + v1.5 신규 구현 작업

**v1.3에서 추가하려던 자체 호스팅 콘텐츠(용어집/FAQ/위저드/뱃지) 작업은 모두 폐기**. v1.4 신규 9개 + v1.5 신규 5개 (질문 트래거 관련) = **총 14개 작업**:

### v1.4 작업 (9개)

| # | 파일 | 작업 | Phase |
|---|---|---|---|
| 1-7 | `client/src/components/OutboundLinks.tsx` | verdict 카드 외부 링크 자동 매핑 (verdictRouter.ts 사용) | 1 |
| 1-8 | `client/src/components/HelpTip.tsx` | 1줄 인라인 툴팁 (모달/페이지 없음) | 1 |
| 1-9 | `server/src/services/verdictRouter.ts` | verdict → 외부 링크 4~5개 자동 매핑 (펀더 20개) | 1 |
| 1-10 | `i18n/dictionary.ts` | compliance.* 키 **20개** (축소) | 1 |
| 1-11 | `client/src/services/analytics.ts` | GA4 + 자체 이벤트 9종 (촉매 트래킹) | 1 |
| 2-7 | `client/blog/` (Astro SSG) | /blog SSG 라우트 (Astro + Cloudflare Pages) | 2 |
| 2-7b | `client/blog/src/components/SyndicationFooter.astro` | syndication 4채널 (브런치/티스토리/미디엄/Twitter) 복제 안내 | 2 |
| 2-7c | `docs/blog/syndication-checklist.md` | 발행 워크플로우 SOP | 2 |
| 2-8 | `client/src/components/OgCard.tsx` | SNS 공유용 OG 카드 (see_also 외부 링크 포함) | 2 |
| 2-9 | `server/src/services/newsletterService.ts` | 분기 뉴스레터 (외부 자료 큐레이션 + 자동 발송) | 2 |
| 3-7 | `client/src/components/OrcidConnect.tsx` | ORCID OAuth 연결 + 자동 verdict | 3 |
| 4-1 | `server/src/services/citationMonitor.ts` | 외부 활용 사례 자동 모니터링 (Google Scholar/Twitter/RSS) | 4 |
| 4-2 | `client/src/pages/FeaturedCitations.tsx` | 외부 활용 사례 명예의 벽 페이지 | 4 |

### v1.5 신규 작업 (5개, 질문 트래거 관련)

| # | 파일 | 작업 | Phase |
|---|---|---|---|
| 2-10 ⭐ v1.5 | `client/blog/content/questions/_meta.ts` + 30개 시드 | Astro Content Collection 스키마 + 핵심질문 30개 시드 (5 카테고리) | 2 |
| 2-11 ⭐ v1.5 | `client/blog/src/pages/questions/[category]/[slug].astro` | 질문 페이지 동적 라우팅 (status badge, relatedArticles, externalDiscussions 표시) | 2 |
| 2-12 ⭐ v1.5 | `client/blog/src/pages/questions/index.astro` | 전체 질문 목록 (status별/카테고리별 필터) | 2 |
| 2-13 ⭐ v1.5 | `client/blog/src/components/QuestionStatusBadge.astro` + `RelatedArticles.astro` + `ExternalDiscussions.astro` | 질문 페이지 컴포넌트 3종 | 2 |
| 3-8 ⭐ v1.5 | `client/src/pages/admin/QuestionEditor.tsx` | curator admin 페이지 — status 변경, externalDiscussions 편집, 신규 질문 등록 | 3 |
| 4-3 ⭐ v1.5 | `server/src/services/questionMonitor.ts` | RSS/외부 thread 자동 모니터링 + status 변경 후보 알림 | 4 |
| 2-14 ⭐ v1.6 | `client/blog/src/components/ads/TopAdBanner.astro` + `BottomAdBanner.astro` | bidvibe 광고 배너 Astro 컴포넌트 2개 (방안 B 권장 — .astro 재작성) 또는 React `client:load` import (방안 A) | 2 |
| 2-15 ⭐ v1.6 | `client/blog/src/components/ScholarLinkIntro.astro` + `client/blog/src/i18n/blogDictionary.ts` | ScholarLink 인트로 박스 + KR/EN dictionary (인트로 본문 + CTA 라벨 2개 언어) | 2 |
| 2-16 ⭐ v1.6 | `client/blog/src/layouts/PostLayout.astro` + `QuestionLayout.astro` 패치 | Layout에 TopAdBanner + BottomAdBanner + ScholarLinkIntro 자동 import — 모든 blog 페이지 자동 통합 | 2 |
| 2-17 ⭐ v1.6 | `client/blog/src/pages/blogDictionary.ts` (i18n 2개 언어) + syndication SOP 업데이트 | syndication 발행 SOP에 "본문 첫 100자 인트로 삽입" 단계 추가 | 2 |
| 3-9 ⭐ v1.6 | `client/src/services/analytics.ts` 패치 | `bidvibe_top_click` / `bidvibe_bottom_click` / `intro_cta_click` GA4 이벤트 3개 추가 | 3 |

**삭제된 v1.3 작업 (명시)**:
- ❌ `OnboardingWizard.tsx` (5단계 위저드) → 1단계로 통합
- ❌ `pages/Help/Glossary.tsx` (15개 용어) → 외부 링크로
- ❌ `pages/Help/FAQ.tsx` (12개 Q&A) → 블로그 시리즈로
- ❌ `pages/Help/Verdict.tsx` 외 7개 도움말 페이지 → 인라인 툴팁으로
- ❌ `ComplianceLeaderboard.tsx` → 폐기 (자체 사이트 점수/순위 안 함)
- ❌ `badgeService.ts` + 7종 뱃지 → 외부 활용 사례로 대체
- ❌ `widget/orcid.js` (외부 사이트 임베드) → 보류

**Phase 1 Week 1~3 마일스톤** (v1.4):
- Week 1: DB + 시드 + verdictRouter 골격 + 1줄 툴팁
- Week 2: 엔진 + API + verdict 카드 외부 링크 자동 매핑 + OG 카드
- Week 3: UI 통합 + GA4 트래킹 + Render 배포

**Phase 2 Week 4~5 마일스톤 — 블로그 SSG + syndication + 질문 트래거 셋업 (v1.4 + v1.5)**:
- Week 4:
  - Astro 프로젝트 init + Cloudflare Pages 연결 + 1편 발행 (KR/EN)
  - ★ v1.5: 질문 30개 시드 작성 + Astro Content Collection 스키마 작성
  - ★ v1.5: 질문 페이지 동적 라우팅 셋업 + status badge 컴포넌트
- Week 5:
  - syndication 워크플로우 셋업 + 브런치/티스토리/미디엄 발행 1회 실전 + canonical link 검증
  - ★ v1.5: 첫 글 1편을 기존 질문 1개에 연결 발행 (questions: [slug] 매핑)
  - ★ v1.5: 분기 뉴스레터에 "status 변경된 핵심질문 5개" 섹션 추가

**Week 1 종료 조건 (Gating, v1.4)**:
- 신규 6개 테이블 + 펀더 20 + 한국 기관 30 시드 ✓
- verdictRouter.ts: 펀더 5종 (Wellcome, NRF, NIH, ERC, UKRI) 매핑 ✓
- verdict 카드에 외부 링크 4~5개 자동 표시 ✓

**Phase 2 Week 4 종료 조건 (Gating, v1.4 + v1.5)**:
- Astro SSG 셋업 + Cloudflare Pages 배포 ✓
- 1편 KR 발행 + RSS/Atom/JSON Feed 자동 생성 확인 ✓
- canonical URL 자동 삽입 확인 ✓
- ★ v1.5: 질문 30개 시드 + status badge 동작 확인 ✓
- ★ v1.5: /blog/questions 페이지 (전체 목록) 빌드 확인 ✓

**Phase 2 Week 5 종료 조건 (Gating, v1.4 + v1.5)**:
- 1편 KR → 브런치 + 티스토리 복제 발행 완료 ✓
- 1편 EN → 미디엄 복제 발행 완료 ✓
- syndication 4채널 모두 canonical link 정상 ✓
- SyndicationFooter 컴포넌트 동작 확인 ✓
- ★ v1.5: 첫 글이 기존 질문 1개에 정상 연결 (relatedArticles 카운트 +1) ✓
- ★ v1.5: 분기 뉴스레터 status 변경 질문 5개 섹션 정상 표시 ✓

**v1.4 신규 KPI 게이트 (Phase 1 종료 시점)**:
- ① 메인 히어로 CTR ≥ 5%
- ② 첫 verdict까지 시간 p95 ≤ 60초
- ③ **verdict 후 외부 클릭률 ≥ 25%** (v1.4 핵심 신규)

**v1.4 블로그 KPI 게이트 (Phase 2 종료 시점)**:
- ① 블로그 글 → syndication 4채널 100% 발행률
- ② syndication → 외부 클릭률 ≥ 15%
- ③ 티스토리 syndication → 네이버 검색 유입 ≥ 월 50회

**v1.5 신규 KPI 게이트 (Phase 2 종료 시점)**:
- ① 질문 30개 시드 + 모두 status badge 표시 ✓
- ② 모든 발행 글 중 questions: [slug] 매핑 비율 ≥ 80% (일부突发 글 제외)
- ③ ★ v1.5: 질문 트래거에서 verdict 결과로 외부 클릭률 ≥ 20% (질문 페이지 → 외부 링크)
- ④ ★ v1.5: 분기 뉴스레터 status 변경 질문 5개 섹션 open rate ≥ 25%

---

## 18. 참고 자료 (v1.4 + v1.5 추가/갱신)

**v1.3에 있던 자료는 모두 유지**. v1.4에서 촉매 + 외부 연결 관점으로 **추가된 자료**. **v1.5에서 핵심질문 트래거(Living Issue Tracker) 사례 4건 추가**:

**외부 깊은 논의처 (verdict 카드 외부 링크 풀)**:
- **cOAlition S 본문 / 포럼**: https://www.coalition-s.org / https://discuss.coalition-s.org
- **OASPA (Open Access Scholarly Publishers Association)**: https://oaspa.org
- **Plan S Principles & Rights Retention Strategy**: https://www.coalition-s.org/plan-s-principles/
- **Creative Commons 라이선스**: https://creativecommons.org/licenses
- **ScholarlyHub / Wellcome Open Research 블로그**: https://wellcomeopenresearch.org/blog
- **NIH Public Access Policy**: https://publicaccess.nih.gov
- **Europe PMC**: https://europepmc.org
- **OpenAlex blog**: https://blog.openalex.org
- **한국 NRF 학술연구정책**: https://www.nrf.re.kr/page/oa-policy
- **한국 KISTI ScienceON**: https://scienceon.kisti.re.kr
- **한국 RISS**: https://www.riss.kr
- **ROR 한국 기관 목록**: https://ror.org/korea
- **OpenAIRE blog**: https://www.openaire.eu/blog
- **Scholarly Communications 인디미디어 (한국)**: https://www.facebook.com/groups/scholarlycommunications (커뮤니티)

**v1.5 신규: 핵심질문 트래거(Living Issue Tracker) 설계 벤치마크**:
- **Mozilla Position Papers**: https://www.mozilla.org/en-US/about/manifesto/ — position issues with status, references, history
- **W3C Technical Reports Index**: https://www.w3.org/TR/ — status (Draft/Recommendation) + 진행 중인 이슈
- **WhatWG HTML Living Standard Issues**: https://github.com/whatwg/html/issues — GitHub 기반 이슈 + status
- **18F / Civic Tech Issue Trackers**: https://github.com/18F — 공개 정부 이슈 추적 사례
- **Roadmap.sh (Developer Roadmaps)**: https://roadmap.sh/ — 주제별 진행률 추적 (v1.5의 질문 트래거와 가장 유사)
- **CivicActions Issue Tracker**: https://github.com/CivicActions/open-data — 공공 데이터 이슈 추적
- **EFF Issues & Campaigns**: https://www.eff.org/issues — 이슈별 status + 캠페인
- **ScholarlyHub Issue Tracker (예시)**: https://wellcomeopenresearch.org/blog — 오픈 액세스 관련 이슈 추적

**블로그/시냅스(syndication) 벤치마크**:
- **Substack academic (예: Chris Blattman, Marginal Revolution)**: 자체 호스팅 뉴스레터 + 외부 연결
- **미디엄 academic 태그**: https://medium.com/tag/open-access
- **브런치(brunch.co.kr) academic 글**: "학술연구" 태그
- **Hacker News 학술 토론**: https://news.ycombinator.com (외부 토론)
- **Twitter academic hashtag**: #OpenAccess #PlanS #OAMonday

**촉매 역할 관련 학술/업계 자료 (v1.4 신규)**:
- **"Library as a Catalyst" (ALA, 2018)**: https://www.ala.org/ — 도서관의 촉매 역할 프레임워크
- **"Bridge Services in Scholarly Communication" (Scholarly Kitchen, 2023)**: https://scholarlykitchen.sspnet.org — 학계 브릿지 서비스 사례
- **"OpenAlex Catalog of OA infrastructure"**: https://api.openalex.org/institutions — 글로벌 OA 인프라 지도
- **"한글 학술 콘텐츠 큐레이션 전략" (한국학술정보, 2021)**: 한국어 academic 콘텐츠 큐레이션
- **"Lenny's Newsletter - Onboarding" (Linh Bernstein)**: https://lennysnewsletter.com — 제품 온보딩 (1단계 vs 다단계 비교)
- **"Hotjar - 1-step onboarding case studies"**: https://www.hotjar.com/blog/onboarding/ — 1단계 onboarding 사례
- **"Nielsen Norman Group - Tooltip usability"**: https://www.nngroup.com/articles/tooltip-guidelines/ — 툴팁 UX 가이드

**한국 학술 환경 참고**:
- **F1000 "Open Insights: South Korea"**: https://www.f1000.com/open_thinking/open-insights-south-korea/
- **"Korea's national approach to Open Science" (2022)**: https://journals.sagepub.com/doi/10.1177/01655515221107336
- **KISTI OA 정책**: https://repository.kisti.re.kr/open-access
- **"OA 인식 부족" 5년 프로젝트 결론**: https://k-erc.eu/wp-content/uploads/2020/12/KOR-KISTI.pdf

**법/정책 참고**:
- **cOAlition S Plan S 원칙**: https://www.coalition-s.org/plan-s-principles/
- **NIH Public Access Policy**: https://publicaccess.nih.gov/
- **한국 NRF 학술연구정책**: https://www.nrf.re.kr/

**사용자 행동 참고**:
- **Springer Nature 2016 OA 저자 설문**: https://blogs.biomedcentral.com/bmcblog/2017/05/09/open-access-compliance-supporting-springer-nature-authors/ (40% 저자가 펀더 요건 미인지)
- **일본 NII 2006 OA 인지도 설문**: https://www.nii.ac.jp/sparc/doc/oa_report_ja.pdf
- **Nature "Confused by OA policies"**: https://www.nature.com/articles/d41586-023-00175-1
- **Jisc Open Policy Finder UX**: https://openpolicyfinder.jisc.ac.uk/

---

**v1.4 종료**. 다음 버전(v1.5) 후보:
- KISTI/NRF 직접 데이터 파트너십 (한국 OA 데이터 정밀화)
- GPT-4 다국어 정책 자동 번역 (영어 → 한국어 블로그 큐레이션 자동화)
- BullMQ 전환 (대량 외부 모니터링 작업 처리)
- syndication 자동화 (브런치/미디엄 교차 발행)
- B2B 기관 보고서 v2 (유료 컨설팅)

---

## 변경 이력 (요약)

| 버전 | 날짜 | 주요 변경 |
|---|---|---|
| v1.0 | 2026-06-29 | 초안 작성 — 페르소나, 아키텍처, DB, API, UI/UX, 로드맵 |
| v1.1 | 2026-06-29 | ROARMAP OAI-PMH 확인, Sherpa sunset 대응(시드 DB), ROR URL 검증, verdict 알고리즘 의사코드, 20+30 시드 |
| v1.2 | 2026-06-29 | cOAlition S JCT API 발견(Sherpa 대체), Europe PMC + OpenAlex 추가, JCT 우선 호출 |
| v1.3 | 2026-06-29 | 사용자 교육/참여 전략 추가 (Glossary 15개, FAQ 12선, 5단계 위저드, 7종 뱃지) |
| **v1.4** | **2026-06-29** | **방향성 전환: 촉매 + 외부 연결. 자체 호스팅 콘텐츠(Glossary/FAQ/위저드/뱃지) 폐기 → verdict 카드의 외부 4~5개 링크 + ScholarLink 블로그 (월 2편) + 외부 커뮤니티 라우팅** |
| **v1.4 추가 갱신** | **2026-06-29** | **블로그 도구 확정: 옵션 A (Astro + Cloudflare Pages) 채택 + 옵션 C의 티스토리 syndication 추가 (브런치/티스토리/미디엄 4채널, $0/월)** |
| **v1.5** | **2026-06-29** | **블로그 구조화: 핵심질문 트래거 (Living Issue Tracker) 신규. OA 이슈/정책 핵심질문 30개 시드 + Astro Content Collection + status badge (🔴/🟡/🟢) + 외부 thread 영구 추적. 모든 블로그 글은 1개 이상의 질문에 매핑. 시간 지날수록 콘텐츠 가치 compound.** |
| **v1.6** | **2026-07-02** | **블로그 광고 + ScholarLink 인트로 통합: bidvibe 광고 배너 (KR/EN, Top + Bottom fixed, 랜딩 페이지 디자인 재사용) + 각 블로그 글 헤더에 ScholarLink 인트로 박스 (verdict 도구 자가 노출). §14.8.7 신규 (8개 서브섹션) + syndication Step 0.5 + Layout 자동 통합 패턴 + KPI #15/#16 추가 + 구현 작업 4개 (ScholarLinkIntro.astro, bidvibe Astro 컴포넌트, Layout 패치, analytics 이벤트). Layout 1개 변경으로 모든 블로그 페이지에 자동 통합 — 글 작성 시 별도 작업 불요.** |
