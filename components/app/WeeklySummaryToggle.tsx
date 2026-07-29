"use client";

/**
 * 주간 요약 메일 수신 토글 (guardians.notify_weekly_summary 전용).
 *
 * 알림 레벨(NotifyLevelForm)은 "통화 직후 알림을 얼마나 받을지"만 정한다. 주간 요약은 그와
 * 별개의 정기 리포트라 수신 여부를 따로 고른다 — 0012 이전에는 이 값을 켤 UI 자체가 없어
 * 주간 메일이 아무에게도 발송되지 않았다(세션 #14 발견).
 *
 * 낙관적 업데이트: 클릭 즉시 반영 → 저장 실패 시 이전 값으로 원복 + role=alert 안내
 * (NotifyLevelForm·NotifySettingsForm 과 동일 패턴).
 */
import { useState, useTransition } from "react";
import { updateWeeklySummary } from "@/lib/actions/settings";

export function WeeklySummaryToggle({ initial = true }: { initial?: boolean }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (pending) return;
    const prev = on;
    const next = !on;
    setOn(next); // 낙관적 반영
    setError(null);
    startTransition(async () => {
      const res = await updateWeeklySummary(next);
      if (!res.ok) {
        setOn(prev); // 원복
        setError("주간 요약 설정 저장에 실패했습니다.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4 rounded-base border border-border bg-bg p-4 shadow-card">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-semibold">주간 요약 메일</span>
          <span className="break-keep text-xs leading-relaxed text-text-muted">
            매주 화요일 오전, 지난 한 주를 정리한 리포트를 로그인 이메일로 보내드려요.
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="주간 요약 메일 수신"
          disabled={pending}
          onClick={toggle}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
            on ? "bg-primary" : "bg-border"
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-bg shadow-card transition-all ${
              on ? "left-6" : "left-1"
            }`}
            aria-hidden
          />
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          className="break-keep rounded-base bg-accent/10 px-3 py-2 text-sm leading-relaxed text-accent"
        >
          {error} 잠시 후 다시 시도해 주세요.
        </p>
      ) : null}
    </div>
  );
}
