"use client";

/** 일정 발신 ON/OFF 토글 (mock) — 로컬 상태만 변경, 콘솔 로그. 색은 토큰만 사용. */
import { useState } from "react";

export function ScheduleToggle({
  scheduleId,
  initial,
}: {
  scheduleId: string;
  initial: boolean;
}) {
  const [on, setOn] = useState(initial);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="발신 켜기/끄기"
      onClick={() => {
        setOn((v) => {
          console.log("[mock] 일정 토글", scheduleId, !v);
          return !v;
        });
      }}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        on ? "bg-primary" : "bg-text-muted"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-bg transition-all ${
          on ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}
