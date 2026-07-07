/**
 * /login 의 ?error= 쿼리 파라미터 → 한국어 안내 메시지 매핑 (순수 함수, 유닛 테스트 대상).
 * 값 출처: app/api/auth/confirm/route.ts (expired_link / invalid_link).
 * 알 수 없는 값은 일반 안내로 폴백한다.
 */
export function loginErrorMessage(error: string | null | undefined): string | null {
  if (!error) return null;
  switch (error) {
    case "expired_link":
      return "로그인 링크가 만료됐거나 이미 사용됐어요. 링크를 요청한 그 브라우저에서 열어야 해요. 다시 시도해 주세요.";
    case "invalid_link":
      return "로그인 링크가 올바르지 않아요. 다시 요청해 주세요.";
    default:
      return "로그인에 실패했어요. 다시 시도해 주세요.";
  }
}
