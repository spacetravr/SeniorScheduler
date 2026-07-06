/**
 * 로그아웃 버튼 — POST /api/auth/logout (303 → /login).
 * 순수 form 제출이라 JS 없이도 동작한다.
 */
export function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="post">
      <button
        type="submit"
        className="w-full rounded-base border border-surface px-4 py-3 text-sm font-semibold text-text-muted"
      >
        로그아웃
      </button>
    </form>
  );
}
