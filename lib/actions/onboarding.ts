"use server";

import { revalidatePath } from "next/cache";
import {
  EMPTY_ONBOARDING_PROFILE,
  onboardingProfileSchema,
  type OnboardingState,
} from "@/lib/contracts/onboarding";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * 온보딩(2스텝 5문항) 서버 액션.
 *
 * - 입력은 lib/contracts/onboarding.ts onboardingProfileSchema 로 검증(계약 = 단일 소스).
 * - 반드시 RLS 클라이언트(server.ts) 경유 — 로그인 guardian 본인 행(id = auth.uid())만
 *   (0002 guardians_select_own / guardians_update_own 정책 범위. 0010 이 추가한 컬럼도 같은 정책).
 * - 시간대(CLAUDE.md): onboarded_at 은 timestamptz(UTC ISO 저장). 표시 시 Asia/Seoul 로 포맷.
 * - 조사는 이탈 지점이 되면 안 된다: 건너뛰어도 onboarded_at 을 기록해 재노출하지 않는다.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

const ONBOARDING_COLS =
  "guardian_age_band, residence_distance, parent_age_band, primary_concern, preferred_call_slot, onboarded_at, onboarding_skipped";

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

/**
 * 온보딩 상태 조회. **throw 하지 않고 항상 상태를 반환한다** (게이트가 이 값 하나만 보고 판단).
 *
 * `available:false` = 조회 자체가 불가한 상태(미인증·DB 오류·0010 미적용).
 * 이때 게이트는 **통과시킨다** — 조회가 실패했다고 사용자를 온보딩에 가두면
 * 마이그레이션 지연 시 앱 전체가 막힌다(fail-open).
 */
export type OnboardingGateState = OnboardingState & { available: boolean };

const UNAVAILABLE_STATE: OnboardingGateState = {
  onboarded_at: null,
  skipped: false,
  profile: EMPTY_ONBOARDING_PROFILE,
  available: false,
};

export async function getOnboardingState(): Promise<OnboardingGateState> {
  const auth = await requireGuardianId();
  if (!auth.ok) return UNAVAILABLE_STATE;

  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("guardians")
    .select(ONBOARDING_COLS)
    .eq("id", auth.id)
    .maybeSingle();

  if (error) {
    console.error("[onboarding] get failed:", error.code, error.message);
    return UNAVAILABLE_STATE;
  }

  const row = (data ?? null) as Record<string, unknown> | null;
  // DB 값은 계약 enum 밖일 수 없으나(0010 CHECK), 방어적으로 파싱해 실패 시 null 로 떨어뜨린다.
  const parsed = onboardingProfileSchema.safeParse({
    guardian_age_band: row?.guardian_age_band ?? null,
    residence_distance: row?.residence_distance ?? null,
    parent_age_band: row?.parent_age_band ?? null,
    primary_concern: row?.primary_concern ?? null,
    preferred_call_slot: row?.preferred_call_slot ?? null,
  });

  return {
    onboarded_at: (row?.onboarded_at as string | null) ?? null,
    skipped: Boolean(row?.onboarding_skipped),
    profile: parsed.success ? parsed.data : EMPTY_ONBOARDING_PROFILE,
    available: true,
  };
}

/** 온보딩 프로필 저장 — zod 검증 후 자기 행만 update. onboarded_at 기록(재노출 방지). */
export async function saveOnboarding(raw: unknown): Promise<ActionResult> {
  const parsed = onboardingProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "입력이 올바르지 않습니다." };
  }

  const auth = await requireGuardianId();
  if (!auth.ok) return auth;

  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("guardians")
    .update({
      ...parsed.data,
      onboarded_at: new Date().toISOString(),
      onboarding_skipped: false,
    })
    .eq("id", auth.id);

  if (error) {
    console.error("[onboarding] save failed:", error.code, error.message);
    return { ok: false, error: "온보딩 정보를 저장하지 못했습니다." };
  }

  revalidatePath("/app");
  revalidatePath("/app/settings");
  return { ok: true };
}

/** 건너뛰기 — 프로필은 비운 채 통과 표식만 남긴다(설정에서 언제든 다시 채울 수 있다). */
export async function skipOnboarding(): Promise<ActionResult> {
  const auth = await requireGuardianId();
  if (!auth.ok) return auth;

  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("guardians")
    .update({ onboarded_at: new Date().toISOString(), onboarding_skipped: true })
    .eq("id", auth.id);

  if (error) {
    console.error("[onboarding] skip failed:", error.code, error.message);
    return { ok: false, error: "건너뛰기에 실패했습니다." };
  }

  revalidatePath("/app");
  return { ok: true };
}
