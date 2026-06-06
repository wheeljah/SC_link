# 🚀 Render + Neon 배포 가이드 (ngrok 대체)

ngrok의 IP 노출·URL 변경 문제를 해결하기 위해:
- **백엔드** → Render 무료 클라우드
- **DB** → Neon 무료 PostgreSQL (만료 없음)

| 항목 | ngrok (기존) | Render + Neon (변경) |
|------|-------------|---------------------|
| 내 IP 노출 | ❌ 노출됨 | ✅ 숨김 |
| URL | 매번 바뀜 | ✅ 고정 |
| PC 꺼도 작동 | ❌ | ✅ |
| DB 만료 | — | ✅ 없음 (Neon) |
| 비용 | 무료 | 무료 |
| 단점 | — | 15분 미사용 시 슬립(자동 방지 설정함) |

> 💡 **카드 불필요** (Render·Neon 둘 다 무료 티어는 카드 없이 시작)

---

## STEP 1. Neon DB 생성 (3분)

1. https://neon.tech 접속 → **Sign up** → GitHub로 가입
2. **Create Project** 클릭
   - Project name: `scholarlink`
   - Postgres version: 16 (기본값)
   - Region: **Asia Pacific (Singapore)** ← 한국에서 가장 가까움
3. 생성되면 **Connection string**이 나옵니다. **복사** 해두세요:
   ```
   postgresql://scholarlink_owner:xxxx@ep-xxx.ap-southeast-1.aws.neon.tech/scholarlink?sslmode=require
   ```
   > 이 문자열을 STEP 3에서 `DATABASE_URL`로 입력합니다.

> ✅ Neon 무료 DB는 **90일 만료가 없습니다.** 갱신 걱정 끝.

---

## STEP 2. Render 가입 + 백엔드 배포 (5분)

1. https://render.com 접속 → **Get Started** → **GitHub로 가입**
2. GitHub 권한 승인 → `wheeljah/SC_link` 레포 접근 허용
3. 대시보드 → 우상단 **New +** → **Blueprint**
4. `SC_link` 레포 선택 → **Connect**
5. Render가 `render.yaml`을 읽어 **scholarlink-api** 웹서비스를 인식 → **Apply**

> ⏳ 첫 배포는 5~10분. 환경변수가 없어 처음엔 빌드가 실패할 수 있는데, STEP 3 입력 후 재배포되면 정상화됩니다.

---

## STEP 3. 환경변수 입력 (3분)

Render 대시보드 → **scholarlink-api** → 좌측 **Environment** → 아래 값 입력:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | (STEP 1에서 복사한 Neon 연결문자열) |
| `SMTP_USER` | `traffic.rnd@gmail.com` |
| `SMTP_PASS` | (Gmail 앱 비밀번호 16자리) |
| `SMTP_FROM` | `sales@ai-traffic.kr` |
| `UNPAYWALL_EMAIL` | `sales@ai-traffic.kr` |
| `APP_URL` | `https://wheeljah.github.io/SC_link` |
| `SERVER_URL` | (STEP 2에서 받은 Render URL, 예: `https://scholarlink-api.onrender.com`) |

입력 후 **Save Changes** → 자동 재배포 → 빌드 시 DB 마이그레이션이 Neon에 테이블을 생성합니다.

> ⚠️ `JWT_SECRET`, `ENCRYPTION_KEY`는 Render가 **자동 생성**하므로 입력 불필요.

---

## STEP 4. 프론트엔드를 Render URL로 연결 (1분)

배포된 Render URL을 확인했으면 (예: `https://scholarlink-api.onrender.com`),
로컬 PC에서:

```powershell
cd D:\SC_link
powershell -ExecutionPolicy Bypass -File update-config.ps1 "https://scholarlink-api.onrender.com"
git add client/public/api-config.json
git commit -m "switch backend to Render"
git push origin master
```

→ GitHub Pages가 자동 재배포되며, 프론트엔드가 Render 백엔드를 호출합니다.

---

## STEP 5. 슬립 방지 활성화 (2분)

Render 무료는 15분 미사용 시 슬립합니다. 이미 추가된 GitHub Actions가 10분마다 깨웁니다.

1. GitHub 레포 → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**
   - Name: `RENDER_URL`
   - Value: `https://scholarlink-api.onrender.com` (실제 Render URL)
3. **Add secret**

→ `.github/workflows/keep-alive.yml`이 10분마다 자동 핑 → 슬립 방지

> 수동 테스트: 레포 → **Actions** 탭 → **Keep Render Awake** → **Run workflow**

---

## 완료 확인

1. **백엔드**: `https://scholarlink-api.onrender.com/api/health` → `{"status":"ok"}` ✅
2. **프론트엔드**: `https://wheeljah.github.io/SC_link` → 회원가입/다운로드 테스트
3. **IP 숨김**: ngrok 경고 페이지·IP 더 이상 안 보임 ✅

---

## 구조 요약

```
사용자 브라우저
   │
   ▼
GitHub Pages (프론트엔드)
   │  api 호출
   ▼
Render 웹서비스 (백엔드, 24시간) ──── Neon (PostgreSQL, 만료없음)
   ▲
   │ 10분마다 핑
GitHub Actions (슬립 방지)
```

→ **PC를 완전히 꺼도 24시간 작동. 모든 서버 역할을 Render+Neon이 담당.**

---

## ⚠️ 남은 한계 (무료 티어 공통)

| 한계 | 설명 | 대응 |
|------|------|------|
| **업로드 파일 비영구** | Render 재시작/슬립 시 `uploads/` 초기화 | 다운로드 직후 받기는 정상. 이력 재다운로드는 X |
| **첫 접속 지연** | 슬립 후 첫 요청 30~50초 | keep-alive cron이 완화 |
| **Neon 유휴 정지** | 장시간 미사용 시 compute 정지 | 첫 쿼리 시 1~2초 내 자동 복구 (데이터 보존) |

> 업로드 파일 영구 저장이 필요해지면 그때 Cloudflare R2(무료 10GB) 연동을 검토하세요.
