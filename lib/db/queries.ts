import "server-only";
import type { Senior, Schedule } from "@/lib/contracts/domain";
import { createServerSupabase } from "@/lib/supabase/server";
import { instanceOnKstDate, kstDateOf } from "@/lib/scheduling/occurrences";

/**
 * 조회 헬퍼 — 모두 RLS 클라이언트(server.ts) 경유하므로 자동으로 본인 데이터만 반환한다.
 * 반환 타입은 domain.ts 계약 타입.
 */

const SENIOR_COLS = "id, name, phone, relationship, birth_year, consent_at, consent_by, created_at";
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
