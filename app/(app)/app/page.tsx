/**
 * 대시보드 (/app)
 * - 피보호자 0명: 온보딩 스텝(OnboardingSteps)이 화면 그 자체가 된다.
 * - 피보호자 1명+: 피보호자별 to-do 카드(오늘의 일정 + 수행 여부)를 세로 나열.
 *   수행 여부는 오늘(KST) 세션·리포트를 schedule_id로 매칭해 도출. (lib 수정 없이 page 내 조합)
 * - 주간 이행률: getRecentReports() 실데이터. "최근 통화 결과" 섹션은 제거됨.
 */
import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { kstYmd } from "@/components/app/format";
import { OnboardingSteps } from "@/components/app/OnboardingSteps";
import { SeniorFormModal } from "@/components/app/SeniorFormModal";
import { SeniorTodoCard, type SeniorTodo } from "@/components/app/SeniorTodoCard";
import {
  getTodayCallInstances,
  getSeniors,
  getSchedules,
  getCallSessions,
  getRecentReports,
} from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/** "YYYY-MM-DD (요일)" KST 오늘 라벨 (표시 전용). */
function todayLabelKst(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(now);
  return parts;
}

/** KST 기준 오늘 날짜 "YYYY-MM-DD". */
function todayYmdKst(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** 달력 날짜(YYYY-MM-DD)에 delta일을 더한 날짜 문자열 (TZ 무관, 순수 달력 연산). */
function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;
/** 달력 날짜의 요일 한글 라벨 (정오 앵커로 TZ 영향 제거). */
function weekdayLabelKo(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return WEEKDAY_KO[new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()];
}

export default async function DashboardPage() {
  const [instances, seniors, schedules, sessions, reports] = await Promise.all([
    getTodayCallInstances(),
    getSeniors(),
    getSchedules(),
    getCallSessions(),
    getRecentReports(),
  ]);

  const hasSeniors = seniors.length > 0;
  const hasReports = reports.length > 0;

  const todayYmd = todayYmdKst(new Date());

  // 피보호자별 활성 일정 수 — 카드 프로필 헤더에 표시.
  const activeScheduleCount = new Map<string, number>();
  for (const sch of schedules) {
    if (!sch.active) continue;
    activeScheduleCount.set(
      sch.senior_id,
      (activeScheduleCount.get(sch.senior_id) ?? 0) + 1,
    );
  }

  // 오늘(KST) SCHEDULE 세션을 schedule_id 로 인덱싱 → 리포트 이행상태로 오늘의 수행 여부 도출.
  // reports 는 session_id 로 매칭. 리포트 없이 불발(MISSED)된 세션은 MISSED 로 표시.
  const reportBySession = new Map(reports.map((r) => [r.session_id, r]));
  const todayStatusBySchedule = new Map<string, SeniorTodo["status"]>();
  for (const s of sessions) {
    if (s.schedule_id == null) continue;
    if (kstYmd(s.scheduled_at) !== todayYmd) continue;
    if (todayStatusBySchedule.has(s.schedule_id)) continue; // 세션은 최신순 → 첫 건이 최신
    const report = reportBySession.get(s.id);
    const status: SeniorTodo["status"] = report
      ? report.adherence_status
      : s.status === "MISSED"
        ? "MISSED"
        : null;
    todayStatusBySchedule.set(s.schedule_id, status);
  }

  // 피보호자별 오늘의 to-do — instances(오늘 KST 인스턴스, 발신시각 순)를 senior 로 그룹핑.
  const todosBySenior = new Map<string, SeniorTodo[]>();
  for (const inst of instances) {
    const arr = todosBySenior.get(inst.senior.id) ?? [];
    arr.push({
      scheduleId: inst.schedule.id,
      scheduledAt: inst.scheduled_at,
      title: inst.schedule.title,
      type: inst.schedule.type,
      status: todayStatusBySchedule.get(inst.schedule.id) ?? null,
    });
    todosBySenior.set(inst.senior.id, arr);
  }

  // 최근 7일(오늘 포함) 이행률 집계 — 리포트 created_at(KST)의 날짜 부분으로 그룹핑.
  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysYmd(todayYmd, i - 6));
  const reportsByDay = new Map<string, typeof reports>();
  for (const r of reports) {
    const ymd = kstYmd(r.created_at);
    const arr = reportsByDay.get(ymd) ?? [];
    arr.push(r);
    reportsByDay.set(ymd, arr);
  }
  const weekReports = weekDays.flatMap((ymd) => reportsByDay.get(ymd) ?? []);
  const weekDone = weekReports.filter((r) => r.adherence_status === "DONE").length;
  const weekTotal = weekReports.length;
  const weekRate = weekTotal > 0 ? Math.round((weekDone / weekTotal) * 100) : 0;
  const byDay = weekDays.map((ymd) => {
    const dayReports = reportsByDay.get(ymd) ?? [];
    return {
      label: weekdayLabelKo(ymd),
      hasReport: dayReports.length > 0,
      done: dayReports.some((r) => r.adherence_status === "DONE"),
    };
  });

  // ── 피보호자 0명: 온보딩 화면 ─────────────────────────────────
  if (!hasSeniors) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="대시보드" subtitle={todayLabelKst()} />
        <OnboardingSteps />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="대시보드" subtitle={todayLabelKst()} />

      {/* 빠른 등록 — 피보호자 등록(모달) + 일정 등록 2버튼 */}
      <section aria-label="빠른 등록" className="grid grid-cols-2 gap-3">
        <SeniorFormModal variant="outline" />
        <Link
          href="/app/schedules"
          className="flex items-center justify-center gap-2 rounded-base border border-border bg-bg px-4 py-3.5 text-sm font-semibold text-primary shadow-card transition-colors hover:bg-primary-soft"
        >
          <CalendarPlus className="h-5 w-5 shrink-0" aria-hidden strokeWidth={2} />
          일정 등록
        </Link>
      </section>

      {/* 피보호자별 오늘의 to-do 카드 */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">
            오늘의 일정
            <span className="ml-1.5 text-sm font-normal text-text-muted tabular-nums">
              피보호자 {seniors.length}명
            </span>
          </h2>
          <Link href="/app/seniors" className="text-sm font-medium text-primary">
            피보호자 관리
          </Link>
        </div>
        <div className="flex flex-col gap-4">
          {seniors.map((s, i) => (
            <SeniorTodoCard
              key={s.id}
              senior={s}
              activeCount={activeScheduleCount.get(s.id) ?? 0}
              todos={todosBySenior.get(s.id) ?? []}
              colorIndex={i % 3}
            />
          ))}
        </div>
      </section>

      {/* 주간 이행률 (실데이터) */}
      <section className="rounded-base bg-surface p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-base font-semibold">이번 주 이행률</h2>
          {hasReports ? (
            <p className="text-sm text-text-muted">
              <span className="text-2xl font-bold text-primary">{weekRate}%</span>{" "}
              ({weekDone}/{weekTotal}건)
            </p>
          ) : null}
        </div>
        {hasReports ? (
          <div className="flex justify-between gap-2">
            {byDay.map((d, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                <span
                  className={`flex h-9 w-full items-center justify-center rounded-base text-xs font-semibold ${
                    d.done ? "bg-primary text-bg" : "bg-bg text-text-muted"
                  }`}
                  aria-label={
                    !d.hasReport ? "기록 없음" : d.done ? "이행" : "미이행"
                  }
                >
                  {d.done ? "○" : "–"}
                </span>
                <span className="text-xs text-text-muted">{d.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="break-keep text-sm leading-relaxed text-text-muted">
            아직 통화 기록이 없습니다. 발신이 시작되면 주간 이행률이 여기에
            표시됩니다.
          </p>
        )}
      </section>
    </div>
  );
}
