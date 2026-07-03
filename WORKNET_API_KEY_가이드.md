# WORKNET_API_KEY 발급 가이드

워크넷 Open API 키를 발급받아 ScholarLink에 등록하면, 정부 통합 구인정보(사립/공공/공기업 구분 없이 + 연구직·대학 가중치 필터)를 자동으로 수집합니다.

- **어댑터**: `server/src/services/jobSources/worknetOpenApiAdapter.ts` (이미 구현됨, 키만 등록하면 자동 활성화)
- **API**: 한국고용정보원 워크넷 채용정보 (`getSmJobRecruitList`)
- **현재 상태**: `enabled=false` (키 대기 중)
- **키 등록 후**: 매 4시간마다 자동 크롤링, 100건/페이지 수집

---

## 🎯 Step 1. 공공데이터포털(data.go.kr) 접속

🔗 https://www.data.go.kr/data/3038225/openapi.do

> 한국고용정보원_워크넷 채용정보 Open API 페이지. 회원이 아니면 회원가입 필요 (일반 가입 1분).

---

## 🎯 Step 2. 활용신청

페이지 상단의 **`활용신청`** 버튼 클릭.

| 항목 | 선택값 |
|---|---|
| 활용 목적 | 학술·연구 분야 채용정보 수집용 (개인/비영리) |
| 활용 범위 | 웹 서비스 (ScholarLink) |
| Open API 목록 | `한국고용정보원_워크넷 채용정보` |

신청 후 **담당자 심사**가 진행됩니다. 일반적으로:
- 즉시 승인 (평일 낮 시간)
- 1~2 영업일 (야간/주말/명절)

승인 완료 시 **알림톡/이메일**로 안내 → **마이페이지 → Open API → 인증키** 확인.

---

## 🎯 Step 3. 인증키 확인

`data.go.kr` → **마이페이지** → **Open API 개발** → **`인증키 (Decoding)`** 복사.

> ⚠️ `Encoding` 키가 아닌 **`Decoding`** 키를 사용하세요. (우리 어댑터는 `serviceKey` 파라미터로 디코딩 키를 그대로 전송)

키 형태 예시: `ABCDefghijk1234567890XYZ==` (영숫자 + `==` 종결)

---

## 🎯 Step 4. Render 환경변수 등록

1. https://dashboard.render.com 접속 → **scholarlink-api** 서비스 선택
2. 좌측 메뉴 **`Environment`** 클릭
3. **`Add Environment Variable`** 클릭
4. 입력:
   ```
   Key    : WORKNET_API_KEY
   Value  : <Step 3에서 복사한 디코딩 키>
   ```
5. **`Save Changes`** → 자동 재배포 (1~2분)

---

## 🎯 Step 5. 활성화 확인

재배포 완료 후 다음 명령으로 확인:

```bash
# Render 로그에서 worknet-openapi 활성화 확인
# (Render 대시보드 → Logs → 'worknet-openapi' 검색)

# 또는 DB 직접 조회
SELECT code, name, enabled, last_run_at, last_success_at, last_error
FROM job_sources
WHERE code = 'worknet-openapi';
```

`enabled = TRUE` + `last_success_at`이 최근 → 정상 작동.

---

## 🎯 Step 6. (선택) Frontend에서 노출 빈도 조정

기본값: 24시간에 2회 (04:00, 16:00 KST).
- 더 자주: `server/src/db/migrate.ts`의 `cron_expr`을 `0 */4 * * *` 등으로 변경
- 너무 자주: `0 */12 * * *` (12시간마다)

---

## ❓ 자주 묻는 질문

### Q1. 키를 등록했는데도 `enabled=false`로 남아있어요.
A. Render 환경변수 등록 후 **재배포 완료 여부**를 확인하세요. 대시보드 상단에 "Deploying..." 표시가 사라져야 적용. 강제 재배포: `Manual Deploy → Deploy latest commit`.

### Q2. 로그에 `API 오류: SERVICE_KEY_IS_NOT_REGISTERED_ERROR` 가 떠요.
A. **Encoding 키**가 등록된 경우. **Decoding 키**를 다시 복사해서 등록하세요.

### Q3. 사립대학 공고가 잘 안 잡혀요.
A. 워크넷은 키워드 매칭 기반입니다. 사립대학은 "고려대학교", "성균관대학교" 등으로 회사명 검색되므로 자연스럽게 잡힙니다. 만약 누락이 많다면 어댑터의 `DEFAULT_PARAMS`에 `empType` 또는 직종코드 필터를 추가 검토.

### Q4. 사람인/잡코리아 Open API도 추가하고 싶어요.
A. 별도 어댑터(`saraminOpenApiAdapter`) 필요. oapi.saramin.co.kr 무료 신청 필요. 가이드 작성 후 단계 3으로 진행 예정.

---

## 📚 참고 링크

- 워크넷 Open API 메뉴얼: https://www.data.go.kr/data/3038225/openapi.do
- 공공데이터포털 FAQ: https://www.data.go.kr/faq
- 키 발급 문의: data.go.kr 고객센터 1566-0025 (평일 9~18시)