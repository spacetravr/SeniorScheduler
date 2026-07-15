/**
 * 일정 (/app/schedules) — 실데이터 목록(ON/OFF 토글) + 등록/수정/삭제 (server actions 결합).
 * 피보호자가 없으면 먼저 등록하도록 안내한다.
 */
import { Users, AlarmClock } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { ScheduleForm } from "@/components/app/ScheduleForm";
import { ScheduleItem } from "@/components/app/ScheduleItem";
import { EmptyState } from "@/components/app/EmptyState";
import { getSchedules, getSeniors } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function SchedulesPage() {
  const [schedules, seniors] = await Promise.all([getSchedules(), getSeniors()]);
  const seniorName = new Map(seniors.map((s) => [s.id, s.name]));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="일정"
        subtitle="복약·병원 등 안내 전화 일정을 관리합니다."
      />

      {seniors.length === 0 ? (
        <EmptyState
          icon={Users}
          title="먼저 피보호자를 등록해 주세요"
          description="일정은 등록된 피보호자에게 연결됩니다. 부모님을 먼저 등록해 주세요."
          action={{ href: "/app/seniors", label: "피보호자 등록하러 가기" }}
        />
      ) : (
        <>
          {schedules.length === 0 ? (
            <EmptyState
              icon={AlarmClock}
              title="아직 등록된 일정이 없어요"
              description="아래에서 복약·병원 등 안내 전화 일정을 추가해 보세요."
            />
          ) : (
            <section className="flex flex-col gap-2">
              {schedules.map((s) => (
                <ScheduleItem
                  key={s.id}
                  schedule={s}
                  seniorName={seniorName.get(s.senior_id) ?? "-"}
                  seniors={seniors}
                />
              ))}
            </section>
          )}

          <ScheduleForm mode="create" seniors={seniors} />
        </>
      )}
    </div>
  );
}
