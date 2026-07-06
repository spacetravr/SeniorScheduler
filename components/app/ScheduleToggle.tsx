"use client";

/**
 * 일정 발신 ON/OFF 토글 — toggleScheduleActive(Server Action) 결합.
 * 낙관적 갱신 후 실패 시 원복 + 한국어 에러 표시(미동의 활성화 차단 등).
 */
import { useState, useTransition } from "react";
import { toggleScheduleActive } from "@/lib/actions/schedules";

export function ScheduleToggle({
  scheduleId,
  initial,
}: {
  scheduleId: string;
  initial: boolean;
}) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    const next = !on;
    setOn(next); // 낙관적 갱신
    setError(null);
    startTransition(async () => {
      const result = await toggleScheduleActive(scheduleId, next);
      if (!result.ok) {
        setOn(!next); // 원복
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="발신 켜기/끄기"
        disabled={pending}
        onClick={handleToggle}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
          on ? "bg-primary" : "bg-text-muted"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-bg transition-all ${
            on ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
      {error ? (
        <p className="max-w-[160px] text-right text-[11px] font-medium leading-tight text-accent">
          {error}
        </p>
      ) : null}
    </div>
  );
}
