"use client";

/**
 * 크레딧 충전 결제 버튼 — 실결제 미연동(베타). 클릭 시 안내만.
 * billing 페이지(서버 컴포넌트)에서 재사용하기 위해 상호작용 부분만 분리.
 * 색·라운드는 토큰만 사용 (하드코딩 금지).
 */
export function ChargeButton() {
  function handleCharge() {
    // 실결제 미연동 — 안내만 (베타)
    alert("결제는 곧 오픈됩니다. 베타 기간에는 무료로 이용하실 수 있어요.");
  }

  return (
    <button
      type="button"
      onClick={handleCharge}
      className="mt-1 rounded-base bg-primary px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:opacity-90"
    >
      결제하기
    </button>
  );
}
