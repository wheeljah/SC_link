# SARAMIN_API_KEY 발급 가이드

사람인 Open API 키를 발급받아 ScholarLink에 등록하면, **사립/공기업/공공기관 구분 없이** 학술·연구 분야 채용을 사람인 통합 미러에서 자동 수집합니다.

- **어댑터**: `server/src/services/jobSources/saraminOpenApiAdapter.ts`
- **API**: 사람인 `oapi.saramin.co.kr/job-search` (구 `api.saramin.co.kr`에서 이관됨)
- **현재 상태**: `enabled=false` (키 대기 중)
- **키 등록 후**: 매 6시간마다 자동 크롤링, 키워드 6개 × 50건 = 최대 300건/주기

---

## 🎯 Step 1. 사람인 개발자센터 접속

🔗 https://oapi.saramin.co.kr/

> 회원이 아니면 회원가입 필요 (1분, 이메일 인증).

---

## 🎯 Step 2. Open API 신청

상단 메뉴 → **`Open API 신청`** (또는 `이용 신청`)

| 항목 | 선택값 |
|---|---|
| API 종류 | **채용정보 검색** (`job-search`) |
| 활용 목적 | 학술·연구 분야 채용정보 통합 수집 (개인 비영리) |
| 활용 범위 | ScholarLink (scholarlink-api.onrender.com) |
| 트래픽 | 1000건/일 이하 |

신청 후 **1~2 영업일** 자동 승인 (사람인 운영팀).

---

## 🎯 Step 3. Access Key 확인

승인 완료 시 **마이페이지 → API 키 관리** → **`Access Key`** 복사.

키 형태 예시: `abcdefgh1234567890ABCDEFGHIJKLMN==` (영숫자 + `==` 종결)

---

## 🎯 Step 4. Render 환경변수 등록

1. https://dashboard.render.com 접속 → **scholarlink-api** 서비스 선택
2. 좌측 메뉴 **`Environment`** 클릭
3. **`Add Environment Variable`** 클릭
4. 입력:
   ```
   Key    : SARAMIN_API_KEY
   Value  : <Step 3에서 복사한 Access Key>
   ```
5. **`Save Changes`** → 자동 재배포 (1~2분)

---

## 🎯 Step 5. 활성화 확인

재배포 완료 후:

```sql
-- DB 직접 조회
SELECT code, name, enabled, last_run_at, last_success_at, last_error
FROM job_sources
WHERE code = 'saramin-openapi';
```

`enabled = TRUE` + `last_success_at`이 최근 → 정상 작동.

---

## 🎯 Step 6. (선택) 키워드 조정

기본 키워드 6개:
```
대학 산학협력단, 대학 채용, 산학협력단 채용,
대학원 전임, 연구기관 채용, TLO 채용
```

수정: `server/src/services/jobSources/saraminOpenApiAdapter.ts`의 `KEYWORDS` 배열.

---

## ❓ 자주 묻는 질문

### Q1. API 키 등록했는데 `enabled=false`로 남아있어요.
A. Render 환경변수 등록 후 **재배포 완료 여부**를 확인하세요. 강제 재배포: `Manual Deploy → Deploy latest commit`.

### Q2. 로그에 `INVALID_KEY` 또는 `인증 실패` 가 떠요.
A. Access Key 끝의 `==` 패딩이 누락된 경우. 또는 다른 사람인 서비스 키를 등록한 경우 (구 api.saramin.co.kr 키는 호환 안 됨).

### Q3. 워크넷(1단계)과 사람인 둘 다 등록하면 중복되나요?
A. dedup은 `external_id` + `canonical_url` 기준이라 워크넷과 사람인 ID 체계가 달라 자동 중복 제거됩니다. 같은 공고가 두 소스에 올라가면 한 번만 노출.

### Q4. 잡코리아 RSS는 안 되나요?
A. 2014년 6월 25일자로 잡코리아 RSS 서비스가 종료됐습니다 ([공지](https://www.jobkorea.co.kr/help/notice/view?no=13169)). 잡코리아 사용이 필요하면 유료 API만 가능.

---

## 📚 참고 링크

- 사람인 Open API 가이드: https://oapi.saramin.co.kr/
- API 공지사항: https://oapi.saramin.co.kr/notice
- 키 발급 문의: oapi.saramin.co.kr 고객센터 (평일 9~18시)