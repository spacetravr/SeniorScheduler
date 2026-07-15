import "server-only";
import type {
  Senior,
  Schedule,
  CallSession,
  CallTurn,
  CallReport,
} from "@/lib/contracts/domain";
import { createServerSupabase } from "@/lib/supabase/server";
import { instanceOnKstDate, kstDateOf } from "@/lib/scheduling/occurrences";

/**
 * 조회 헬퍼 — 모두 RLS 클라이언트(server.ts) 경유하므로 자동으로 본인 데이터만 반환한다.
 * 반환 타입은 domain.ts 계약 타입.
 */

const SENIOR_COLS =
  "id, name, phone, relationship, birth_year, consent_at, consent_by, self_consent_at, created_at";
const CALL_SESSION_COLS =
  "id, purpose, schedule_id, senior_id, status, attempt, scheduled_at, started_at, ended_at, cost_krw";
const CALL_TURN_COLS = "id, session_id, role, input_kind, text, created_at";
const CALL_REPORT_COLS =
  "id, session_id, adherence_status, summary, mood_flag, health_flag, prompt_version, created_at";

// Postgres numeric 은 supabase-js 에서 문자열로 오므로 number 로 정규화(정밀도 손실 방지 목적의
// 문자열 반환을 여기서 계약 타입(number)으로 맞춘다 — 통화 원가는 소수 2자리 규모).
function normalizeSession(row: Record<string, unknown>): CallSession {
  return {
    ...(row as unknown as CallSession),
    cost_krw: row.cost_krw == null ? null : Number(row.cost_krw),
  };
}
// schedules 는 비정규화 guardian_id 를 갖지만 Schedule 계약엔 없으므로 select 에서 제외.
const SCHEDULE_COLS =
  "id, senior_id, type, title, script_template, call_time, rrule, active, created_at";

/** 본인 피보호자 목록(생성 순). */
export async function getSeniors(): Promise<Senior[]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("seniors")
    .select(SENIOR_COLS)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[queries] getSeniors:", error.code, error.message);
    return [];
  }
  return (data ?? []) as Senior[];
}

/** 본인 일정 목록(선택적으로 특정 senior 로 필터). */
export async function getSchedules(seniorId?: string): Promise<Schedule[]> {
  const supabase = createServerSupabase();
  let query = supabase.from("schedules").select(SCHEDULE_COLS);
  if (seniorId) query = query.eq("senior_id", seniorId);
  const { data, error } = await query.order("call_time", { ascending: true });
  if (error) {
    console.error("[queries] getSchedules:", error.code, error.message);
    return [];
  }
  return (data ?? []) as Schedule[];
}

/** 오늘(KST) 발생하는 활성 일정 인스턴스. */
export type CallInstance = {
  schedule: Schedule;
  senior: Senior;
  /** 오늘 KST 발신 예정 instant(ISO). */
  scheduled_at: string;
};

/**
 * 오늘(Asia/Seoul) 발생하는 활성 일정 인스턴스 목록을 발신 시각 순으로 반환.
 * RRULE 판정·시각 계산은 lib/scheduling/occurrences.ts(KST 고정)를 사용.
 */
export async function getTodayCallInstances(now: Date = new Date()): Promise<CallInstance[]> {
  const supabase = createServerSupabase();

  const [{ data: schedRows, error: schedErr }, { data: seniorRows, error: seniorErr }] =
    await Promise.all([
      supabase.from("schedules").select(SCHEDULE_COLS).eq("active", true),
      supabase.from("seniors").select(SENIOR_COLS),
    ]);

  if (schedErr || seniorErr) {
    console.error("[queries] getTodayCallInstances:", schedErr?.message, seniorErr?.message);
    return [];
  }

  const seniors = (seniorRows ?? []) as Senior[];
  const seniorById = new Map(seniors.map((s) => [s.id, s]));
  const todayYmd = kstDateOf(now);

  const instances: CallInstance[] = [];
  for (const schedule of (schedRows ?? []) as Schedule[]) {
    const senior = seniorById.get(schedule.senior_id);
    if (!senior) continue;
    let instant: Date | null;
    try {
      instant = instanceOnKstDate(schedule.rrule, schedule.call_time, todayYmd);
    } catch {
      // 손상된 rrule/시각은 대시보드에서 조용히 건너뛴다(로그만).
      console.error("[queries] bad schedule occurrence:", schedule.id);
      continue;
    }
    if (!instant) continue;
    instances.push({ schedule, senior, scheduled_at: instant.toISOString() });
  }

  instances.sort((a, b) => a.schedule.call_time.localeCompare(b.schedule.call_time));
  return instances;
}

// ── 통화 조회 (ui-builder 가 대시보드/통화기록 UI 에서 사용) ─────────────────────
// 모두 RLS 클라이언트 경유 → call_* SELECT 정책(senior→guardian_id=auth.uid())으로
// 자동 격리된다. 서버 write 는 admin(secret key)만 하므로 여기엔 write 없음.

/** 본인 피보호자의 통화 세션 목록(최신 예정 시각 순, 기본 50건). */
export async function getCallSessions(limit = 50): Promise<CallSession[]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("call_sessions")
    .select(CALL_SESSION_COLS)
    .order("scheduled_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[queries] getCallSessions:", error.code, error.message);
    return [];
  }
  return (data ?? []).map((r) => normalizeSession(r as Record<string, unknown>));
}

export type CallSessionDetail = {
  session: CallSession;
  turns: CallTurn[];
  report: CallReport | null;
};

/** 세션 1건 상세(턴 + 리포트). 없거나 접근 불가면 null. */
export async function getCallSessionDetail(id: string): Promise<CallSessionDetail | null> {
  const supabase = createServerSupabase();

  const { data: sessionRow, error: sErr } = await supabase
    .from("call_sessions")
    .select(CALL_SESSION_COLS)
    .eq("id", id)
    .maybeSingle();
  if (sErr) {
    console.error("[queries] getCallSessionDetail session:", sErr.code, sErr.message);
    return null;
  }
  if (!sessionRow) return null;

  const [{ data: turnRows, error: tErr }, { data: reportRow, error: rErr }] = await Promise.all([
    supabase
      .from("call_turns")
      .select(CALL_TURN_COLS)
      .eq("session_id", id)
      .order("created_at", { ascending: true }),
    supabase.from("call_reports").select(CALL_REPORT_COLS).eq("session_id", id).maybeSingle(),
  ]);
  if (tErr) console.error("[queries] getCallSessionDetail turns:", tErr.code, tErr.message);
  if (rErr) console.error("[queries] getCallSessionDetail report:", rErr.code, rErr.message);

  return {
    session: normalizeSession(sessionRow as Record<string, unknown>),
    turns: (turnRows ?? []) as CallTurn[],
    report: (reportRow as CallReport | null) ?? null,
  };
}

/** 최근 통화 리포트(최신순, 기본 20건). 대시보드 요약 카드용. */
export async function getRecentReports(limit = 20): Promise<CallReport[]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("call_reports")
    .select(CALL_REPORT_COLS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[queries] getRecentReports:", error.code, error.message);
    return [];
  }
  return (data ?? []) as CallReport[];
}
