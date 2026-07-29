"use client";

/**
 * 알림 레벨 설정 — 토글 3종 대신 **라디오 3지선다**(ALL / EXCEPTION(권장) / WEEKLY_ONLY).
 * 라벨·설명은 lib/contracts/notify.ts 의 notifyLevelLabel·notifyLevelHint 를 그대로 쓴다(하드코딩 금지).
 *
 * 낙관적 업데이트: 선택 즉시 반영 → 저장 실패 시 이전 값으로 원복 + 인라인 오류 안내
 * (기존 NotifySettingsForm 패턴 유지).
 * "오경보 관리가 곧 제품" — 기본·권장은 EXCEPTION.
 * 주간 요약은 레벨과 별개의 정기 리포트라 전용 토글(WeeklySummaryToggle)이 담당한다.
 * 기본값은 ON(0012). WEEKLY_ONLY 레벨을 고르면 서버 액션이 주간 수신을 강제로 켠다.
 */
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import {
  DEFAULT_NOTIFY_LEVEL,
  NOTIFY_LEVELS,
  notifyLevelHint,
  notifyLevelLabel,
  type NotifyLevel,
} from "@/lib/contracts/notify";
import { updateNotifyLevel } from "@/lib/actions/settings";

export function NotifyLevelForm({
  initial = DEFAULT_NOTIFY_LEVEL,
}: {
  initial?: NotifyLevel;
}) {
  const [level, setLevel] = useState<NotifyLevel>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function choose(next: NotifyLevel) {
    if (pending || next === level) return;
    const prev = level;
    setLevel(next); // 낙관적 반영
    setError(null);
    startTransition(async () => {
      const res = await updateNotifyLevel(next);
      if (!res.ok) {
        setLevel(prev); // 원복
        setError("알림 설정 저장에 실패했습니다.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="알림 레벨" className="flex flex-col gap-2">
        {NOTIFY_LEVELS.map((l) => {
          const on = level === l;
          return (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={pending}
              onClick={() => choose(l)}
              className={`flex items-start gap-3 rounded-base border p-4 text-left transition-colors disabled:opacity-60 ${
                on
                  ? "border-primary bg-primary-soft"
                  : "border-border bg-bg shadow-card hover:bg-surface/60"
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  on ? "border-primary bg-primary text-bg" : "border-text-muted"
                }`}
                aria-hidden
              >
                {on ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span
                  className={`text-sm font-semibold ${on ? "text-primary" : "text-text"}`}
                >
                  {notifyLevelLabel[l]}
                </span>
                <span className="break-keep text-xs leading-relaxed text-text-muted">
                  {notifyLevelHint[l]}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {error ? (
        <p
          role="alert"
          className="break-keep rounded-base bg-accent/10 px-3 py-2 text-sm leading-relaxed text-accent"
        >
          {error} 잠시 후 다시 시도해 주세요.
        </p>
      ) : null}

      <p className="break-keep text-xs leading-relaxed text-text-muted">
        알림은 로그인 이메일로 보내드립니다. 주간 요약 메일은 아래에서 따로 켜고 끄실 수 있어요.
      </p>
    </div>
  );
}
