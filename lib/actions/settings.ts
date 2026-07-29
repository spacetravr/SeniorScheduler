"use server";

import { revalidatePath } from "next/cache";
import {
  notifySettingsSchema,
  DEFAULT_NOTIFY_SETTINGS,
  type NotifySettings,
} from "@/lib/contracts/settings";
import {
  DEFAULT_NOTIFY_LEVEL,
  NOTIFY_LEVELS,
  type NotifyLevel,
} from "@/lib/contracts/notify";
import { createServerSupabase } from "@/lib/supabase/server";
import { z } from "zod";

/**
 * 알림 설정 조회/저장 Server Actions.
 * - 입력은 lib/contracts/settings.ts notifySettingsSchema 로 검증(실패 시 4xx 대신 액션 에러 반환).
 * - 반드시 RLS 클라이언트(server.ts) 경유 — 로그인 guardian 본인 행(id = auth.uid())만.
 *   (0002 guardians_update_own 정책이 자기 행 update 를 허용.)
 * - UI 연결은 다음 웨이브(ui 에이전트). 여기서는 액션만 제공.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

const NOTIFY_COLS = "notify_call_result, notify_missed, notify_weekly_summary";

async function requireGuardianId(): Promise<
  { ok: true; id: string } | { ok: false; error: string }
> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  return { ok: true, id: user.id };
}

/** 로그인 guardian 의 알림 설정 조회. 행이 없거나 오류면 기본값으로 강등(throw 금지). */
export async function getNotifySettings(): Promise<
  { ok: true; settings: NotifySettings } | { ok: false; error: string }
> {
  const auth = await requireGuardianId();
  if (!auth.ok) return auth;

  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("guardians")
    .select(NOTIFY_COLS)
    .eq("id", auth.id)
    .maybeSingle();

  if (error) {
    console.error("[settings] get failed:", error.code, error.message);
    return { ok: false, error: "알림 설정을 불러오지 못했습니다." };
  }

  return {
    ok: true,
    settings: {
      notify_call_result: data?.notify_call_result ?? DEFAULT_NOTIFY_SETTINGS.notify_call_result,
      notify_missed: data?.notify_missed ?? DEFAULT_NOTIFY_SETTINGS.notify_missed,
      notify_weekly_summary:
        data?.notify_weekly_summary ?? DEFAULT_NOTIFY_SETTINGS.notify_weekly_summary,
    },
  };
}

/** 알림 설정 저장 — zod 검증 후 자기 행만 update. */
export async function updateNotifySettings(raw: unknown): Promise<ActionResult> {
  const parsed = notifySettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "입력이 올바르지 않습니다." };
  }

  const auth = await requireGuardianId();
  if (!auth.ok) return auth;

  const supabase = createServerSupabase();
  const { error } = await supabase.from("guardians").update(parsed.data).eq("id", auth.id);

  if (error) {
    console.error("[settings] update failed:", error.code, error.message);
    return { ok: false, error: "알림 설정 저장에 실패했습니다." };
  }

  revalidatePath("/app/settings");
  revalidatePath("/app");
  return { ok: true };
}

// ── 알림 레벨 (0010 notify_level — boolean 3종을 덮는 상위 개념) ────────────────

const notifyLevelSchema = z.enum(NOTIFY_LEVELS);

/** 로그인 guardian 의 알림 레벨 조회. 오류·미기록이면 기본값(EXCEPTION)으로 강등. */
export async function getNotifyLevel(): Promise<
  { ok: true; level: NotifyLevel } | { ok: false; error: string }
> {
  const auth = await requireGuardianId();
  if (!auth.ok) return auth;

  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("guardians")
    .select("notify_level")
    .eq("id", auth.id)
    .maybeSingle();

  if (error) {
    console.error("[settings] get level failed:", error.code, error.message);
    return { ok: false, error: "알림 설정을 불러오지 못했습니다." };
  }
  const parsed = notifyLevelSchema.safeParse(data?.notify_level);
  return { ok: true, level: parsed.success ? parsed.data : DEFAULT_NOTIFY_LEVEL };
}

/**
 * 알림 레벨 저장 — zod 검증 후 자기 행만 update.
 * 하위호환: 0008 boolean 3종을 레벨에 맞춰 함께 동기화한다(옛 코드 경로·기존 쿼리가 계속 성립).
 *   ALL         → call_result=true,  missed=true
 *   EXCEPTION   → call_result=false, missed=true
 *   WEEKLY_ONLY → call_result=false, missed=false, weekly_summary=true
 * 주간 요약 수신(notify_weekly_summary)은 ALL/EXCEPTION 에서는 **별개 의사표시**이므로 건드리지 않는다
 * — 전용 토글(updateWeeklySummary)이 담당한다. 기본값은 0012 에서 ON 으로 뒤집혔다.
 * WEEKLY_ONLY 만 예외: 그 레벨을 고르는 행위 자체가 주간 요약 수신 의사이므로 강제로 켠다.
 */
export async function updateNotifyLevel(raw: unknown): Promise<ActionResult> {
  const parsed = notifyLevelSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "알림 수준 값이 올바르지 않습니다." };
  }
  const level = parsed.data;

  const auth = await requireGuardianId();
  if (!auth.ok) return auth;

  const patch: Record<string, unknown> = {
    notify_level: level,
    notify_call_result: level === "ALL",
    notify_missed: level === "ALL" || level === "EXCEPTION",
  };
  if (level === "WEEKLY_ONLY") patch.notify_weekly_summary = true;

  const supabase = createServerSupabase();
  const { error } = await supabase.from("guardians").update(patch).eq("id", auth.id);

  if (error) {
    console.error("[settings] update level failed:", error.code, error.message);
    return { ok: false, error: "알림 설정 저장에 실패했습니다." };
  }

  revalidatePath("/app/settings");
  revalidatePath("/app");
  return { ok: true };
}

// ── 주간 요약 수신 토글 (notify_weekly_summary 전용) ─────────────────────────────

const weeklySummarySchema = z.boolean();

/**
 * 로그인 guardian 의 주간 요약 수신 여부 조회.
 * 오류·미기록이면 **수신(true)** 으로 강등한다 — 0012 이후 기본값이 ON 이므로 화면 초깃값이
 * 실제 발송 대상 여부와 어긋나지 않게(꺼진 것처럼 보였는데 메일이 오는 상황 방지).
 */
export async function getWeeklySummary(): Promise<
  { ok: true; enabled: boolean } | { ok: false; error: string }
> {
  const auth = await requireGuardianId();
  if (!auth.ok) return auth;

  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("guardians")
    .select("notify_weekly_summary")
    .eq("id", auth.id)
    .maybeSingle();

  if (error) {
    console.error("[settings] get weekly failed:", error.code, error.message);
    return { ok: false, error: "알림 설정을 불러오지 못했습니다." };
  }
  return { ok: true, enabled: data?.notify_weekly_summary ?? true };
}

/**
 * 주간 요약 수신 저장 — 자기 행만 update.
 * 레벨(notify_level)은 건드리지 않는다. 단 WEEKLY_ONLY 레벨에서 이 토글을 끄면 아무 알림도
 * 받지 않게 되는데, 그것도 사용자의 정당한 선택이므로 막지 않고 화면 문구로만 안내한다.
 */
export async function updateWeeklySummary(raw: unknown): Promise<ActionResult> {
  const parsed = weeklySummarySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "주간 요약 설정 값이 올바르지 않습니다." };
  }

  const auth = await requireGuardianId();
  if (!auth.ok) return auth;

  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("guardians")
    .update({ notify_weekly_summary: parsed.data })
    .eq("id", auth.id);

  if (error) {
    console.error("[settings] update weekly failed:", error.code, error.message);
    return { ok: false, error: "알림 설정 저장에 실패했습니다." };
  }

  revalidatePath("/app/settings");
  return { ok: true };
}
