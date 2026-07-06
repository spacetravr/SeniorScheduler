"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import {
  credentialsSchema,
  emailSchema,
  firstIssue,
  mapAuthError,
  newPasswordSchema,
  signInSchema,
} from "@/lib/actions/auth-validation";

/**
 * 인증 Server Actions (Supabase Auth).
 * 주 로그인: 이메일+비밀번호(signUpWithPassword/signInWithPassword).
 * 보조: magic link(sendMagicLink) — 비밀번호 분실 시 메일 로그인용으로 유지.
 * 순수 검증/에러매핑은 auth-validation.ts 로 분리(“use server” 파일은 async export 만 허용).
 * 실발신/데이터는 RLS 로 격리.
 */

export type AuthActionResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * 회원가입 결과: 세션이 즉시 생겼는지(session)로 후속 흐름(ui 리다이렉트 vs 메일 대기)을 구분.
 * AuthActionResult 와 호환(ok/message 공유) + session 필드 추가.
 */
export type SignUpActionResult =
  | { ok: true; message: string; session: boolean }
  | { ok: false; error: string };

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

/**
 * 이메일+비밀번호 회원가입. 주 로그인 방식(magic link 는 보조로 유지).
 * FormData 필드: email, password, password_confirm.
 * guardians 행 생성은 auth.users AFTER INSERT 트리거(handle_new_user, 0002 마이그레이션)가 처리 —
 *   signUp 경로도 auth.users 에 insert 되므로 동일하게 트리거가 적용된다. 액션에서 할 일 없음.
 */
export async function signUpWithPassword(formData: FormData): Promise<SignUpActionResult> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    password_confirm: formData.get("password_confirm"),
  });
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  const supabase = createServerSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // 이메일 확인 ON 인 경우 확인 링크 콜백 대상.
      emailRedirectTo: `${siteUrl()}/api/auth/confirm?next=/app`,
    },
  });

  if (error) {
    // PII 금지: 코드만 로깅.
    console.error("[auth] signUp failed:", error.code, error.status);
    return { ok: false, error: mapAuthError(error.code, error.message) };
  }

  // 이메일 확인 ON: 세션 없이 확인 메일 발송됨. OFF: 세션 즉시 생성.
  const hasSession = data.session !== null;
  if (hasSession) {
    return { ok: true, message: "가입이 완료되었어요.", session: true };
  }
  return {
    ok: true,
    message: "확인 메일을 보냈어요. 메일함에서 링크를 눌러 가입을 완료해 주세요.",
    session: false,
  };
}

/**
 * 이메일+비밀번호 로그인.
 * FormData 필드: email, password.
 * PII 보호: 로그인 시도 이메일을 로그에 남기지 않는다.
 */
export async function signInWithPassword(formData: FormData): Promise<AuthActionResult> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  const supabase = createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // PII 금지: 이메일/메시지 미로깅, 코드만.
    console.error("[auth] signIn failed:", error.code);
    return { ok: false, error: mapAuthError(error.code, error.message) };
  }

  return { ok: true, message: "로그인되었습니다." };
}

/**
 * 로그인 상태에서 비밀번호 설정/변경.
 * FormData 필드: password, password_confirm.
 * 용도: magic link 로 들어온 사용자가 설정에서 비밀번호를 새로 만들거나 변경.
 */
export async function updatePassword(formData: FormData): Promise<AuthActionResult> {
  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    password_confirm: formData.get("password_confirm"),
  });
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  const supabase = createServerSupabase();

  // 미로그인 방어: updateUser 는 세션이 없으면 실패하지만, 명시적 한국어 안내를 위해 선확인.
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { ok: false, error: "로그인이 필요합니다. 다시 로그인해 주세요." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    console.error("[auth] updatePassword failed:", error.code);
    return { ok: false, error: mapAuthError(error.code, error.message) };
  }

  return { ok: true, message: "비밀번호가 변경되었습니다." };
}

/** 로그아웃 Server Action. 세션 쿠키 제거. */
export async function signOut(): Promise<void> {
  const supabase = createServerSupabase();
  await supabase.auth.signOut();
}
