# 🚀 Render 배포 가이드 (ngrok 대체)

ngrok의 IP 노출·URL 변경 문제를 해결하기 위해 백엔드를 Render 무료 클라우드로 옮깁니다.

| 항목 | ngrok (기존) | Render (변경) |
|------|-------------|---------------|
| 내 IP 노출 | ❌ 노출됨 | ✅ 숨김 |
| URL | 매번 바뀜 | ✅ 고정 |
| PC 꺼도 작동 | ❌ | ✅ |
| 비용 | 무료 | 무료 |
| 단점 | — | 15분 미사용 시 슬립(자동 방지 설정함) |

---

## 사전 준비

- GitHub 계정 (이미 있음: wheeljah)
- 코드가 GitHub에 푸시되어 있어야 함 (`git push` 완료 상태)

> 💡 신용카드 **불필요**. Render 무료 티어는 카드 없이 시작합니다.

---

## STEP 1. Render 가입 (2분)

1. https://render.com 접속
2. **Get Started** → **GitHub로 가입** (Sign up with GitHub)
3. GitHub 권한 승인 → `wheeljah/SC_link` 레포 접근 허용

---

## STEP 2. Blueprint로 한 번에 배포 (5분)

레포에 이미 `render.yaml`이 있어서 자동으로 백엔드 + DB가 함께 생성됩니다.

1. Render 대시보드 → 우상단 **New +** → **Blueprint**
2. `SC_link` 레포 선택 → **Connect**
3. Render가 `render.yaml`을 읽어 아래 2개를 자동 인식:
   - `scholarlink-api` (웹서비스)
   - `scholarlink-db` (PostgreSQL)
4. **Apply** 클릭

> ⏳ 첫 배포는 5~10분 걸립니다. DB 생성 → 빌드 → 마이그레이션 순으로 진행됩니다.

---

## STEP 3. 환경변수 입력 (3분)

`render.yaml`에서 `sync: false`로 표시된 값들은 보안상 직접 입력해야 합니다.

Render 대시보드 → **scholarlink-api** → 좌측 **Environment** → 아래 값 입력:

| Key | Value |
|-----|-------|
| `SMTP_USER` | `traffic.rnd@gmail.com` |
| `SMTP_PASS` | (Gmail 앱 비밀번호 16자리) |
| `SMTP_FROM` | `sales@ai-traffic.kr` |
| `UNPAYWALL_EMAIL` | `sales@ai-traffic.kr` |
| `APP_URL` | `https://wheeljah.github.io/SC_link` |
| `SERVER_URL` | (STEP 2에서 받은 Render URL, 예: `https://scholarlink-api.onrender.com`) |

입력 후 **Save Changes** → 자동 재배포됩니다.

> ⚠️ `JWT_SECRET`, `ENCRYPTION_KEY`, `DATABASE_URL`은 Render가 **자동 생성**하므로 입력 불필요.

---

## STEP 4. 프론트엔드를 Render URL로 연결 (1분)

배포된 Render URL을 확인했으면 (예: `https://scholarlink-api.onrender.com`),
로컬 PC에서 아래 명령 실행:

```powershell
cd D:\SC_link
powershell -ExecutionPolicy Bypass -File update-config.ps1 "https://scholarlink-api.onrender.com"
git add client/public/api-config.json
git commit -m "switch backend to Render"
git push origin master
```

→ GitHub Pages가 자동 재배포되며, 이제 프론트엔드가 Render 백엔드를 호출합니다.

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

1. **백엔드**: `https://scholarlink-api.onrender.com/api/health` 접속 → `{"status":"ok"}` 표시
2. **프론트엔드**: `https://wheeljah.github.io/SC_link` 접속 → 회원가입/다운로드 테스트
3. **내 IP 숨김 확인**: 더 이상 ngrok 경고 페이지/IP 안 보임 ✅

---

## ⚠️ 알아둘 한계 (Render 무료 티어)

| 한계 | 설명 | 대응 |
|------|------|------|
| **DB 90일 만료** | 무료 PostgreSQL은 90일 후 삭제됨 | 만료 전 새 DB 생성 후 재배포 (또는 Neon 무료 DB로 이전) |
| **업로드 파일 비영구** | 재배포/슬립 시 `uploads/` 초기화 | 다운로드 직후 받기는 정상. 이력 재다운로드는 X |
| **첫 접속 지연** | 슬립 후 첫 요청 30~50초 | keep-alive cron이 완화 |
| **월 750시간** | 1개 서비스 상시 가동 충분 | 서비스 1개면 문제 없음 |

> 트래픽이 늘거나 영구 저장이 필요해지면, 그때 유료 전환($7/월) 또는 정부 클라우드 바우처를 검토하세요.
