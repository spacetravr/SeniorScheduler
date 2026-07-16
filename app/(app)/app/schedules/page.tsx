/**
 * 일정 (/app/schedules) — 실데이터 목록(ON/OFF 토글) + 등록/수정/삭제 (server actions 결합).
 * 상단 우측 "새 일정 등록" 버튼(모달)으로 등록하고, 목록은 피보호자별 → 시간대별로 그룹핑한다.
 * 피보호자가 없으면 먼저 등록하도록 안내한다.
 */
import { Users, AlarmClock } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { ScheduleFormModal } from "@/components/app/ScheduleFormModal";
import { ScheduleItem } from "@/components/app/ScheduleItem";
import { EmptyState } from "@/components/app/EmptyState";
import { getSchedules, getSeniors } from "@/lib/db/queries";
import type { Schedule } from "@/lib/contracts/domain";

export const dynamic = "force-dynamic";

/** 발신 시각(HH:mm)을 시간대 버킷으로 분류: 아침/낮/저녁/밤. */
const TIME_BUCKETS = [
  { key: "MORNING", label: "아침", hint: "05–11시" },
  { key: "DAY", label: "낮", hint: "11–17시" },
  { key: "EVENING", label: "저녁", hint: "17–22시" },
  { key: "NIGHT", label: "밤", hint: "22–05시" },
] as const;

function bucketOf(callTime: string): (typeof TIME_BUCKETS)[number]["key"] {
  const [h, m] = callTime.split(":").map(Number);
  const mins = h * 60 + m;
  if (mins >= 300 && mins < 660) return "MORNING"; // 05:00–10:59
  if (mins >= 660 && mins < 1020) return "DAY"; // 11:00–16:59
  if (mins >= 1020 && mins < 1320) return "EVENING"; // 17:00–21:59
  return "NIGHT"; // 22:00–04:59
}

export default async function SchedulesPage() {
  const [schedules, seniors] = await Promise.all([getSchedules(), getSeniors()]);
  const seniorName = new Map(seniors.map((s) => [s.id, s.name]));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="일정"
        subtitle="복약·병원 등 안내 전화 일정을 관리합니다."
        action={seniors.length > 0 ? <ScheduleFormModal seniors={seniors} /> : undefined}
      />

      {seniors.length === 0 ? (
        <EmptyState
          icon={Users}
          title="먼저 피보호자를 등록해 주세요"
          description="일정은 등록된 피보호자에게 연결됩니다. 부모님을 먼저 등록해 주세요."
          action={{ href: "/app/seniors", label: "피보호자 등록하러 가기" }}
        />
      ) : schedules.length === 0 ? (
        <EmptyState
          icon={AlarmClock}
          title="아직 등록된 일정이 없어요"
          description="오른쪽 위 '새 일정 등록'으로 복약·병원 등 안내 전화 일정을 추가해 보세요."
        />
      ) : (
        <div className="flex flex-col gap-8">
          {seniors.map((senior) => {
            const list = schedules.filter((s) => s.senior_id === senior.id);
            if (list.length === 0) return null;

            // 시간대별 그룹 → 각 그룹 내 발신 시각 오름차순
            const groups = TIME_BUCKETS.map((bucket) => ({
              bucket,
              items: list
                .filter((s) => bucketOf(s.call_time) === bucket.key)
                .sort((a, b) => a.call_time.localeCompare(b.call_time)),
            })).filter((g) => g.items.length > 0);

            return (
              <section key={senior.id} className="flex flex-col gap-4">
                <div className="flex items-baseline gap-2">
                  <h2 className="break-keep text-lg font-bold">{senior.name}</h2>
                  <span className="break-keep text-sm text-text-muted">
                    {senior.relationship}
                    <span className="ml-1.5 tabular-nums">· 일정 {list.length}건</span>
                  </span>
                </div>

                <div className="flex flex-col gap-5">
                  {groups.map(({ bucket, items }) => (
                    <div key={bucket.key} className="flex flex-col gap-2">
                      <h3 className="flex items-baseline gap-1.5 px-1">
                        <span className="text-sm font-semibold text-primary">
                          {bucket.label}
                        </span>
                        <span className="text-xs text-text-muted tabular-nums">
                          {bucket.hint}
                        </span>
                      </h3>
                      {items.map((s: Schedule) => (
                        <ScheduleItem
                          key={s.id}
                          schedule={s}
                          seniorName={seniorName.get(s.senior_id) ?? "-"}
                          seniors={seniors}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
