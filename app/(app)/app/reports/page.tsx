/**
 * 리포트 (/app/reports) — 일 / 주 / 월 뷰 전환(ReportsView).
 * 서버에서 리포트+세션+피보호자+일정을 조회해 buildDigest 입력(DigestInput)으로 가공해 내려준다.
 * 집계·판정·문구는 전부 lib/reports/digest.ts 가 담당하고, 이 페이지는 조회·매핑만 한다.
 * 하단에 MEDICAL_DISCLAIMER + EMERGENCY_DISCLAIMER 고정 표시(가드레일 1 / THIRD-PLAN P0-7).
 */
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { ReportsView } from "@/components/app/ReportsView";
import { MEDICAL_DISCLAIMER } from "@/lib/contracts/domain";
import { EMERGENCY_DISCLAIMER } from "@/lib/contracts/report-view";
import type { DigestInput } from "@/lib/reports/digest";
import {
  getRecentReports,
  getCallSessions,
  getSeniors,
  getSchedules,
} from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [reports, sessions, seniors, schedules] = await Promise.all([
    getRecentReports(),
    getCallSessions(),
    getSeniors(),
    getSchedules(),
  ]);

  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const seniorName = new Map(seniors.map((s) => [s.id, s.name]));
  const scheduleById = new Map(schedules.map((s) => [s.id, s]));

  const items: DigestInput[] = reports.map((r) => {
    const session = sessionById.get(r.session_id);
    const schedule =
      session && session.schedule_id != null
        ? scheduleById.get(session.schedule_id)
        : undefined;
    const isConsent = session?.purpose === "CONSENT";
    const title = isConsent ? "동의 확인 전화" : schedule?.title ?? "안내 전화";
    return {
      id: r.id,
      sessionId: session?.id ?? null,
      createdAt: r.created_at,
      status: r.adherence_status,
      summary: r.summary,
      moodFlag: r.mood_flag,
      healthFlag: r.health_flag,
      seniorId: session?.senior_id ?? "unknown",
      seniorName: session ? seniorName.get(session.senior_id) ?? "부모님" : "부모님",
      title,
    };
  });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="리포트"
        subtitle="통화 결과를 일·주·월 단위로 모아 봅니다."
      />

      {items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="아직 통화 리포트가 없습니다"
          description="통화가 완료되면 이행 상태와 요약 리포트가 여기에 표시됩니다."
        />
      ) : (
        <ReportsView items={items} />
      )}

      {/* 가드레일 1 + THIRD-PLAN P0-7: 리포트 하단 고정 고지 (의료 / 긴급구조) */}
      <div className="flex flex-col gap-2 rounded-base bg-surface p-4">
        <p className="break-keep text-xs leading-relaxed text-text-muted">
          {MEDICAL_DISCLAIMER}
        </p>
        <p className="break-keep text-xs leading-relaxed text-text-muted">
          {EMERGENCY_DISCLAIMER}
        </p>
      </div>
    </div>
  );
}
