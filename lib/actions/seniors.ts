"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { seniorSchema } from "@/lib/contracts/domain";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * 피보호자(seniors) CRUD Server Actions.
 * - 입력은 domain.ts seniorSchema 파생(.pick)으로 검증 — 스키마 원본은 수정 금지.
 * - 반드시 RLS 클라이언트(server.ts) 경유. admin 클라이언트 사용 금지.
 * - 동의(consent) 는 보호자 대리동의 시각(consent_at)/주체(consent_by) 로 기록(가드레일 5).
 */

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

// seniorSchema 에서 사용자가 입력하는 필드만 파생.
const editableFields = seniorSchema.pick({
  name: true,
  phone: true,
  relationship: true,
  birth_year: true,
});

const createInput = editableFields.extend({
  /** 통화 녹취·전사 저장 보호자 대리동의 체크 여부(가드레일 5) */
  consent: z.boolean().default(false),
});

const updateInput = editableFields.extend({ id: z.string().uuid() });

function revalidate() {
  revalidatePath("/app");
  revalidatePath("/app/seniors");
  revalidatePath("/app/schedules");
}

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

/** 피보호자 생성. consent=true 면 consent_at=now, consent_by=본인. */
export async function createSenior(raw: unknown): Promise<ActionResult> {
  const parsed = createInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "입력이 올바르지 않습니다." };
  }

  const auth = await requireGuardianId();
  if (!auth.ok) return auth;

  const { consent, ...fields } = parsed.data;
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("seniors")
    .insert({
      guardian_id: auth.id,
      ...fields,
      consent_at: consent ? new Date().toISOString() : null,
      consent_by: consent ? auth.id : null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[seniors] create failed:", error.code, error.message);
    return { ok: false, error: "피보호자 등록에 실패했습니다." };
  }

  revalidate();
  return { ok: true, id: data.id };
}

/** 피보호자 기본 정보 수정(동의 상태는 건드리지 않음). */
export async function updateSenior(raw: unknown): Promise<ActionResult> {
  const parsed = updateInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "입력이 올바르지 않습니다." };
  }

  const auth = await requireGuardianId();
  if (!auth.ok) return auth;

  const { id, ...fields } = parsed.data;
  const supabase = createServerSupabase();
  const { error } = await supabase.from("seniors").update(fields).eq("id", id);

  if (error) {
    console.error("[seniors] update failed:", error.code, error.message);
    return { ok: false, error: "피보호자 정보 수정에 실패했습니다." };
  }

  revalidate();
  return { ok: true, id };
}

/** 피보호자 삭제(연관 일정은 FK cascade 로 함께 삭제). */
export async function deleteSenior(rawId: unknown): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(rawId);
  if (!parsed.success) return { ok: false, error: "잘못된 요청입니다." };

  const auth = await requireGuardianId();
  if (!auth.ok) return auth;

  const supabase = createServerSupabase();
  const { error } = await supabase.from("seniors").delete().eq("id", parsed.data);

  if (error) {
    console.error("[seniors] delete failed:", error.code, error.message);
    return { ok: false, error: "피보호자 삭제에 실패했습니다." };
  }

  revalidate();
  return { ok: true, id: parsed.data };
}

/**
 * 동의 설정/철회.
 * - consent=true: consent_at=now, consent_by=본인.
 * - consent=false: consent_at=null → DB 트리거가 해당 senior 의 활성 일정을 자동 비활성화.
 */
export async function setSeniorConsent(rawId: unknown, consent: boolean): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(rawId);
  if (!parsed.success) return { ok: false, error: "잘못된 요청입니다." };

  const auth = await requireGuardianId();
  if (!auth.ok) return auth;

  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("seniors")
    .update({
      consent_at: consent ? new Date().toISOString() : null,
      consent_by: consent ? auth.id : null,
    })
    .eq("id", parsed.data);

  if (error) {
    console.error("[seniors] setConsent failed:", error.code, error.message);
    return { ok: false, error: "동의 상태 변경에 실패했습니다." };
  }

  revalidate();
  return { ok: true, id: parsed.data };
}
