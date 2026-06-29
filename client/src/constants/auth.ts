/**
 * 클라이언트 측 어드민 판정 공통 모듈.
 *
 * 백엔드 (`server/src/controllers/authController.ts` 등)도 동일한 `ADMIN_EMAIL`
 * env (기본값 `wheeljah@gmail.com`)을 사용한다.
 *
 * 주의: `User.isAdmin` 필드 (types/index.ts)도 정의돼 있지만,
 *      로그인 응답에 박혀 들어오기 때문에 **이미 로그인된 세션의 localStorage
 *      user 객체에는 값이 없을 수 있다.** 그래서 호출 시점에는 이메일로 직접
 *      판정하는 게 안전하다. 새 코드에서는 항상 이 헬퍼를 쓸 것.
 */

export const ADMIN_EMAIL = 'wheeljah@gmail.com';

export function isAdminUser(user: { email?: string | null } | null | undefined): boolean {
  if (!user || !user.email) return false;
  return user.email === ADMIN_EMAIL;
}