/**
 * 통화 기록 (/app/calls) — 리스트 (실데이터). 비용(cost_krw)은 표시하지 않는다.
 * 데이터를 서버에서 가져와 CallsFilterList(클라이언트)에 넘긴다:
 *  - 피보호자 필터 칩 + 오늘/날짜별(KST) 그룹 + 항목별 구분색 점.
 * 항목 클릭 시 상세(/app/calls/[id]).
 */
import { Phone } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { CallsFilterList } from "@/components/app/CallsFilterList";
import { getCallSessions, getSeniors, getSchedules } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function CallsPage() {
  const [sessions, seniors, schedules] = await Promise.all([
    getCallSessions(),
    getSeniors(),
    getSchedules(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="통화 기록"
        subtitle="부모님께 발신한 안내 전화 기록입니다."
      />

      {sessions.length === 0 ? (
        <EmptyState
          icon={Phone}
          title="아직 통화 기록이 없습니다"
          description="발신이 시작되면 부모님께 걸린 안내 전화가 여기에 표시됩니다."
        />
      ) : (
        <CallsFilterList
          sessions={sessions}
          seniors={seniors.map((s) => ({ id: s.id, name: s.name }))}
          schedules={schedules}
        />
      )}
    </div>
  );
}
