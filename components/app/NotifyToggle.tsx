"use client";

/** 알림 설정 placeholder 토글 (mock) — 로컬 상태만. 색은 토큰만 사용. */
import { useState } from "react";

export function NotifyToggle({
  label,
  initial,
}: {
  label: string;
  initial: boolean;
}) {
  const [on, setOn] = useState(initial);
  return (
    <div className="flex items-center justify-between gap-4 rounded-base border border-border bg-bg p-4 shadow-card">
      <span className="text-sm font-medium">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => setOn((v) => !v)}
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
    </div>
  );
}
