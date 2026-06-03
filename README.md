# 🔬 ScholarLink v1.2

학술 자료 공유 플랫폼 — DOI, PubMed ID, arXiv ID, 저널 URL로 학술 논문을 자동 다운로드

## 기술 스택 (전면 무료)

| 구분 | 기술 |
|------|------|
| 프론트엔드 | React 18 + TypeScript + TailwindCSS |
| 백엔드 | Node.js 20 LTS + Express |
| DB | PostgreSQL 16 (로컬) |
| 캐싱 | node-cache (인메모리, Redis 불필요) |
| 검색 | PostgreSQL pg_trgm (Elasticsearch 불필요) |
| 파일 | 로컬 디스크 (S3 불필요) |
| 이메일 | Nodemailer + Gmail SMTP (무료) |

---

## 빠른 시작

### 1. PostgreSQL 설치 및 시작

**이미 설치되어 있다면 건너뜀.**

```powershell
# winget으로 설치
winget install PostgreSQL.PostgreSQL.16

# 서비스 시작
Start-Service postgresql-x64-16
```

### 2. 환경 변수 설정

```powershell
cd server
copy .env.example .env
# .env 파일을 열어 SMTP_USER, SMTP_PASS 설정
notepad .env
```

**.env 필수 수정 항목:**

| 항목 | 설명 |
|------|------|
| `SMTP_USER` | Gmail 주소 |
| `SMTP_PASS` | [Google 앱 비밀번호](https://myaccount.google.com/apppasswords) |
| `ENCRYPTION_KEY` | `openssl rand -hex 32` 로 생성 후 교체 |

### 3. DB 초기화 + 서버 실행

```powershell
# 자동 설정 (Windows)
setup.bat

# 또는 수동으로:
# DB 생성
psql -U postgres -c "CREATE DATABASE scholarlink;"

# 패키지 설치
cd server && npm install
cd ../client && npm install

# DB 마이그레이션
cd server && npx tsx src/db/migrate.ts

# 백엔드 서버 시작 (포트 3000)
npx tsx src/app.ts

# 프론트엔드 시작 (포트 5173) — 새 터미널
cd client && npm run dev
```

### 4. 접속

- **프론트엔드 (로컬)**: http://localhost:5173
- **API**: http://localhost:4000/api/v1

---

## GitHub Pages 배포

프론트엔드는 GitHub Pages를 통해 외부에서 접근 가능합니다:

1. **Settings → Pages → Source**: "GitHub Actions" 선택
2. 자동으로 `master` 브랜치 push 시 Actions가 실행되어 배포됩니다
3. **배포 주소**: https://wheeljah.github.io/SC_link

> ⚠️ GitHub Pages는 **프론트엔드만** 호스팅합니다.
> 백엔드 API는 로컬에서 실행 중이어야 합니다 (`http://localhost:4000`).

---

## 주요 기능

### 이메일 전용 회원가입
- 이메일 + 비밀번호(영문+숫자 8자 이상)로만 가입
- 가입 후 인증 메일 발송 → 링크 클릭 후 로그인 가능
- 비밀번호 분실 시 이메일로 재설정 링크 발송

### 논문 다운로드
- DOI, PMID, arXiv ID, 저널 URL 지원
- Sci-Hub / LibGen 자동 연동 + failover
- 실시간 진행 상황 (SSE 스트리밍)

### 서버 자격증명 설정
- Z-Library 등 로그인 필요 서버에 대해 개인 계정 ID 직접 입력
- AES-256-GCM 암호화 저장
- 서버 상태 페이지 → 🔑 계정 설정 버튼 클릭

### 서버 상태 모니터링
- Sci-Hub, LibGen, Z-Library, Anna's Archive 실시간 모니터링
- cron 자동 체크 (5분/10분/15분 주기)
- SSE로 프론트에 실시간 전달

### 광고 배너
- 상단 40px 고정 배너 (다크 네이비, ai-traffic.kr 스타일)
- 하단 72px 고정 배너 (흰 배경)
- localStorage / Cookie 기반 닫기 상태 유지

---

## 디렉토리 구조

```
scholarlink/
├── client/          # React 프론트엔드
├── server/          # Node.js 백엔드
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   │   ├── encryptionService.ts    # AES-256-GCM
│   │   │   ├── emailService.ts         # Nodemailer
│   │   │   ├── downloadService.ts      # Sci-Hub/LibGen 연동
│   │   │   └── serverMonitorService.ts # 헬스체크 cron
│   │   ├── routes/
│   │   └── db/
│   │       ├── pool.ts                 # PostgreSQL 연결
│   │       └── migrate.ts              # 스키마 초기화
│   └── .env
├── setup.bat        # Windows 초기 설정 스크립트
└── docker-compose.yml
```

---

## API 엔드포인트 요약

| Method | 경로 | 설명 |
|--------|------|------|
| POST | `/api/v1/auth/register` | 회원가입 (이메일 인증 메일 발송) |
| GET  | `/api/v1/auth/verify-email?token=` | 이메일 인증 완료 |
| POST | `/api/v1/auth/login` | 로그인 → JWT |
| POST | `/api/v1/auth/forgot-password` | 비밀번호 재설정 요청 |
| POST | `/api/v1/auth/reset-password` | 새 비밀번호 설정 |
| POST | `/api/v1/papers/download` | 논문 다운로드 (SSE) |
| GET  | `/api/v1/papers/history` | 내 다운로드 이력 |
| GET  | `/api/v1/servers/status` | 서버 목록/상태 |
| GET  | `/api/v1/servers/sse` | 실시간 서버 상태 스트림 |
| GET  | `/api/v1/servers/credentials` | 내 서버 자격증명 목록 |
| PUT  | `/api/v1/servers/:id/credentials` | 서버 자격증명 저장 |
| DELETE | `/api/v1/servers/:id/credentials` | 서버 자격증명 삭제 |
| GET  | `/api/v1/community/requests` | 커뮤니티 요청 목록 |
| POST | `/api/v1/community/requests` | 요청 등록 |
| POST | `/api/v1/community/requests/:id/respond` | 응답 (파일 업로드 가능) |
| GET  | `/api/v1/ads/banners?position=TOP` | 활성 광고 배너 조회 |

---

## 비고

- 이 프로젝트는 학술 자료 접근성 향상을 위한 목적으로만 사용해야 합니다.
- 다운로드된 자료는 개인 학술 목적으로만 활용하고, 저작권을 준수하세요.
