# ScholarLink — 대학원생·연구원 모집공고 자동 수집 & 게시판 기능 코딩 계획서

> 작성일: 2026-07-02  
> 대상: ScholarLink (`wheeljah/SC_link`) 운영자  
> 목표: DOI/논문 다운로드를 넘어 **"학술 커리어 기회를 한 곳에서"** 라는 가치 제안 추가

---

## 1. 왜 이 기능을 붙이나 — 사용자 흐름과 가치

현재 ScholarLink는 **"논문/도서를 찾는 순간"** 의 가치를 갖는다. 하지만 사용자(대학원생·연구원)의 실제 정보 흐름은 더 넓다:

```
논문 검색  →  읽기  →  인용 정리  →  ↓↓↓ 여기가 공백 ↓↓↓  →  학회/공고  →  지원
                                "다음 어디로 가야 하지?"
```

**학술 잡·잡코리아·하이그래드넷을 매일 5개 사이트 돌아다니며 마감일 챙기는 행동**이 대학원생의 큰 마찰점이다. 이걸 ScholarLink 안에서 "논문 다운로드 → 같은 화면에서 내 분야 공고 보기" 흐름으로 흡수하면:

- **세션 깊이 ↑** — 한 번 들어오면 더 오래 머문다
- **재방문 트리거 ↑** — 마감 임박 공고 알림은 매일 들어올 이유
- **수익 모델 확장** — 학술 잡 광고 · 대학원 입시 컨설팅 제휴

---

## 2. 법적 리스크 분석 (★★★ 가장 먼저 정해야 할 것)

한국에서 크롤링은 다음 4개 법의 사각지대에 놓인다:

| 법률 | 적용 시나리오 | 우리 상황 |
|---|---|---|
| **정보통신망법 (ICNA) §48** | 접근 제한 우회 시 형사처벌 (5년/5천만원) | public 페이지만 → **gate-down 원칙으로 안전** |
| **저작권법 §93 (DB 제작자 권리)** | DB의 "전부 또는 실질적 부분" 복제 | **데이터 가공·재구성하면 회피 가능**, 단순 미러링은 위험 |
| **PIPA (개인정보보호법)** | 이름·이메일·연락처 수집 | **개인정보는 수집 안 함**, 공고 본문만 |
| **부정경쟁방지법 §2(1)(k)** | 경쟁사업 목적 free-riding | ScholarLink는 "공고 미러"가 아닌 **가공·추천** 서비스 |

### 2.1 한국 판례 핵심 3개

- **Yanolja 사건 (대법원 2021도1533, 2022.05.12)** — 공개 API 서버에 접근 제한이 없으면 ICNA 위반 아니다. **"gate up vs gate down" 원칙 확립**. 이게 우리 작업의 근거.
- **JobKorea v Saramin (대법원 2016나2019365)** — **VPN으로 IP 우회 + robots.txt 무시 + 채용공고 DB 미러링** → DB 제작자 권리 침해. 우리가 가장 경계해야 할 패턴.
- **GC Company v Yanolja (민사)** — 동일 사실관계로 형사 무죄 + 민사 10억 배상. **형사 무죄 ≠ 민사 면책**.

### 2.2 우리가 지켜야 할 안전장치 (법적 안전선)

1. **공개 페이지만 수집** — 로그인·캡차·API 키 요구 페이지 ❌
2. **robots.txt 존중** — `User-agent: *` + `Disallow: /path/` 경로는 skip
3. **개인정보 제외** — 담당자 이름·이메일·전화번호는 파싱 단계에서 **블랙리스트 정규식으로 즉시 drop**
4. **출처 표기 강제** — 모든 공고에 `source_name` + `original_url` + `crawled_at` 박제. **"우리는 미러가 아닌 검색·추천 엔진"이라는 입증 근거**
5. **요약·가공** — 원문 전체 복제 ❌, **제목·기관·기간·핵심 키워드** + 사용자 클릭 → 원본 이동
6. **요청 시 삭제** — `POST /api/v1/jobs/remove`로 원 사이트 관리자/원 작성자가 삭제 요청 가능 (DMCA 대응)

### 2.3 절대 피해야 할 소스

- **사람인·잡코리아·원티드** — 위 3개 판례에서 모두 유죄. **상업 채용 플랫폼 크롤링은 아예 금지**
- 로그인 필요 학과 게시판
- API 키가 닫힌 유료 DB

---

### 2.4 국내 대학원·연구원 모집 정보에 특화된 법적 쟁점

위 4개 법률 + 3대 판례는 모든 크롤링에 적용되는 **일반론**이다. 여기에 더해 **국내 학술 모집 정보**에서만 추가되는 6개 쟁점이 있다. ScholarLink는 이걸 정확히 알고 가야 한다.

#### 쟁점 ① — 학과 게시판 공고의 저작권 주체가 누구인가

| 공고가 올라간 곳 | 저작권 추정 주체 | 우리 대응 |
|---|---|---|
| **대학원 모집요강 PDF** (예: `grad.cau.ac.kr/_attach/...pdf`) | **대학 자체 저작물** (교무처 직원 職務上 저작물, 저작권법 §10) | 요약·가공은 OK, **원본 PDF 직접 재배포 ❌** |
| **학과 공지사항 게시판** | **대학 자산** (학장이 관리) | 제목·기간·링크만 저장, 본문은 요약 |
| **교수 연구실 홈페이지** (개별 워드프레스 등) | **교수 개인 저작물**일 수도, 대학 자산일 수도 — 양쪽 모두 검토 필요 | PII drop 더 엄격히 (교수 이메일·전화), 본문 요약 200자 이내 |
| **정부출연연 공고** (KIST·KISTI·NRF) | **공공저작물** (저작권법 §24의2, 업무상 작성) | **자유 이용 가능**, 공공누리 제0·1유형 — 단 출처 표기 필수 |
| **외부 플랫폼** (higrad.net) | **플랫폼 DB 제작자** | 우리가 higrad에서 가져오는 건 "공고 메타데이터(제목·기관·기간)"만, 본문은 higrad 링크로 |

#### 쟁점 ② — PIPA 적용의 "공적 존재" 예외 (★★★ 가장 중요한 안전판)

**대법원 2024. 6. 17. 선고 2020다239045 판결** (☆☆☆넷 교수 평가 사이트 사건)

> **"국립대학법인 교수라는 원고의 공적인 존재로서의 지위, 개인정보의 공공성과 공익성, 피고가 정보처리로 얻은 이익과 처리절차 및 이용형태, 정보처리로 인하여 원고의 이익이 침해될 우려의 정도 등을 종합적으로 고려하면, 교수의 개인정보자기결정권 등을 침해하는 위법한 행위로 평가할 수 없다."**

이 판결의 논리를 **우리에게 적용**하면:

- **대학 교수·연구원은 "공적 존재"** → 학과 게시판에 공개된 정보(이름·연구실·이메일)는 수집·가공·제공이 **위법성 낮음**
- 단, **"공개 목적 범위"를 넘어서는 활용은 별도 동의 필요** — 예: 마케팅 목적 / 광고 타겟팅 ❌
- **위법성 판단 6요소 종합 형량**: 정보주체의 공적성 / 정보의 공공성 / 처리 이익 / 처리 절차·이용 형태의 상당성 / 침해 우려 정도 / 정보주체 이익 vs 정보처리 이익

→ **우리 안전선**: 학과 공고 본문은 수집 OK, **단 학과 게시판에 있는 무관한 개인정보(예: 게시판 회원 정보)는 수집 ❌**, 수집한 정보는 **"공고 검색·추천" 목적 한정**으로만 사용.

#### 쟁점 ③ — 공공데이터법 적용 (NRF·KIST·KISTI 등)

**「공공데이터의 제공 및 이용 활성화에 관한 법률」 §3④·§17**

> "공공기관은 다른 법률에 특별한 규정이 있는 경우 또는 제28조제1항 각 호의 경우를 제외하고는 **공공데이터의 영리적 이용인 경우에도 이를 금지 또는 제한하여서는 아니 된다.**"

이게 큰 안전판이다:
- **NRF (한국연구재단)** — 공공기관 → 공고 데이터는 공공데이터법 적용 → 영리적 이용 가능
- **KIST·KISTI (정부출연연구기관)** — 「정부출연연구기관 등의 설립·운영 및 육성에 관한 법률」 적용 → 사실상 공공기관과 동급
- **KAIST·서울대 등 국공립 대학** — 「고등교육법」 §4에 따른 대학 → 공공기관
- **단, 사립대학(성균관·연세·고려·한양 등)**은 「사립학교법」 적용 → **공공데이터법 대상 아님** — 이때는 학과 게시판 공고 자체의 저작권 + PIPA만 적용

#### 쟁점 ④ — 「고등교육법 시행령 §28·§29」 대학원 모집요강 공표 의무

> "대학은 모집단위의 특성을 고려하여 수립한 대학원입학전형시행계획을 해당 대학의 홈페이지를 통해 공표하여야 한다. 모집시기별 선발인원 및 전형유형, 모집단위별 모집인원, ... 최저학력기준 등을 포함함"

이게 우리한테 중요한 이유: **법적으로 공개 의무가 있는 정보** → 크롤링의 정당성이 더 강해짐. "공개 의무가 있는 정보를 수집해서 사용자한테 더 잘 보여주는 것"은 사회적 가치가 명확.

#### 쟁점 ⑤ — 기간제법 §4 + 시행령 §3③8호 (연구원·박사후 공고 특수성)

> "각 목의 연구기관(국공립·정부출연연·기업부설·대학부설 등)에서 **연구업무에 직접 종사하는 경우** 또는 실험·조사 등을 수행하는 등 연구업무에 직접 관여하여 지원하는 업무에 종사하는 경우" → **기간제 2년 초과 사용 가능** (예외 규정)

연구기관 공고는 보통 이런 형태:
- 박사후 (postdoc) — 2년 계약 + 갱신 가능
- 시간제 위촉연구원 — 박사급, 2년 예외 적용
- 기간제 연구원 — 일반 사업 시 2년, 연구 예외 시 무제한

→ **공고 상세 페이지에 "고용형태 분류" 칩 표시 권장** (박사후 / 정규직 / 시간제 위촉 / 계약직). 이건 사용자도 필요하고, **공고 작성자(대학·연구소)가 부주의하게 2년 갱신 의무를 놓치는 걸 발견**하는 데도 도움됨.

#### 쟁점 ⑥ — 박사후·연구원의 "갱신기대권" (부산대병원 판례 패턴)

**KBS 보도 (부산지법)** — "기간제 연구원이 출산휴가 후 계약 불이익 → 법원: 갱신기대권 인정"

연구 기관에서 **공고에 "2년 계약, 갱신 가능" 식으로 써놓고 실제로 갱신 안 해주는 사례**가 적지 않음. 이런 공고가 ScholarLink에 보이면 사용자가 "이 연구실 위험할 수도" 라고 인식할 수 있게 — 사용자 후기·신고 기능과 연동하면 **ScholarLink의 사회적 가치가 또 하나 올라감** (다만 검열 리스크도 따라옴 — §10에서 별도 결정).

### 2.5 종합 안전선 — MVP 필수 5개 + Phase 2 추가 2개

이전 §2.2의 6개를 **대학원 모집 특수성 반영**으로 다시 정리:

| # | 안전선 | 대학원 모집 특수 적용 | MVP 필수? |
|---|---|---|---|
| **1** | 공개 페이지만 수집 (login·CAPTCHA 우회 ❌) | 동일 | ✅ 필수 |
| **2** | robots.txt 존중 | 동일 | ✅ 필수 |
| **3** | **PII drop** (이메일·전화·담당자) | **교수·박사후 공고는 "공적 존재" 예외 적용되지만, 광고 타겟팅·마케팅 목적 사용 ❌** 명시 | ✅ 필수 |
| **4** | **출처 표기** (source_name + canonical_url) | **사립대학 vs 국공립 차이** 명시 (개인정보 처리방침에 "공공성 가중 형량" 근거) | ✅ 필수 |
| **5** | **요약·가공** (원문 전체 ❌, 500자 이내) | **공공기관(NRF/KIST) 원문은 공공누리 제0·1유형으로 자유 이용 가능하지만, 우리는 요약 형태로 일관성 유지** | ✅ 필수 |
| **6** | 삭제 요청 워크플로 | DMCA + PIPA 동시 대응 | Phase 2 |
| **7** | 사립대학·민간연구소 공고 시 **사전 동의 옵션** (제휴 공고 등록 시 명시) | **교수·연구원이 "내 공고가 올라가도 좋다"고 명시한 경우만 요약 외 추가 정보 저장** | Phase 2 |

조사 결과, **3개월 이내 마감 + 공개 페이지 + 학술 관련** 조건으로 후보를 분류했다.

### 3.1 Tier A — MVP (수집 난이도 低, 가치 大) — **🇰🇷 국내 공고 전용**

> **2026-07-02 v1.3 결정**: 사용자가 "**국내 공고만 먼저 구현, 해외는 구성 중으로 표시**" 확정. MVP는 국내 소스로만 시작, 법적 안전선 검증도 한국법 한정. 해외 소스는 Phase 2 이후.

| 소스 | URL | 방식 | 빈도 | 라이선스 | 비고 |
|---|---|---|---|---|---|
| **KISTI RSS** | `kisti.re.kr/rss/research-task` 등 23개 피드 | RSS XML | 12h | ✅ 공공누리 | 정부출연연 채용·과제 |
| **NRF 채용** | `nrf.re.kr/cms/board/general/list?menu_no=54` | Cheerio | 12h | ✅ 공공누리 제1유형 | 한국연구재단 |
| **KIST 채용** | `kist.re.kr/ko/notice/employment-announcement.do` | Puppeteer | 12h | ✅ 공공누리 | 정부출연연 직접 채용 |
| **KAIST 채용/초빙** | `kaist.ac.kr/kr/html/footer/0814.html` | Cheerio | 12h | ✅ 공공저작물 | 국내 최다 모집 |
| **KISTI 직접 채용** | `kisti.fairy.im` + `kisti.recruitment.kr` | Cheerio | 12h | ✅ 공공누리 | RSS 미제공분 보완 |

### 3.2 Tier B — v1.1 (국내 확장)

| 소스 | URL | 방식 | 빈도 | 비고 |
|---|---|---|---|---|
| **서울대학교** | `snu.ac.kr` 채용·연구채용 게시판 | Cheerio | 24h | 국공립 1순위 |
| **부산대학교** | `pusan.ac.kr` 채용 공지 | Cheerio | 24h | |
| **서울과기대 (SeoulTech)** | `seoultech.ac.kr` 채용 공지 | Cheerio | 24h | 대학원생 권리장전 운영 |
| **GIST·DGIST·UNIST** | 각 교 채용 게시판 | Cheerio | 24h | 과학기술원 |
| **ETRI·KISTI·KRISS·KIER 등 출연연** | 각 기관 채용 | Cheerio | 24h | 정부출연연 확장 |
| **한국연구자정보(KIM)** | `kim.re.kr` | Cheerio | 24h | 학과 검색 가능 |

### 3.3 Tier C — 구성 중 (🌍 해외 공고) — **Coming Soon**

> **MVP 출시 시점에 페이지에는 "🌍 해외 공고" 탭이 보이지만, 선택하면 "곧 출시 예정" 메시지 표시 + 이메일 구독 폼 제공**.

| 소스 | 라이선스 / 정책 | 상태 | 활성화 조건 |
|---|---|---|---|
| **Springer Nature Meta API** | ✅ 공식 API, 무료 Basic, 스타트업 명시 허용 | 🔧 **구성 중** | Phase 2에서 W2-SpringerNature 모듈 작업 시 활성화 |
| **jobs.ac.uk RSS** | ✅ 공식 syndication | 🔧 **구성 중** | Phase 2 |
| **Science Careers (AAAS)** | ✅ 공식 RSS | 🔧 **구성 중** | Phase 2 |
| **AAS Job Register** | ✅ 공식 RSS | 🔧 **구성 중** | Phase 2 |
| **HigherEdJobs** | ✅ 공식 RSS | 🔧 **구성 중** | Phase 2 |
| **Nature Careers (Partner API)** | 공식 B2B 영업 필요 | 🔧 **구성 중** | partner.naturecareers.com 응답 후 |
| **잡코리아/원티드** | ❌ UCPA free-riding | ❌ **영구 제외** | — |
| **higrad.net** | ❌ UCPA free-riding | ❌ **영구 제외** | — |
| **Nature Careers RSS 직접** | ❌ robots.txt 차단 | ❌ **영구 제외** | — |

**해외 활성화 트리거**:
- Phase 2 진입 시점 (사용자 수요 100건/일 도달)
- Nature Partner API 영업 응답
- 자체 트래픽 검증 후 활성화 결정

### 3.4 국내 학과 게시판 — 사용자 직접 등록 모델 (Phase 4 보류)

- 사립대학 학과 게시판은 법적 회색 + 사이트 수천 개 → 자동 크롤 ❌
- 대신 **사용자 신고 / 직접 등록** 모델 (Wikipedia 스타일)
- Phase 4에서 검토

### 3.5 제외 결정된 소스 (변경 사유 명시)

| 소스 | 제외 사유 | 결론 |
|---|---|---|
| **higrad.net** | UCPA §2(1)(k) free-riding 리스크 (§2.6) | ❌ 영구 제외 |
| **Nature Careers RSS 직접** | `nature.com/robots.txt` `Disallow` 명시 | ❌ 영구 제외. Partner API만 가능 |
| **잡코리아·원티드·사람인** | 채용 정보 DB 미러링 1차 관례 (JobKorea v Saramin) | ❌ 영구 제외 |

### 3.6 Tier A 활성화 우선순위 (MVP 1차 → 2차)

| 순서 | 소스 | 이유 |
|---|---|---|
| **1순위** (MVP 1차) | KISTI RSS + NRF Cheerio | RSS 표준이라 가장 안정적, 둘로 이미 매일 ~30건 |
| **2순위** (MVP 2차) | KIST + KAIST Cheerio | 공공기관, 사용자 가치 큼 |
| **3순위** (v1.1) | KISTI 직접 채용 + 서울대·부산대 | 학과 직접 채용 |

### 3.4 소스 메타데이터 표준화 (스키마 통일)

모든 소스에서 추출 시 다음 필드로 정규화:

```ts
interface JobPosting {
  source_id: string;          // 'higrad', 'kist', 'nature' 등
  external_id: string;        // 소스 내 공고 ID
  canonical_url: string;      // 원본 URL (canonical link)
  title: string;              // 공고 제목
  organization: string;       // 모집 기관
  category: 'graduate' | 'postdoc' | 'researcher' | 'professor';
  fields: string[];           // 분야 태그 (예: ['AI', '신약개발'])
  deadline: Date | null;      // 마감일
  posted_at: Date | null;     // 게시일
  crawled_at: Date;
  summary: string;            // 본문 500자 이내 요약
  description_html: string;   // 원본 HTML (DB 저장만, API는 요약만 반환)
  // ★ PIPA 안전: 이메일·전화·담당자명은 파싱 단계에서 drop
}
```

---

### 3.5 소스별 라이선스 / syndication 정책 분류 (2026-07-02 업데이트)

| 소스 | 라이선스 / syndication 정책 | robots.txt | 우리 행동 |
|---|---|---|---|
| **Springer Nature Meta/OA API** | ✅ 공식 developer portal, 무료 Basic API key, 스타트업 명시 허용 | (API endpoint, robots 무관) | 자유 이용, 출처 표기 |
| **jobs.ac.uk** | ✅ **"Direct RSS syndication, by using the raw RSS feed as part of a server-side script, it is possible to tightly integrate our job listings with your own data"** — 공식 권장 | 확인 필요 (RSS 페이지 노출 OK) | RSS 표준, 원문 링크, 출처 박제 |
| **Science Careers (AAAS)** | ✅ 공식 RSS + Job alerts + E-Alert | 확인 필요 | 동일 |
| **AAS Job Register** | ✅ 공식 RSS, 24h 갱신, 카테고리별 feed | 확인 필요 | 동일 |
| **HigherEdJobs** | ✅ 공식 RSS feeds list 페이지 | 확인 필요 | 동일 |
| **NRF (한국연구재단)** | ✅ 공공기관 (한국연구재단법) — 공공누리 제1유형 | 확인 필요 | 자유 이용 + 출처 표기 |
| **KIST (한국과학기술연구원)** | ✅ 정부출연연구기관 — 공공누리 제0·1유형 | 확인 필요 | 자유 이용 |
| **KISTI (한국과학기술정보연구원)** | ✅ 정부출연연구기관 — RSS 직접 제공 중 | 확인 필요 | 자유 이용 |
| **KAIST** | ✅ 국공립대학 (고등교육법 §4) — 공공저작물 | 확인 필요 | 요약·가공 OK, 본문 원문 ❌ |
| **서울대·부산대 등 국공립** | ✅ 동일 | 확인 필요 | 동일 |
| **성균관·연세·고려·한양 등 사립** | ❌ 「사립학교법」 — 공공데이터법 비적용. 학과 게시판 = 대학 자산 | 확인 필요 | 요약·가공 + PII drop 엄격 |
| **~~higrad.net (하이그래드넷)~~** | ❌ UCPA §2(1)(k) free-riding 리스크 | (확인 불필요 — 제외) | **MVP·v1.1·v2.0 전부 제외** |
| **~~Nature Careers RSS 직접~~** | ❌ robots.txt `Disallow: /naturecareers/jobs` 및 `/naturecareers/jobsrss/` | ❌ 차단 확인 | **RSS 직접 ❌**. partner API 통해서만 가능 (Tier C) |

### 3.6 단계별 소스 추가 시 라이선스 검증 체크리스트

새 소스 추가 시 admin이 다음 3개 확인:
1. **공공기관인가?** — yes면 공공누리 라이선스 확인, no면 학과 게시판 / 민간 플랫폼별 정책 확인
2. **RSS 또는 API 제공?** — yes면 표준 따라감 (가장 안전), no면 Cheerio/Puppeteer 어댑터 필요
3. **DB 제공?** — yes면 위험 (직접 API 계약 권장), no면 페이지 크롤링

---

`server/src/db/migrate.ts` 끝에 추가. 기존 `IF NOT EXISTS` / `ALTER ADD COLUMN IF NOT EXISTS` 패턴 따라간다.

```sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 대학원생/연구원 모집공고 (v1.0, 2026-07-02)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 소스 정의 (어떤 사이트를 어디서 어떻게 가져오는지)
CREATE TABLE IF NOT EXISTS job_sources (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(50) UNIQUE NOT NULL,   -- 'higrad', 'kist', 'nature'
  name            VARCHAR(255) NOT NULL,         -- '하이그래드넷'
  base_url        TEXT NOT NULL,
  crawl_method    VARCHAR(20) NOT NULL,          -- 'rss' | 'cheerio' | 'puppeteer'
  cron_expr       VARCHAR(50) DEFAULT '0 */6 * * *', -- 6시간마다
  enabled         BOOLEAN DEFAULT TRUE,
  robots_txt_url  TEXT,
  last_crawled_at TIMESTAMP,
  last_status     VARCHAR(20),                   -- 'ok' | 'error' | 'blocked'
  last_error      TEXT,
  rate_limit_ms   INTEGER DEFAULT 3000,          -- 요청 간 최소 간격
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_job_sources_enabled ON job_sources(enabled);

-- 정규화된 공고 (source별 unique 제약)
CREATE TABLE IF NOT EXISTS job_postings (
  id                SERIAL PRIMARY KEY,
  source_id         INTEGER REFERENCES job_sources(id) ON DELETE CASCADE,
  external_id       VARCHAR(255) NOT NULL,
  canonical_url     TEXT NOT NULL,
  title             TEXT NOT NULL,
  organization      VARCHAR(255),
  category          VARCHAR(30),                  -- 'graduate' | 'postdoc' | 'researcher' | 'professor'
  fields            TEXT[],                       -- PG 배열
  deadline          TIMESTAMP,
  posted_at         TIMESTAMP,
  summary           TEXT,                          -- 500자 이내
  description_html  TEXT,                          -- 원본 HTML (캡처용)
  description_hash  VARCHAR(64),                   -- 중복·변경 감지 (sha256 of html)
  language          VARCHAR(10) DEFAULT 'ko',
  is_active         BOOLEAN DEFAULT TRUE,          -- 마감 지나면 FALSE로 자동 비활성
  is_removed        BOOLEAN DEFAULT FALSE,         -- 원본 측 삭제 요청 시
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_job_postings_deadline ON job_postings(deadline) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_job_postings_category ON job_postings(category);
CREATE INDEX IF NOT EXISTS idx_job_postings_active   ON job_postings(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_job_postings_fields   ON job_postings USING GIN (fields);
CREATE INDEX IF NOT EXISTS idx_job_postings_search   ON job_postings USING GIN (to_tsvector('simple', title || ' ' || COALESCE(organization, '')));

-- region 컬럼 추가 (🇰🇷 국내 / 🌍 해외 — v1.3 추가)
ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS region VARCHAR(10) DEFAULT 'kr';
CREATE INDEX IF NOT EXISTS idx_job_postings_region ON job_postings(region);

-- 해외 공고 출시 알림 구독자 (v1.3 추가, 비로그인 가능)
CREATE TABLE IF NOT EXISTS foreign_interest_signup (
  id              SERIAL PRIMARY KEY,
  email           VARCHAR(255) NOT NULL,
  fields          TEXT[],                            -- 관심 분야 배열 (AI/생명과학/물리 등)
  source          VARCHAR(50) DEFAULT 'web',         -- 'web' / 'app' 등
  notified_at     TIMESTAMP,                         -- 출시 알림 발송 시각 (NULL = 미발송)
  unsubscribed_at TIMESTAMP,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (email)
);
CREATE INDEX IF NOT EXISTS idx_foreign_interest_notified ON foreign_interest_signup(notified_at);

-- 사용자별 키워드 구독
CREATE TABLE IF NOT EXISTS job_subscriptions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  keywords    TEXT[] NOT NULL,                     -- ['AI', 'postdoc', '서울']
  categories  TEXT[],                              -- ['postdoc', 'researcher']
  notify_email  BOOLEAN DEFAULT TRUE,
  notify_weekly BOOLEAN DEFAULT TRUE,              -- 주 1회 다이제스트
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_job_subs_user ON job_subscriptions(user_id);

-- 사용자별 스크랩 (북마크)
CREATE TABLE IF NOT EXISTS job_bookmarks (
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  job_id     INTEGER REFERENCES job_postings(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, job_id)
);

-- 원본 측 삭제 요청 (DMCA / 권리자 대응)
CREATE TABLE IF NOT EXISTS job_removal_requests (
  id          SERIAL PRIMARY KEY,
  source_id   INTEGER REFERENCES job_sources(id),
  external_id VARCHAR(255),
  requester_email VARCHAR(255) NOT NULL,
  reason      TEXT,
  status      VARCHAR(20) DEFAULT 'pending',      -- 'pending' | 'processed' | 'rejected'
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP
);

-- 크롤러 실행 로그
CREATE TABLE IF NOT EXISTS job_crawl_logs (
  id           SERIAL PRIMARY KEY,
  source_id    INTEGER REFERENCES job_sources(id) ON DELETE CASCADE,
  started_at   TIMESTAMP NOT NULL,
  finished_at  TIMESTAMP,
  items_new    INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  items_skipped INTEGER DEFAULT 0,
  status       VARCHAR(20),                       -- 'ok' | 'error'
  error        TEXT
);
CREATE INDEX IF NOT EXISTS idx_job_crawl_logs_source ON job_crawl_logs(source_id, started_at DESC);

-- 사용자 공지 알림 (사용자에게 보낸 발송 이력)
CREATE TABLE IF NOT EXISTS job_alert_logs (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  job_id      INTEGER REFERENCES job_postings(id) ON DELETE CASCADE,
  sent_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  channel     VARCHAR(20) DEFAULT 'email'         -- 'email' | 'inbox'
);
CREATE INDEX IF NOT EXISTS idx_job_alert_logs_user ON job_alert_logs(user_id, sent_at DESC);
```

---

## 5. 크롤러 아키텍처

### 5.1 어댑터 패턴

```ts
// server/src/services/jobSources/types.ts
export interface JobSourceAdapter {
  code: string;
  fetchList(opts: { sinceDays?: number; page?: number }): Promise<RawJobItem[]>;
  fetchDetail?(url: string): Promise<RawJobDetail | null>;
}

// server/src/services/jobSources/higradAdapter.ts
// server/src/services/jobSources/kistiRssAdapter.ts
// server/src/services/jobSources/kistPuppeteerAdapter.ts
// ...
```

- **공통 인터페이스**로 정규화 → `jobCrawlerService.run(sourceId)`가 어댑터 호출만 신경 씀
- 어댑터 추가 시 DB `job_sources` 1 row + 어댑터 클래스 1개만 만들면 됨
- **PII drop 정규식**은 `pipelineService.sanitizeHtml()`에 중앙화

### 5.2 레이어 분리

```
[Scheduler (node-cron)]
       ↓
[Orchestrator: jobCrawlerService.run()]
   - robots.txt 체크
   - Rate-limit (source별 sleep)
   - 어댑터 호출
       ↓
[Adapter: higrad / kisti-rss / kist-puppeteer / ...]
   - HTTP 요청 (axios / cloudscraper / puppeteer)
   - HTML/XML 파싱 (cheerio / fast-xml-parser)
   - 정규화
       ↓
[Pipeline: jobPipelineService.upsert()]
   - PII drop 정규식 (이메일·전화·담당자)
   - HTML sanitize (XSS)
   - 중복 체크 (description_hash)
   - UPSERT (ON CONFLICT (source_id, external_id) DO UPDATE)
       ↓
[DB]
```

### 5.3 robots.txt 존중 (★★ 필수)

```ts
// robots.txt 파서 — npm `robots-parser` 사용 권장
import { Robot } from 'robots-parser';
const robots = await Robot.fromURL(robotsUrl);
if (!robots.isAllowed(url, 'ScholarLinkBot/1.0')) {
  logger.warn(`[robots] disallowed: ${url}`);
  return null;
}
```

### 5.4 Rate-limit + Exponential Backoff

- 소스별 최소 간격: `job_sources.rate_limit_ms` (기본 3초)
- 실패 시 1s → 2s → 4s → 8s backoff, 5회 후 source 잠시 disable (1h)

### 5.5 PII Drop 정규식 (★★★ PIPA 안전선)

```ts
// server/src/services/jobSources/piiSanitizer.ts
const PII_PATTERNS = [
  /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g,          // email
  /\b01[0-9][-\s]?\d{3,4}[-\s]?\d{4}\b/g,    // 한국 전화번호
  /\b\d{2,3}[-\s]?\d{3,4}[-\s]?\d{4}\b/g,    // 일반 전화
  /(?:담당|연락처|문의)[:：]?\s*[^\n]{0,80}/gi,
  /(?:교수|박사|연구원|조교)\s+[가-힣]{2,4}(?=\s|님)/g, // 담당자 이름 (휴리스틱)
];
export function sanitize(html: string): string {
  let out = html;
  for (const re of PII_PATTERNS) out = out.replace(re, '[redacted]');
  return out;
}
```

---

## 6. API 설계

### 6.1 공개 API (비로그인 가능, 단 rate-limit 강화)

```
GET  /api/v1/jobs?category=&keyword=&field=&deadline_within=90d&page=1&limit=20
GET  /api/v1/jobs/:id
GET  /api/v1/jobs/sources          # 활성화된 소스 목록 + 마지막 크롤 시각
GET  /api/v1/jobs/fields           # 분야 태그 카운트 (facet)
```

### 6.2 인증 필요 API

```
POST   /api/v1/jobs/subscriptions           # 키워드 구독 등록/갱신
GET    /api/v1/jobs/subscriptions/me
DELETE /api/v1/jobs/subscriptions/:id
POST   /api/v1/jobs/:id/bookmark            # 스크랩
DELETE /api/v1/jobs/:id/bookmark
GET    /api/v1/jobs/bookmarks/me
POST   /api/v1/jobs/remove                  # 원본 측 삭제 요청 (PIPA 대응)
```

### 6.3 어드민

```
POST   /api/v1/admin/jobs/sources           # 소스 추가
PATCH  /api/v1/admin/jobs/sources/:id       # enabled 토글 / rate-limit 조정
POST   /api/v1/admin/jobs/sources/:id/run   # 수동 즉시 크롤 트리거
GET    /api/v1/admin/jobs/crawl-logs        # 크롤 로그
GET    /api/v1/admin/jobs/removal-requests  # 삭제 요청 검토
```

### 6.4 응답 스키마 예

```json
GET /api/v1/jobs?keyword=AI&deadline_within=90d
{
  "items": [{
    "id": 1234,
    "title": "KAIST AI대학원 2027학년도 전기 신입생 모집",
    "organization": "KAIST",
    "category": "graduate",
    "fields": ["AI", "컴퓨터공학"],
    "deadline": "2026-07-25T23:59:59Z",
    "days_left": 23,
    "source": { "code": "higrad", "name": "하이그래드넷" },
    "canonical_url": "https://higrad.net/gradstudent/recruits/3587046?..."
  }],
  "total": 42,
  "page": 1,
  "sources_last_crawled": { "higrad": "2026-07-02T11:42:00Z", ... }
}
```

---

## 7. 프론트엔드 페이지

### 7.1 신규 페이지

| 라우트 | 컴포넌트 | 기능 |
|---|---|---|
| `/jobs` | `Jobs` | 공고 목록 (필터·검색·무한스크롤) |
| `/jobs/:id` | `JobDetail` | 상세 + 원본 이동 + 스크랩 |
| `/jobs/subscriptions` | `JobSubscriptions` | 키워드 구독 관리 |
| `/admin/jobs` | `AdminJobs` | 소스 관리 + 크롤 로그 + 삭제 요청 검토 |

### 7.2 컴포넌트 (재사용)

- `JobCard` — 공고 한 건 (제목·기관·D-day·분야 칩·스크랩 버튼)
- `JobFilterBar` — 카테고리/분야/마감/키워드
- `SourceBadge` — "출처: 하이그래드넷" 작은 배지
- `DeadlineChip` — `D-7` 빨강 / `D-30` 주황 / 그 외 초록
- `SubscribeKeywordForm` — 키워드/카테고리 입력

### 7.3 네비게이션 통합

`Navbar`에 **"🎓 커리어"** 메뉴 추가 (2026-07-02 결정 반영). Home 페이지 하단 "이 분야 다른 기회" 위젯도 같이 노출 (다운로드한 논문 분야 → 매칭 공고 추천 = SEO 가치 ↑).

---

### 7.4 수익 슬롯 — 결정 ④ 반영 (3가지만 사용)

2026-07-02 합의: **수익 슬롯 3개만 사용**. 다른 2개(대학원 가이드, 논문 작성 도구)는 보류.

```
┌─────────────────────────────────────────────┐
│  📌 공고 본문 요약                            │
│  ... (최대 500자)                            │
│  [원문 보기 →]                                │  ← 슬롯 1: 본문 요약
├─────────────────────────────────────────────┤
│  💼 관련 채용/공고 3건                       │  ← 슬롯 2: cross-link
│  · 같은 분야 다른 마감 3건 자동 노출          │     (MVP 즉시 구현)
├─────────────────────────────────────────────┤
│  📝 공고 등록하기                            │  ← 슬롯 3: B2B 폼
│  · 대학원·연구소가 직접 공고 등록             │     (Phase 2에서 활성화)
└─────────────────────────────────────────────┘
```

| # | 슬롯 | 용도 | 구현 시점 |
|---|---|---|---|
| **1** | 공고 본문 요약 | 500자 이내 핵심만, "원문 보기" 버튼으로 외부 이동 | **MVP** |
| **2** | 관련 채용/공고 3건 | 같은 `fields[]` 태그 + 90일 이내 마감인 다른 공고 3건 자동 노출 | **MVP** |
| **3** | 공고 등록하기 | 대학원·연구소가 직접 공고 올리는 폼 (B2B 수익 — 입시 컨설팅·연구기관 채용 비용 청구) | **Phase 2** |

보류 슬롯 (향후 확장 여지):
- "같은 분야 대학원 가이드" — 하이그래드넷/입시 컨설팅 제휴 시
- "논문 작성 도구" — 인용 정리 / 영문 교정 제휴 시

### 7.5 슬롯 2번 (관련 공고 3건) MVP 쿼리

```sql
-- 현재 공고와 같은 분야 + 90일 이내 마감 + 다른 공고 3건
SELECT id, title, organization, deadline, source_id
FROM job_postings
WHERE id != $currentId
  AND is_active = TRUE
  AND deadline BETWEEN NOW() AND NOW() + INTERVAL '90 days'
  AND fields && $currentFields  -- GIN 인덱스 활용
ORDER BY deadline ASC
LIMIT 3;
```

### 7.6 🇰🇷 국내 / 🌍 해외 탭 + "구성 중" UX (2026-07-02 v1.3 결정)

사용자 결정: **MVP는 국내 공고만**, 해외는 "구성 중" 표시. UX 설계:

#### 탭 구조

```
┌─────────────────────────────────────────────────┐
│  [🇰🇷 국내 공고 (231)]   [🌍 해외 공고 (구성 중)]  │
└─────────────────────────────────────────────────┘
```

#### 🇰🇷 국내 공고 탭 (MVP 출시 시 활성)

- 전체 목록·필터·검색 — 평소처럼 동작
- 출처 배지: "KISTI" / "NRF" / "KIST" / "KAIST" 등

#### 🌍 해외 공고 탭 (구성 중 상태)

```
┌─────────────────────────────────────────────────┐
│                                                 │
│              🌍 해외 공고                        │
│                                                 │
│        지금 열심히 준비하고 있습니다              │
│                                                 │
│   Springer Nature · AAAS Science Careers        │
│   jobs.ac.uk · AAS · HigherEdJobs               │
│                                                 │
│   ────────────────────────────────────          │
│                                                 │
│   📬 출시 알림 받기                              │
│                                                 │
│   [이메일 입력____________________________]      │
│   [관심 분야 선택: ☐ AI ☐ 생명과학 ☐ 물리 ...]   │
│   [🔔 출시되면 알림 받기]                         │
│                                                 │
│   ────────────────────────────────────          │
│                                                 │
│   또는 직접 문의: hello@scholarlink.com         │
│                                                 │
└─────────────────────────────────────────────────┘
```

#### UX 디테일

- **탭 hover/click 차이**: 🇰🇷 탭은 활성 상태(컬러 강조), 🌍 탭은 "준비 중" 배지(회색 + 🔧 아이콘) — 클릭은 가능하지만 콘텐츠는 위 안내 페이지
- **이메일 구독은 비로그인도 가능** — 사용자가 출시 알림 받기 쉽게
- 관심 분야 선택은 **복수 선택** (체크박스) → 출시 시 분야별 맞춤 알림
- 제출 후 **"등록 완료! 출시되면 알려드릴게요 🎓"** 토스트 + DB에 `foreign_interest_signup` 1 row INSERT

#### 빈 탭이 아닌 이유

- 사용자 입장에서 **"여기도 곧 나온다"는 신호** = 신뢰감
- 이메일 수집 = 출시 시 마케팅 기반
- 숨기면 사용자가 "해외 공고 왜 없냐"고 묻는 부담

---

## 8. 알림 시스템

### 8.1 채널

- **이메일 다이제스트** — 사용자 구독 키워드 매칭 신규 공고 주 1회 (월요일 오전 9시 KST)
- **마감 임박 알림** — 사용자 스크랩한 공고 마감 7일·3일·1일 전
- **인박스 알림** — 로그인 시 상단 벨 아이콘 (기존 알림 인프라 확장)

### 8.2 구현

기존 `emailService.ts` 확장:

```ts
// sendJobDigest(userId, matchedJobs[])
// sendJobDeadlineReminder(userId, job, daysLeft)
// notify_new_job_match(userId, job) -- 내부 fire-and-forget
```

기존 `communityController`의 fire-and-forget 패턴 그대로 따라가면 됨 (이메일 실패가 API 응답에 영향 없도록).

---

## 9. 단계별 로드맵

### Phase 1 — MVP (3주, 🇰🇷 국내 전용)

**목표: "국내 대학원·연구기관 공고를 매일 5분이면 본다" — 핵심 가치 검증**

| 주차 | 백엔드 | 프론트 | 비고 |
|---|---|---|---|
| W1 | DB 스키마 + `job_sources` 시드 (region=kr 4종) + **`kistiRssAdapter`** + `jobCrawlerService` + cron 등록 | — | KISTI RSS 1개로 시작 (가장 안정적) |
| W2 | **`nrfCheerioAdapter`** + PII sanitizer + robots.txt + crawl_logs | `Jobs` 목록 페이지 + `JobCard` + 🇰🇷/🌍 탭 + 🌍 "구성 중" + 이메일 구독 폼 | PII·robots·에러 처리 검증, 해외 알림 수집 시작 |
| W3 | 공개 API + 검색·필터 + 마감 임박 정렬 | `JobDetail` + 검색 UX | DB 인덱스·쿼리 성능, region 필터 |

**Phase 1 끝 = 1차 사용자 검증 가능** (소스 2개로 매일 ~30~50건 자동 수집)

> **2026-07-02 v1.3 결정**: MVP 범위 = 국내 소스만. 해외는 "구성 중" 표시 + 이메일 수집만. 법적 안전선 검증도 한국법(PIPA·공공데이터법·저작권법) 한정.

### Phase 2 — 알림 & 개인화 + 국내 확장 (3주)

- 사용자 구독 모델 (`job_subscriptions`) + 키워드 매칭
- 주간 다이제스트 이메일
- 스크랩 / 마감 임박 알림
- 어드민: 소스 토글 + 크롤 로그 + 수동 트리거
- **국내 소스 확장** — KIST·KAIST·서울대·부산대·UNIST·GIST·DGIST 등 추가 (Tier B)
- **해외 출시 알림 발송** — foreign_interest_signup 테이블 구독자에게 "해외 공고 출시" 메일

### Phase 3 — 🌍 해외 활성화 (조건부, 2~4주)

**활성화 트리거**: 사용자 트래픽·수요 + Nature Partner API 영업 응답 후 진행
- **Springer Nature Meta/OA API 통합** — 어댑터 작성 (Phase 3 W1)
- **jobs.ac.uk 공식 RSS 어댑터**
- **Science Careers (AAAS) + AAS Job Register RSS 어댑터**
- **Nature Careers Partner API** — 영업 응답 오면 통합 (B2B 계약)
- 분야 자동 태깅 (다국어)

### Phase 4 — 폴리싱 + DMCA (1주)

- DMCA 삭제 요청 워크플로
- 사용자 신고 (`이 공고 만료됐어요` 버튼)
- 분야 facet + 추천 (사용자 다운로드 논문 분야 → 매칭 공고)

**총 8~12주 / 약 60~80시간 개발 추정 (Phase 3는 해외 활성화 시점에 따라 변동).**

---

## 10. 결정사항 + 다음 행동 (2026-07-02 합의)

### ✅ 합의된 결정 5가지

| # | 결정 | 선택 |
|---|---|---|
| 1 | 네이밍 | **"🎓 커리어"** — 학술 인생 umbrella 단어, MVP 후 박사후·교수 공고 확장까지 커버 |
| 2 | 크롤 cadence | **Springer Nature API 12h / jobs.ac.uk 12h / KISTI 12h / NRF 12h** — 마감 임박(D-7) 놓치지 않는 선에서 Render 부담 최소화 (higrad 제외로 총 4종, 모두 12h) |
| 3 | 법적 안전선 | **§2에서 별도 정리, PII drop + 출처 표기 + 요약·가공 + 학술 공고 특수성 검토** 모두 반영 |
| 4 | 수익 슬롯 | **3개만 사용** — (1) 공고 본문 요약, (2) 관련 채용/공고 3건 (cross-link), (3) 공고 등록하기 (B2B 폼). 다른 2개 슬롯(대학원 가이드, 논문 작성 도구)은 보류 |
| 5 | **소스 변경** | **higrad.net 제외** (UCPA §2(1)(k) free-riding 리스크), **Nature Careers RSS 직접 제외** (robots.txt 차단) → MVP는 **Springer Nature 공식 API + jobs.ac.uk 공식 RSS + 공공 RSS** 4종으로 시작 |

### 다음 행동 (W1 시작 전 마무리)

1. ✅ higrad.net 제외 확정, ✅ Nature Careers RSS 직접 차단 확인
2. **Springer Nature Developer Portal 가입** — `dev.springernature.com` → 무료 Basic API key 발급 (이메일 인증만)
3. **jobs.ac.uk RSS feeds 페이지 직접 fetch** — `jobs.ac.uk/feeds/type-roles`에서 실제 feed URL 목록 확보
4. **kisti.re.kr / nrf.re.kr robots.txt 점검** (마지막 확인)
5. **Springer Nature partner.naturecareers.com 영업 메일 발송** — 부록 D의 템플릿 사용 (응답 오면 Phase 3에서 통합)
6. DB 마이그레이션 (`job_sources` 시드: springer-nature-api + jobs-ac-uk + kisti-rss + nrf = 4종) + `springerNatureApiAdapter` 프로토타입
7. 첫 cron 1회 실행 → §2 안전선 검증 (PII drop 정상 작동?)
8. 5건 정도 정상 수집 확인되면 W1 종료, W2로

---

## 부록 C — 국내 대학원 모집 정보 법률 참고 (추가)

### 판례

- **대법원 2024. 6. 17. 선고 2020다239045** — ☆☆☆넷 교수 평가 사이트 사건. **공적 존재인 교수의 공개 정보는 개인정보자기결정권 침해 아님**, 단 6요소 형량 필요.
- **대법원 2023도17354** — 크롤링으로 수집한 DB의 **유사도 90% 이상 복제 시 유죄**. → 요약·가공으로 회피 가능.
- **대법원 2023도1086** — Yanolja 법리 재확인. 객관적 사정 기준.
- **대법원 2021도1533 (2022. 5. 12.)** — Yanolja 크롤링 무죄 확정.
- **서울고법 2016나2019365 (2017. 4. 6.) → 대법원 2017다224395** — 사람인 v 잡코리아, DB 제작자 권리 침해 (우리 회피 패턴 학습).

### 법률 / 행정규칙

- **개인정보보호법 (PIPA)** §15 (수집·이용), §22 (만14세 미만 아동), §24 (민감정보), §17 (제3자 제공), §36 (안전조치)
- **저작권법** §2 (정의), §10 (職務上 저작물), §24의2 (공공저작물 자유이용), §93 (DB 제작자 권리)
- **공공데이터의 제공 및 이용 활성화에 관한 법률** §3 (영리적 이용 허용), §17 (제공대상 범위), §28 (접근제한 금지), §36 (면책)
- **부정경쟁방지법** §2(1)(k) — 데이터 free-riding
- **정보통신망법 (ICNA)** §48 (정보통신망 침입)
- **기간제 및 단시간근로자 보호 등에 관한 법률** §4 (사용기간 제한) + 시행령 §3③8호 (연구기관 예외)
- **고등교육법** §4 + 시행령 §28·§29 (대학원 모집요강 공표 의무)

### 공공누리 라이선스 6유형 (공공데이터)

| 유형 | 표시 | 범위 |
|---|---|---|
| **제0유형** 자유이용 | (없음) | 출처·상업·변형 모두 OK |
| **제1유형** 출처표시 | ① | 출처만 밝히면 상업·변형 OK |
| **제2유형** 출처표시+상업금지 | ② | 비영리만 |
| **제3유형** 출처표시+변경금지 | ③ | 상관없이 변경만 ❌ |
| **제4유형** 출처표시+상업금지+변경금지 | ④ | 가장 엄격 |
| **AI유형** AI 학습용 | AI | 출처·상업·변형 모두 OK, AI 학습 전용 |

### 기타 자료

- PIPC (개인정보보호위원회) — `pipc.go.kr`
- 공공데이터포털 — `data.go.kr`
- KISTI RSS — `kisti.re.kr/rss-help/pageView/178`
- 한국교육과정평가원 입학전형기본사항 — `kcue.or.kr`
- PIPA 가이드라인 (2024) — 공개 가능 정보의 크롤링·스크래핑 명시 언급

---

Phase 1 시작 전 아래 사이트 robots.txt 확인:

```bash
curl https://higrad.net/robots.txt
curl https://www.kisti.re.kr/robots.txt
curl https://www.nrf.re.kr/robots.txt
curl https://www.nature.com/robots.txt
```

`User-agent: *` + `Disallow: /recruits` 같은 명시적 차단은 없고, 대부분 `/admin`, `/login`, `/search?` 정도만 차단하는 패턴. **higrad / KISTI RSS는 사실상 풀 오픈**으로 예상.

---

## 11. 결정 매트릭스 + 빠른 참조 (W1 시작용)

### 11.1 합의된 결정사항 요약 (2026-07-02)

| # | 결정 | 선택 | 근거 |
|---|---|---|---|
| **1** | 메뉴 네이밍 | **"🎓 커리어"** | 학술 인생 umbrella, 광고 자리 확장 친화 |
| **2** | 크롤 cadence | KISTI 12h / NRF 12h / KIST 12h / KAIST 12h (국내 4종 통일) | 모두 12h, Render 부담 최소화 + 마감 임박(D-7) 커버 |
| **3** | 법적 안전선 | PII drop + 출처 표기 + 요약·가공 + §2.4 특수성 (5개) | §2.5 종합 안전선 표 참조, **한국법 한정** |
| **4** | 수익 슬롯 | 3개만: ①본문요약 ②관련 공고 3건 ③공고 등록하기 | §7.4 |
| **5** | **소스 후보 (Tier C 제외)** | higrad 영구 제외, Nature Careers RSS 직접 영구 제외, 잡코리아/원티드 영구 제외 | §2.6 (UCPA), §3.5 (robots.txt 검증) |
| **6** | **MVP 범위 (v1.3 신규)** | **🇰🇷 국내 공고만 구현**, 🌍 해외 공고는 "구성 중" + 이메일 출시 알림 수집. 해외 소스 통합은 Phase 3에서 (트래픽·Nature 영업 응답 후) | §3.1, §7.6, §9 Phase 1 |

### 11.2 국내 대학원 모집 정보 법적 안전선 (MVP 출시 전 필수)

1. **공개 페이지만 수집** — login·CAPTCHA·API key 우회 ❌
2. **robots.txt 존중** — 차단 경로 skip
3. **PII drop** — 이메일·전화·담당자명 즉시 drop (PIPA §22)
4. **출처 표기** — `source_name` + `original_url` + `crawled_at` 박제
5. **요약·가공** — 500자 이내 + "원문 보기" 버튼 (저작권법 §93 DB 권리 회피)

### 11.3 공공기관 / 사립 / 공식 API 분류별 주의사항

| 구분 | 추가 적용 법률 / 라이선스 | 우리 행동 |
|---|---|---|
| **공공기관 (NRF·KIST·KISTI·국공립대학)** | 공공데이터법 §3④ (영리적 이용 가능) | 자유 이용 + 출처 표기만으로 충분 |
| **공식 syndication / API (Springer Nature·jobs.ac.uk·Science Careers·AAS·HigherEdJobs)** | 각 사이트의 공식 syndication 정책 | RSS 표준 / API key, 원문 링크, 출처 박제 |
| **사립대학 (성균관·연세·고려·한양 등)** | 사립학교법, 일반 저작권법 + PIPA | 요약·가공 + PII drop 엄격 |
| **❌ higrad (제외)** | UCPA §2(1)(k) free-riding 리스크 | MVP·v1.1·v2.0 전부 제외 |
| **❌ Nature Careers RSS 직접 (제외)** | robots.txt `Disallow: /naturecareers/jobs` | RSS 직접 ❌. partner API 통해서만 (Phase 3) |

### 11.4 W1 시작 전 즉시 체크리스트 (v1.3 — 🇰🇷 국내 우선)

- [ ] ✅ higrad.net 제외, ✅ Nature Careers RSS 직접 제외 확정
- [ ] ✅ 해외는 "구성 중" 표시 + 이메일 출시 알림 수집으로 결정
- [ ] `kisti.re.kr`, `nrf.re.kr` robots.txt 마지막 확인
- [ ] **DB 마이그레이션** — `region` 컬럼 + `foreign_interest_signup` 테이블 추가 (§4)
- [ ] `job_sources` 시드: **KISTI RSS + NRF Cheerio = 2종** (region=kr, enabled=true)
- [ ] `piiSanitizer.ts` 단위 테스트 (이메일·전화 정규식)
- [ ] **`kistiRssAdapter`** 프로토타입 + cron 1회 실행 → 5건 정상 수집 검증
- [ ] **`nrfCheerioAdapter`** 프로토타입 + cron 1회 실행 → 5건 정상 수집 검증
- [ ] 🇰🇷/🌍 탭 UI — 국내 탭은 활성, 해외 탭은 "구성 중" 페이지 + 이메일 폼
- [ ] `POST /api/v1/jobs/foreign-interest` — foreign_interest_signup INSERT
- [ ] 5~10건 정상 수집 + PII drop 검증 + 이메일 폼 동작 확인되면 W1 종료

**Phase 2에서 추가 (W4~W6)**:
- [ ] KIST Puppeteer 어댑터
- [ ] KAIST Cheerio 어댑터
- [ ] 서울대·부산대 Cheerio 어댑터
- [ ] 사용자 구독 + 주간 다이제스트 이메일

**Phase 3에서 추가 (조건부)**:
- [ ] 사용자 트래픽·수요 확인
- [ ] Springer Nature Developer Portal 가입 + Meta API key 발급
- [ ] Nature Partner 영업 메일 발송 (부록 E 템플릿)

---

## 부록 B — 참고 자료 (2026-07-02 업데이트)

- [Korean Supreme Court — Yanolja scraping case (2022)](https://news.ycombinator.com/item?id=32440850)
- [HashScraper — Web scraping legal summary](https://blog.hashscraper.com/posts/perfect-summary-of-legal-issues-in-web-scraping)
- [Mondaq — Legal Standards In Korea For Permissible Web Crawling](https://www.mondaq.com/copyright/1266552/legal-standards-in-korea-for-permissible-web-crawling-)
- [Thunderbit — Is Web Scraping Legal in Korea? (2026)](https://thunderbit.com/blog/is-web-scraping-legal-korea-guide)
- [Nature Careers — Postdoc jobs](https://www.nature.com/naturecareers/jobs/postdoctoral/)
- [하이그래드넷 — 대학원생 모집](https://higrad.net/gradstudent/recruits)
- [KISTI RSS 도움말](https://www.kisti.re.kr/rss-help/pageView/178)
- [NRF 채용공고](https://www.nrf.re.kr/cms/board/general/list?menu_no=54)
- [KAIST 채용/초빙](https://www.kaist.ac.kr/kr/html/footer/0814.html)
- [KIST 채용공지](https://www.kist.re.kr/ko/notice/employment-announcement.do)## 부록 D — 신규 확인된 공식 API/RSS 출처 (2026-07-02)

### D.1 Springer Nature Developer Portal

**URL**: `https://dev.springernature.com`  
**문서**: `https://dev.springernature.com/docs/quick-start/api-access/`

| 항목 | 내용 |
|---|---|
| **가입 비용** | 무료 (Basic user) — 이메일 인증만 |
| **API Key 발급** | 회원가입 후 즉시 (API management 페이지) |
| **Premium 업그레이드** | 다중 프로젝트별 key 발급 가능 |

**제공 API 3종**:

1. **Meta API** — 1400만+ 문서 메타데이터 + 초록 (Springer·Nature·BMC·Palgrave 통합)
   - `https://api.springernature.com/meta/v2/json?q=...&api_key=...`
   - `q`, `subject`, `doi`, `issn`, `onlinedatefrom`, `onlinedateto` 등 **20+ 필터**
   - **우리 사용처**: 논문 다운로드 도메인과 자연스러운 연결 (논문 분야 → 동일 분야 채용공고 추천)
2. **Open Access API** — 150만+ OA 콘텐츠 전문 + JATS XML
   - `https://api.springernature.com/openaccess/jats?api_key=...`
3. **Full Text API (TDM)** — 구독 기반 콘텐츠 (유료 — 우리는 안 씀)

**사용자 명시 허용**: "researchers, academic institutions/governments, corporations, **and startups**" — **스타트업 명시 허용**

### D.2 jobs.ac.uk RSS Feeds (공식 syndication)

**URL**: `https://www.jobs.ac.uk/feeds`

| 분류 | Feed |
|---|---|
| **직무별** | `jobs.ac.uk/feeds/type-roles` |
| **지역별** | `jobs.ac.uk/feeds/locations` |
| **학문별** | `jobs.ac.uk/feeds/subject-areas` |

직무별 카테고리 예: Academic or Research / PhDs / Masters / Clerical / Craft or Manual / Further Education

**공식 권장**:
> "Direct RSS syndication — By using the raw RSS feed as part of a server-side script, it is possible to tightly integrate our job listings with your own data, allowing unlimited customisation and removing the need for client-side technologies."
>
> — `jobs.ac.uk/feeds`

→ **공식적으로 server-side 통합 권장**, 사실상 syndication 라이선스.

### D.3 Science Careers (AAAS)

**URL**: `https://jobs.sciencecareers.org`  
**RSS**: `https://www.science.org/content/page/alerts-and-feeds`  
**E-Alert**: 카테고리·지역별 이메일 알림 구독 가능  
**모회사**: AAAS (American Association for the Advancement of Science)

### D.4 AAS (American Astronomical Society) Job Register

**URL**: `https://aas.org/jobregister`  
**RSS**: 카테고리별 공식 RSS feed 제공 (24시간 자동 갱신)  
**특화 분야**: 천문학·행성과학·천체물리학 한정 — **틈새지만 의외로 사용자 가치 ↑** (천문우주 박사후·연구직)

### D.5 HigherEdJobs

**URL**: `https://www.higheredjobs.com/rss/`  
**특화**: 북미 학술 일반 (postdoc·faculty·research) — 카테고리·지역별 RSS

### D.6 robots.txt 검증 결과 — Nature Careers

**`https://www.nature.com/robots.txt`** 핵심 발췌:
```
Disallow: /naturecareers/jobs
Disallow: /naturecareers/jobsrss/
Disallow: /naturecareers/session-img/
```

→ **RSS 직접 크롤링 차단 확인**. **partner API 영업로만 우회 가능**.

---

## 부록 E — Springer Nature Partner API 영업 메일 템플릿

> **To**: `partnerships@nature.com` (또는 `recruitment@naturecareers.com`)
>
> **Subject**: Partnership inquiry — ScholarLink × Nature Careers (B2B job feed integration)
>
> ---
>
> Hello Nature Partnerships team,
>
> My name is [이름], and I run **ScholarLink** (wheeljah.github.io/SC_link), a Korean academic platform serving ~[N] monthly users — primarily graduate students, postdocs, and early-career researchers in STEM.
>
> We are planning a new "🎓 Career" section to surface postdoc / faculty / research positions to our users, alongside their existing paper-download workflow. Nature Careers is the gold-standard source for this audience globally, and we would love to integrate it officially rather than scraping anything.
>
> We are specifically interested in:
> 1. **B2B job feed integration** (we saw that ATS / job feed automation is supported for recruitment subscription customers)
> 2. **API access** for retrieving open positions programmatically
> 3. **Pricing** for an academic / non-profit partner at our scale (~[N] monthly users)
>
> We currently only have a small set of recruitment integrations (Springer Nature Meta API + jobs.ac.uk RSS + Korean public-sector feeds), so Nature Careers would be the crown jewel of our international coverage.
>
> Could you point me to the right person / form for partnership inquiries? Happy to share more about our traffic, audience demographics, and integration plan.
>
> Best regards,
> [이름]
> Founder, ScholarLink
> wheeljah@gmail.com

**기대 응답 패턴**:
- B2B 영업팀 → 미팅 제안 → 데모 → 견적 → 계약 → API key 발급
- 보통 1~2주 안에 회신, 견적까지 1개월 예상

---