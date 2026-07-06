"use client";

/**
 * 일정 카드 — 정보 + 발신 토글(ScheduleToggle) + 수정(ScheduleForm) + 삭제(deleteSchedule).
 */
import { useState, useTransition } from "react";
import type { Schedule, Senior } from "@/lib/contracts/domain";
import { scheduleTypeLabel } from "@/lib/contracts/domain";
import { deleteSchedule } from "@/lib/actions/schedules";
import { fmtRrule } from "@/components/app/format";
import { ScheduleToggle } from "@/components/app/ScheduleToggle";
import { ScheduleForm } from "@/components/app/ScheduleForm";

export function ScheduleItem({
  schedule,
  seniorName,
  seniors,
}: {
  schedule: Schedule;
  seniorName: string;
  seniors: Senior[];
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    const ok = window.confirm(`'${schedule.title}' 일정을 삭제할까요?`);
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteSchedule(schedule.id);
      if (!result.ok) setError(result.error);
    });
  }

  if (editing) {
    return (
      <ScheduleForm
        mode="edit"
        schedule={schedule}
        seniors={seniors}
        onDone={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-base border border-surface p-4">
      <div className="flex items-center gap-4">
        <span className="w-14 shrink-0 text-lg font-bold tabular-nums">
          {schedule.call_time}
        </span>
        <div className="flex flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="font-medium">{schedule.title}</span>
            <span className="inline-flex items-center rounded-base bg-surface px-2 py-0.5 text-xs font-medium text-text-muted">
              {scheduleTypeLabel[schedule.type]}
            </span>
          </div>
          <span className="text-sm text-text-muted">
            {seniorName} · {fmtRrule(schedule.rrule)}
          </span>
        </div>
        <ScheduleToggle scheduleId={schedule.id} initial={schedule.active} />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          disabled={pending}
          className="rounded-base border border-surface px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
        >
          수정
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="rounded-base border border-surface px-3 py-1.5 text-xs font-semibold text-accent disabled:opacity-50"
        >
          삭제
        </button>
      </div>

      {error ? (
        <p className="rounded-base bg-surface px-3 py-2 text-xs font-medium text-accent">
          {error}
        </p>
      ) : null}
    </div>
  );
}
