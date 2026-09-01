# ScholarLink

GitHub Pages에서 운영되는 정적 오픈액세스 학술 자료 탐색 서비스입니다.

## 제공 기능

- DOI, PMID, arXiv ID, 논문 제목 검색
- Crossref 메타데이터 조회
- OpenAlex 공개 원문 위치 조회
- PubMed / PubMed Central 및 arXiv 원문 링크 연결
- ai-traffic.kr BidVibe 상단·하단 광고 배너

ScholarLink는 PDF를 서버에 저장하거나 중계하지 않습니다. 공개적으로 접근 가능한 원문 위치를 찾아 사용자의 브라우저에서 직접 엽니다.

## 제외된 서버 기능

이 프로젝트는 GitHub Pages 정적 배포로 전환됐습니다. 따라서 아래 기능은 제공하지 않습니다.

- Express API, PostgreSQL, JWT 회원가입 및 이메일 인증
- Puppeteer 기반 동적 웹 스크래핑
- 서버 상태 감시 및 채용 공고 cron 수집
- PDF 및 커뮤니티 첨부 파일 업로드·보관
- 개인별 다운로드 이력, 서버 자격증명, 관리자 대시보드

## 로컬 실행

```powershell
npm install --prefix client
npm run dev --prefix client
```

브라우저에서 `http://localhost:5173`을 엽니다.

## GitHub Pages 배포

현재 저장소의 `master` 브랜치에 push하면 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)이 실행됩니다.

1. GitHub 저장소 **Settings → Pages**에서 Source를 **GitHub Actions**로 설정합니다.
2. `master` 브랜치에 push합니다.
3. `https://wheeljah.github.io/SC_link/`에서 확인합니다.

## 데이터 소스

- [Crossref](https://api.crossref.org)
- [OpenAlex](https://openalex.org)
- [PubMed](https://pubmed.ncbi.nlm.nih.gov)
- [arXiv](https://arxiv.org)

각 원문은 해당 제공자의 저작권 및 이용 조건을 준수해 이용해야 합니다.
