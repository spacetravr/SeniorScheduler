"use client";

import { useState } from "react";
import { useCtaTracking } from "./useCtaTracking";
import { WaitlistModal } from "./WaitlistModal";

/**
 * 사전등록 단일 버튼 + 이메일 수집 모달 + 추적 배선.
 * VIEW 이벤트는 useCtaTracking 마운트 시 1회 자동 전송된다.
 * 클릭 전환은 기존 CLICK_TRY 이벤트를 재사용한다.
 */
export function CtaSection() {
  const { sendEvent, submitWaitlist } = useCtaTracking();
  const [open, setOpen] = useState(false);

  const handleClick = () => {
    setOpen(true);
    void sendEvent("CLICK_TRY");
  };

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={handleClick}
          className="w-full rounded-base bg-primary px-6 py-4 text-base font-semibold text-bg shadow-sm sm:w-auto sm:min-w-52"
        >
          사전등록하기
        </button>
      </div>

      <WaitlistModal
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={submitWaitlist}
      />
    </>
  );
}
