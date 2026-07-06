"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { scheduleSchema } from "@/lib/contracts/domain";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseRule, InvalidRruleError } from "@/lib/scheduling/occurrences";

/**
 * 일정(schedules) CRUD Server Actions.
 * - 입력은 domain.ts scheduleSchema 파생(.omit)으로 검증 — 스키마 원본 수정 금지.
 * - rrule 은 parseRule 로 추가 검증(DAILY/WEEKLY;BYDAY 만 허용).
 * - active=true 요청 시 senior.consent_at 없으면 한국어 에러(DB 트리거와 이중 방어, 가드레일 5).
 * - guardian_id 는 DB BEFORE 트리거가 senior 기준으로 채우므로 여기서 보내지 않는다.
 */

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

// id/created_at 제외한 입력 필드.
const baseInput = scheduleSchema.omit({ id: true, created_at: true });
const updateInput = baseInput.extend({ id: z.string().uuid() });

function revalidate() {
  revalidatePath("/app");
  revalidatePath("/app/seniors");
  revalidatePath("/app/schedules");
}

async function requireAuth(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  return { ok: true };
}

/** senior 가 본인 소유이고 동의 완료인지 확인(활성화 이중 방어). */
async function seniorHasConsent(seniorId: string): Promise<boolean> {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("seniors")
    .select("consent_at")
    .eq("id", seniorId)
    .maybeSingle();
  return Boolean(data?.consent_at);
}

function validateRrule(rrule: string): string | null {
  try {
    parseRule(rrule);
    return null;
  } catch (e) {
    return e instanceof InvalidRruleError ? e.message : "반복 규칙이 올바르지 않습니다.";
  }
}

export async function createSchedule(raw: unknown): Promise<ActionResult> {
  const parsed = baseInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "입력이 올바르지 않습니다." };
  }

  const auth = await requireAuth();
  if (!auth.ok) return auth;

  const rruleErr = validateRrule(parsed.data.rrule);
  if (rruleErr) return { ok: false, error: rruleErr };

  if (parsed.data.active && !(await seniorHasConsent(parsed.data.senior_id))) {
    return {
      ok: false,
      error: "동의하지 않은 피보호자의 일정은 활성화할 수 없습니다. 먼저 통화 동의를 완료해 주세요.",
    };
  }

  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("schedules")
    .insert(parsed.data) // guardian_id 는 DB 트리거가 채움
    .select("id")
    .single();

  if (error) {
    console.error("[schedules] create failed:", error.code, error.message);
    return { ok: false, error: "일정 등록에 실패했습니다." };
  }

  revalidate();
  return { ok: true, id: data.id };
}

export async function updateSchedule(raw: unknown): Promise<ActionResult> {
  const parsed = updateInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "입력이 올바르지 않습니다." };
  }

  const auth = await requireAuth();
  if (!auth.ok) return auth;

  const rruleErr = validateRrule(parsed.data.rrule);
  if (rruleErr) return { ok: false, error: rruleErr };

  const { id, ...fields } = parsed.data;

  if (fields.active && !(await seniorHasConsent(fields.senior_id))) {
    return {
      ok: false,
      error: "동의하지 않은 피보호자의 일정은 활성화할 수 없습니다. 먼저 통화 동의를 완료해 주세요.",
    };
  }

  const supabase = createServerSupabase();
  const { error } = await supabase.from("schedules").update(fields).eq("id", id);

  if (error) {
    console.error("[schedules] update failed:", error.code, error.message);
    return { ok: false, error: "일정 수정에 실패했습니다." };
  }

  revalidate();
  return { ok: true, id };
}

export async function deleteSchedule(rawId: unknown): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(rawId);
  if (!parsed.success) return { ok: false, error: "잘못된 요청입니다." };

  const auth = await requireAuth();
  if (!auth.ok) return auth;

  const supabase = createServerSupabase();
  const { error } = await supabase.from("schedules").delete().eq("id", parsed.data);

  if (error) {
    console.error("[schedules] delete failed:", error.code, error.message);
    return { ok: false, error: "일정 삭제에 실패했습니다." };
  }

  revalidate();
  return { ok: true, id: parsed.data };
}

/** 발신 ON/OFF 토글. active=true 인데 동의 없으면 한국어 에러(트리거와 이중 방어). */
export async function toggleScheduleActive(rawId: unknown, active: boolean): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(rawId);
  if (!parsed.success) return { ok: false, error: "잘못된 요청입니다." };

  const auth = await requireAuth();
  if (!auth.ok) return auth;

  const supabase = createServerSupabase();

  if (active) {
    const { data: sched } = await supabase
      .from("schedules")
      .select("senior_id")
      .eq("id", parsed.data)
      .maybeSingle();
    if (!sched) return { ok: false, error: "일정을 찾을 수 없습니다." };
    if (!(await seniorHasConsent(sched.senior_id))) {
      return {
        ok: false,
        error: "동의하지 않은 피보호자의 일정은 활성화할 수 없습니다. 먼저 통화 동의를 완료해 주세요.",
      };
    }
  }

  const { error } = await supabase.from("schedules").update({ active }).eq("id", parsed.data);
  if (error) {
    console.error("[schedules] toggle failed:", error.code, error.message);
    return { ok: false, error: "발신 설정 변경에 실패했습니다." };
  }

  revalidate();
  return { ok: true, id: parsed.data };
}
