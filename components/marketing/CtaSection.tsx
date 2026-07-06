"use client";

import { useState } from "react";
import { useCtaTracking } from "./useCtaTracking";
import { WaitlistModal } from "./WaitlistModal";

type Intent = "subscribe" | "try";

/**
 * CTA 2개 버튼 + 대기자 모달 + 추적 배선.
 * VIEW 이벤트는 useCtaTracking 마운트 시 1회 자동 전송된다.
 */
export function CtaSection() {
  const { sendEvent, submitWaitlist } = useCtaTracking();
  const [intent, setIntent] = useState<Intent | null>(null);
  const [open, setOpen] = useState(false);

  const handleClick = (next: Intent) => {
    setIntent(next);
    setOpen(true);
    void sendEvent(next === "subscribe" ? "CLICK_SUBSCRIBE" : "CLICK_TRY");
  };

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={() => handleClick("subscribe")}
          className="w-full rounded-base bg-primary px-6 py-4 text-base font-semibold text-bg shadow-sm sm:w-auto sm:min-w-52"
        >
          구독하기
        </button>
        <button
          type="button"
          onClick={() => handleClick("try")}
          className="w-full rounded-base border-2 border-primary bg-bg px-6 py-4 text-base font-semibold text-primary sm:w-auto sm:min-w-52"
        >
          베타 사용해보기
        </button>
      </div>

      <WaitlistModal
        open={open}
        intent={intent}
        onClose={() => setOpen(false)}
        onSubmit={submitWaitlist}
      />
    </>
  );
}
