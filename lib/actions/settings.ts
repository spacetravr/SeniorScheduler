"use server";

import { revalidatePath } from "next/cache";
import {
  notifySettingsSchema,
  DEFAULT_NOTIFY_SETTINGS,
  type NotifySettings,
} from "@/lib/contracts/settings";
import { createServerSupabase } from "@/lib/supabase/server";

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
