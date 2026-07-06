/**
 * 일정 (/app/schedules) — 목록(ON/OFF 토글) + 등록 폼.
 */
import { PageHeader } from "@/components/app/PageHeader";
import { ScheduleToggle } from "@/components/app/ScheduleToggle";
import { ScheduleForm } from "@/components/app/ScheduleForm";
import { fmtRrule } from "@/components/app/format";
import { scheduleTypeLabel } from "@/lib/contracts/domain";
import { schedules, seniors, seniorById } from "@/lib/mock/data";

export default function SchedulesPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="일정"
        subtitle="복약·병원 등 안내 전화 일정을 관리합니다."
      />

      <section className="flex flex-col gap-2">
        {schedules.map((s) => {
          const senior = seniorById(s.senior_id);
          return (
            <div
              key={s.id}
              className="flex items-center gap-4 rounded-base border border-surface p-4"
            >
              <span className="w-14 shrink-0 text-lg font-bold tabular-nums">
                {s.call_time}
              </span>
              <div className="flex flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{s.title}</span>
                  <span className="inline-flex items-center rounded-base bg-surface px-2 py-0.5 text-xs font-medium text-text-muted">
                    {scheduleTypeLabel[s.type]}
                  </span>
                </div>
                <span className="text-sm text-text-muted">
                  {senior?.name} · {fmtRrule(s.rrule)}
                </span>
              </div>
              <ScheduleToggle scheduleId={s.id} initial={s.active} />
            </div>
          );
        })}
      </section>

      <ScheduleForm seniors={seniors} />
    </div>
  );
}
