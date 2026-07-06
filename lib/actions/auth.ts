"use server";

import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * 인증 Server Actions (Supabase Auth — 이메일 magic link).
 * CLAUDE.md: Auth = Supabase magic link. 실발신/데이터는 RLS 로 격리.
 */

const emailSchema = z.object({
  email: z.string().email("유효한 이메일 주소를 입력해 주세요."),
});

export type AuthActionResult = { ok: true; message: string } | { ok: false; error: string };

/** 사이트 기준 URL (magic link redirect 대상). 끝 슬래시 정규화. */
function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

/**
 * 이메일로 magic link 발송. zod 검증 실패 시 4xx 대신 결과 객체로 반환(폼 표시용).
 * 콜백은 /api/auth/confirm 에서 verifyOtp(token_hash) 로 처리한다.
 */
export async function sendMagicLink(formData: FormData): Promise<AuthActionResult> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "입력이 올바르지 않습니다." };
  }

  const supabase = createServerSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      // 신규 사용자도 magic link 만으로 가입되도록 허용(가입=인증 일원화).
      shouldCreateUser: true,
      emailRedirectTo: `${siteUrl()}/api/auth/confirm?next=/app`,
    },
  });

  if (error) {
    console.error("[auth] signInWithOtp failed:", error.message);
    return { ok: false, error: "메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요." };
  }

  return { ok: true, message: "로그인 링크를 이메일로 보냈어요. 메일함을 확인해 주세요." };
}

/** 로그아웃 Server Action. 세션 쿠키 제거. */
export async function signOut(): Promise<void> {
  const supabase = createServerSupabase();
  await supabase.auth.signOut();
}
