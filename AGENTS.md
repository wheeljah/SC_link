# ScholarLink — 프로젝트 프로파일

## 개요

ScholarLink는 DOI / PMID / arXiv ID / 저널 URL 만으로 **오픈액세스 학술논문·도서를 통합 검색·다운로드**하는 서비스입니다.

- **Repository**: `wheeljah/SC_link`
- **프론트**: React + TypeScript + Vite, GitHub Pages 호스팅
- **백엔드**: Node.js + Express + TypeScript, Render 웹서비스 (24시간)
- **DB**: Neon PostgreSQL (만료 없음)
- **배포 가이드**: `RENDER_배포가이드.md`

## 기술 스택

### 프론트 (`client/`)
| 항목 | 기술 |
|---|---|
| 프레임워크 | React 18 + TypeScript |
| 빌드 | Vite |
| 스타일 | Tailwind CSS |
| 라우팅 | React Router v6 |
| 상태 | React Context (AuthContext) |
| i18n | 한국어 / English 전환 (dictionary.ts) |
| QR코드 | `qrcode.react` |
| 광고 | 상단/하단 배너 (TopAdBanner, BottomAdBanner) |

### 백엔드 (`server/`)
| 항목 | 기술 |
|---|---|
| 런타임 | Node.js + TypeScript |
| 프레임워크 | Express |
| 빌드 | `tsc` → `dist/`, 개발: `tsx watch` |
| DB | PostgreSQL via `pg` |
| ORM | 없음 (순수 SQL + 마이그레이션 스크립트) |
| 인증 | JWT + bcryptjs |
| Rate Limit | express-rate-limit |
| 보안 | Helmet, CORS |
| 파일 업로드 | Multer |
| HTTP 클라이언트 | Axios, Cloudscraper |
| 브라우저 자동화 | Puppeteer (SciHub 등 JS 렌더링 사이트 스크래핑) |
| 이메일 | Nodemailer + Resend |
| 스케줄링 | node-cron |

### 인프라
| 서비스 | 용도 | URL |
|---|---|---|
| Render | 백엔드 API 서버 | scholarlink-api.onrender.com |
| Neon | PostgreSQL DB | scholarlink (asia-pacific) |
| GitHub Pages | 프론트엔드 | wheeljah.github.io/SC_link |
| GitHub Actions | 슬립 방지 (keep-alive) | 10분마다 Render 핑 |

## 주요 기능

### 1. 학술 자료 검색·다운로드
- **입력**: DOI, PMID, arXiv ID, 저널 URL,论文 제목
- **검색 파이프라인**: Crossref → Unpaywall → OA 소스 직접 시도
- **다운로드 소스 (oaSources)**:
  - arXiv (PDF 직접)
  - PubMed Central (PMC)
  - Unpaywall (oa locations)
  - Springer Nature (260만+ OA 논문·도서, `link.springer.com`)
  - IEEE (Open Access)
  - Wiley Open Access
  - Taylor & Francis Open Access
  -Frontiers
  - MDPI
  - Elsevier (Open Access)
  - PLOS
  - BioMed Central
  - eLife
  - USPTO
  - USPTO寄存器
  - Semantic Scholar API
  - Core (academic.oup.com)
  - Google Scholar (Puppeteer 스크래핑)
  - LibreTexts
  - NIST
  - OSTI
  - pubmed central
  - researcher-app.com
  - academia.edu
- **PDF 다운로드**: 다운로드 → DB 기록 (file_size, title, normalized_doi)

### 2. 사용자 시스템
- 회원가입 / 로그인 / 로그아웃
- 이메일 인증 (verify-email)
- 비밀번호 재설정 (forgot-password, reset-password)
- 토큰 기반 인증 (JWT Bearer)
- 다운로드 횟수 추적 (`download_count`)
- 티어 시스템 (tier)
- 지역 정보 기록 (`region`, `region_ip`)
- Remember-me 토큰

### 3. 커뮤니티
- 자유게시판 (Community)
- 버그 리포트 (BugReport)
- 질문·답변
- 회원별 게시글 관리

### 4. 다운로드 이력
- 로그인 유저별 다운로드 이력 (History)
- 재다운로드 가능 (단, Render 재시작 시 uploads 파일 손실 가능)

### 5. Admin 패널 (`/admin`)
- 하드코딩 관리자: `wheeljah@gmail.com`
- 유저 관리 (조회, 삭제)
- 서버 관리 (추가, 삭제, 활성/비활성)
- 통계 대시보드 (user_count, download_count, bug_count, db_size, 7일 신규 유저/다운로드)
- CSV 내보내기 (유저, 다운로드 이력)

### 6. 검색 서버 상태 모니터링
- `ServerStatus` 컴포넌트로 실시간 서버 목록 표시
- 로드밸런서 (`loadBalancerService.ts`)
- 서버 모니터링 (`serverMonitorService.ts`)
- 서버 유형 배지: Sci-Hub, LibGen, Anna's Archive, Z-Lib, Internet Archive

### 7. 보안
- Rate limiting (일반 라우트)
- Helmet (HTTP 헤더 보안)
- CORS (허용된 오리진만)
- 복사 방지 (`CopyProtection.tsx`)
- API 키 암호화 (`encryptionService.ts`)

## 페이지 목록

| 경로 | 컴포넌트 | 인증 |
|---|---|---|
| `/` | Home | 공개 |
| `/login` | Login | 공개 |
| `/register` | Register | 공개 |
| `/verify-email` | VerifyEmail | 공개 |
| `/forgot-password` | ResetPassword | 공개 |
| `/reset-password` | ResetPassword | 공개 |
| `/servers` | Servers | Admin만 |
| `/community` | Community | 공개 |
| `/community/:id` | CommunityDetail | 공개 |
| `/community/new` | CommunityNew | 로그인 필요 |
| `/history` | History | 로그인 필요 |
| `/report` | BugReport | 공개 |
| `/admin` | Admin | Admin만 |
| `/profile` | Profile | 로그인 필요 |

## API 엔드포인트 (`/api/v1/`)

| Prefix | 설명 |
|---|---|
| `/auth` | 인증 (login, register, verify-email, reset-password, resend-verify) |
| `/servers` | 검색 서버 목록 및 상태 |
| `/papers` | DOI/PDF 다운로드 요청, 메타데이터 조회 |
| `/community` | 게시글 CRUD |
| `/ads` | 광고 정보 |
| `/reports` | 버그 리포트 |
| `/admin` | 어드민 (유저/서버/통계 관리) |

## DB 마이그레이션

마이그레이션은 앱 시작 시 자동 실행 (`src/db/migrate.ts`).
수동 실행:
```bash
npm run db:migrate --prefix server   # 개발
npm run db:migrate:prod --prefix server  # 프로덕션
```

## 슬립 방지

`.github/workflows/keep-alive.yml` — 10분마다 Render URL 핑.
GitHub Secrets에 `RENDER_URL` 등록 필요.

## 주요 디렉토리 구조

```
SC_link/
├── client/                 # React 프론트엔드
│   └── src/
│       ├── pages/          # Home, Login, Register, Admin, History, Community 등
│       ├── components/     # Navbar, ServerStatus, AuthModal, CopyProtection 등
│       ├── services/      # API 클라이언트 (api.ts)
│       ├── context/        # AuthContext
│       └── i18n/           # dictionary.ts (ko↔en)
│
├── server/                 # Express 백엔드
│   ├── src/
│   │   ├── app.ts          # Express 앱 진입점
│   │   ├── routes/         # API 라우트
│   │   ├── services/       # 핵심 비즈니스 로직
│   │   │   ├── downloadService.ts   # PDF 다운로드 (oaSources 포함)
│   │   │   ├── doiParserService.ts  # DOI 파싱, Crossref/Unpaywall
│   │   │   ├── loadBalancerService.ts
│   │   │   ├── serverMonitorService.ts
│   │   │   ├── cobaltParserService.ts
│   │   │   ├── emailService.ts
│   │   │   └── encryptionService.ts
│   │   ├── db/             # pool.ts, migrate.ts
│   │   ├── middleware/      # rateLimit 등
│   │   ├── models/
│   │   └── config/
│   ├── dist/                # 빌드 출력 (git 추적 안 함)
│   ├── uploads/             # 업로드 파일 (Render 재시작 시 초기화)
│   └── *.ts, *.js           # 디버그/테스트 스크립트
│
├── .github/workflows/       # keep-alive.yml
├── RENDER_배포가이드.md     # 배포 문서
└── AGENTS.md               # 이 파일
```

## 참고

- Render 배포 시 `render.yaml`이 Blueprint로 읽힘
- `APP_URL`, `SERVER_URL`, `DATABASE_URL`, `SMTP_*`, `UNPAYWALL_EMAIL` 환경변수 필요
- `JWT_SECRET`, `ENCRYPTION_KEY`는 Render 자동 생성
- uploads 파일은 비영구 — Render 재시작 시 손실될 수 있음
