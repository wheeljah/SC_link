# doi_hunter v1.1.1 분석 보고서

## 1. 패키지 개요

| 항목 | 내용 |
|------|------|
| 이름 | doi_hunter v1.1.1 |
| 언어 | Python 3 |
| 의존성 | requests, beautifulsoup4 |
| 라이선스 | MIT |
| 방식 | CLI 도구 (배치 다운로드) |
| 소스 | Sci-Hub.se (단일 미러만 사용) |

---

## 2. 모듈별 기능 분석

### downloader.py — 핵심 다운로드 로직
- `get_scihub_original_url(doi)`: `sci-hub.se/{doi}` HTML 파싱 → embed 태그에서 PDF URL 추출
- `//` 로 시작하는 URL을 `https:` 로 보정
- HTTP 429 (Too Many Requests) 발생 시 IP 변경 대기 (CLI 대화형)
- 배치 단위 처리 (`--batch_size` 인자)

### htmlparser.py — HTML 파싱
- `extract_title()`: `<title>` 태그 파싱 → "Sci-Hub - " 접두어 제거 → 파일명 생성
- `extract_scihub_embed_link()`: `<embed src=...>` 태그에서 PDF URL 추출

### utils.py — 유틸리티
- `get_doi_by_title()`: **CrossRef API**로 논문 제목 → DOI 변환
  - 엔드포인트: `https://api.crossref.org/works?query.bibliographic={title}`
  - 첫 번째 결과의 DOI 반환
- `download_file()`: PDF 스트리밍 다운로드, 429 재시도

### netinfo.py — 네트워크
- 5개의 User-Agent 풀에서 랜덤 선택하여 요청마다 다른 헤더 사용

---

## 3. ScholarLink 대비 비교

| 기능 | doi_hunter | ScholarLink |
|------|-----------|-------------|
| Sci-Hub 미러 수 | 1개 (sci-hub.se 고정) | 25개 이상 |
| OA 소스 | ❌ | ✅ Unpaywall, Semantic Scholar, PMC 등 |
| 비동기 처리 | ❌ 동기식 | ✅ async/await |
| 실시간 진행 표시 | ❌ CLI 출력만 | ✅ SSE 스트리밍 |
| 제목→DOI 변환 | ✅ CrossRef API | ❌ **미구현** |
| URL 파싱 | ❌ DOI만 | ✅ DOI/PMID/arXiv/URL |
| User-Agent 순환 | ✅ 5개 풀 | ❌ 미구현 |
| `//` URL 정규화 | ✅ 명시적 처리 | ⚠️ `http` 체크만 (누락 가능) |
| 배치 다운로드 | ✅ | ❌ |
| 웹 UI | ❌ | ✅ |
| 인증/계정 | ❌ | ✅ |

---

## 4. ScholarLink에 즉시 적용 가능한 항목

### ① 논문 제목으로 검색 (HIGH PRIORITY ⭐⭐⭐)
- CrossRef `query.bibliographic` API로 제목 → DOI 자동 변환
- 현재 ScholarLink는 DOI/PMID/arXiv만 지원
- 사용자가 제목을 붙여넣으면 바로 다운로드 가능

```typescript
// 추가 위치: doiParserService.ts
export async function resolveTitleToDoi(title: string): Promise<string | null> {
  const res = await axios.get('https://api.crossref.org/works', {
    params: { 'query.bibliographic': title, rows: 1 },
    timeout: 8000,
  });
  return res.data?.message?.items?.[0]?.DOI ?? null;
}
```

### ② User-Agent 랜덤 순환 (MEDIUM PRIORITY ⭐⭐)
- Sci-Hub/LibGen 봇 탐지 우회에 효과적
- 현재 모든 요청이 axios 기본 UA 사용 중

### ③ `//` 접두어 URL 정규화 (LOW PRIORITY ⭐)
- `embedSrc.startsWith('//')` 케이스 추가
- `https:` 접두어 보정 → 일부 Sci-Hub 미러에서 발생

---

## 5. 적용 불가 항목

| 항목 | 이유 |
|------|------|
| 배치 다운로드 CLI | ScholarLink는 웹 서비스 → 다른 UX 패턴 필요 |
| IP 변경 대기 대화형 | 서버 환경에서 불가 (non-interactive) |
| Sci-Hub.se 고정 URL | ScholarLink는 이미 더 많은 미러 보유 |

---

## 6. 결론

doi_hunter는 ScholarLink보다 훨씬 단순한 단일 소스 CLI 도구입니다.  
ScholarLink의 다중 소스·비동기·SSE 아키텍처가 기술적으로 훨씬 앞섭니다.

**즉시 적용할 가치가 있는 것은 딱 하나:**  
**논문 제목 → CrossRef API → DOI 자동 변환** — 사용자가 DOI를 모를 때 제목으로 검색 가능하게 됩니다.
