/**
 * 대시보드 (/app)
 * - 온보딩 게이트: getOnboardingState() 가 미완료(onboarded_at === null)면 /app/onboarding 으로 이동.
 *   조회 실패 시에는 **통과**시킨다(설문이 서비스 진입을 막지 않게).
 * - 최상단 "오늘의 안심 요약": 오늘(KST) 다이제스트의 톤 헤드라인 카드(DigestCard).
 *   기존 3연속 불발 경고 배너는 이 카드 안으로 흡수했다(중복 배너 금지).
 * - 피보호자 0명: 온보딩 스텝(OnboardingSteps)이 화면 그 자체가 된다.
 * - 피보호자 1명+: 피보호자별 to-do 카드(오늘의 일정 + 수행 여부)를 세로 나열.
 *   수행 여부는 오늘(KST) 세션·리포트를 schedule_id로 매칭해 도출. (lib 수정 없이 page 내 조합)
 * - 주간 이행률: getRecentReports() 실데이터. "최근 통화 결과" 섹션은 제거됨.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { kstYmd } from "@/components/app/format";
import { OnboardingSteps } from "@/components/app/OnboardingSteps";
import { SeniorFormModal } from "@/components/app/SeniorFormModal";
import { SeniorTodoCard, type SeniorTodo } from "@/components/app/SeniorTodoCard";
import { DigestCard, type CallTarget } from "@/components/app/DigestCard";
import { hasThreeConsecutiveMissed } from "@/components/app/missedStreak";
import { buildDigest, type DigestInput } from "@/lib/reports/digest";
import { MEDICAL_DISCLAIMER } from "@/lib/contracts/domain";
import { EMERGENCY_DISCLAIMER } from "@/lib/contracts/report-view";
import { getOnboardingState } from "@/lib/actions/onboarding";
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
  // 온보딩 게이트 — 미완료면 설문으로.
  // available:false(미인증·DB 오류·0010 미적용)는 **통과**시킨다 — 조회 실패로 사용자를
  // 온보딩에 가두면 마이그레이션 지연 시 앱 전체가 막힌다(fail-open).
  try {
    const onboarding = await getOnboardingState();
    if (onboarding.available && onboarding.onboarded_at === null) redirect("/app/onboarding");
  } catch (e) {
    // redirect() 는 내부적으로 throw 하므로 다시 던져 준다.
    if (e && typeof e === "object" && "digest" in e) throw e;
  }

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

  // 피보호자별 최근 3연속 불발(MISSED) 경고 — SCHEDULE 콜만, CONSENT 제외.
  // sessions 는 getCallSessions()가 scheduled_at 내림차순 반환하나, 판정 함수가 재정렬하므로 그대로 그룹핑.
  const sessionsBySenior = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const arr = sessionsBySenior.get(s.senior_id) ?? [];
    arr.push(s);
    sessionsBySenior.set(s.senior_id, arr);
  }

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

  // ── 오늘의 안심 요약 (L0) ────────────────────────────────────
  // 집계·톤·문구는 buildDigest 단일 소스. 여기서는 조회 결과를 DigestInput 으로 매핑만 한다.
  const seniorById = new Map(seniors.map((s) => [s.id, s]));
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const scheduleById = new Map(schedules.map((s) => [s.id, s]));

  const digestInputs: DigestInput[] = reports.map((r) => {
    const session = sessionById.get(r.session_id);
    const schedule =
      session && session.schedule_id != null ? scheduleById.get(session.schedule_id) : undefined;
    const title =
      session?.purpose === "CONSENT" ? "동의 확인 전화" : schedule?.title ?? "안내 전화";
    return {
      id: r.id,
      sessionId: session?.id ?? null,
      createdAt: r.created_at,
      status: r.adherence_status,
      summary: r.summary,
      moodFlag: r.mood_flag,
      healthFlag: r.health_flag,
      seniorId: session?.senior_id ?? "unknown",
      seniorName: session ? seniorById.get(session.senior_id)?.name ?? "부모님" : "부모님",
      title,
    };
  });

  const todayDigest = buildDigest(
    "DAY",
    digestInputs.filter((i) => kstYmd(i.createdAt) === todayYmd),
    { startYmd: todayYmd, endYmd: todayYmd },
  );
  // 최근 7일 추이 — 오늘 카드 한 장에만 얹는다(오늘 하루만으로는 추이가 그려지지 않으므로).
  const recentTrend = buildDigest("WEEK", digestInputs).trend;

  // 3회 연속 불발 — 기존 별도 경고 배너 대신 안심 요약 카드 안으로 흡수한다.
  const missedStreakSeniors = seniors.filter((s) =>
    hasThreeConsecutiveMissed(sessionsBySenior.get(s.id) ?? []),
  );

  // ALERT 시 tel: 대상 — 오늘 이상 신호가 있었거나 연속 불발인 피보호자.
  const alertSeniorIds = new Set<string>(missedStreakSeniors.map((s) => s.id));
  for (const s of todayDigest.seniors) {
    if (s.exceptionCount > 0) alertSeniorIds.add(s.seniorId);
  }
  const callTargets: CallTarget[] = [...alertSeniorIds]
    .map((id) => seniorById.get(id))
    .filter((s): s is (typeof seniors)[number] => Boolean(s))
    .map((s) => ({ name: s.name, phone: s.phone }));

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

      {/* 오늘의 안심 요약 (L0) — 이것만 보고 닫아도 되는 층 */}
      <DigestCard
        digest={todayDigest}
        title="오늘의 안심 요약"
        trend={recentTrend}
        hasMissedStreak={missedStreakSeniors.length > 0}
        missedStreakNames={missedStreakSeniors.map((s) => s.name)}
        callTargets={callTargets}
      >
        <Link
          href="/app/reports"
          className="text-sm font-semibold underline underline-offset-2"
        >
          리포트에서 자세히 보기
        </Link>
      </DigestCard>

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
          {/* 연속 불발 경고는 상단 "오늘의 안심 요약" 카드로 흡수됨 (중복 배너 금지) */}
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

      {/* 가드레일 1 + THIRD-PLAN P0-7: 의료 / 긴급구조 고지 */}
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
