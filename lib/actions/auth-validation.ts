import { z } from "zod";

/**
 * 인증 폼의 순수 검증/매핑 로직 (서버 액션과 분리 — "use server" 파일은 async 함수만 export 가능).
 * 여기의 스키마·매핑 함수는 부수효과 없는 순수 함수로 유닛 테스트 대상이다.
 */

/** magic link 발송 폼 스키마(이메일 단독). */
export const emailSchema = z.object({
  email: z.string().email("유효한 이메일 주소를 입력해 주세요."),
});

/**
 * 비밀번호 정책(불변): 최소 8자 / 최대 72자.
 * 상한 72는 bcrypt(72바이트)에서 그 이상이 조용히 잘리므로 명시적으로 거부한다.
 */
export const passwordSchema = z
  .string()
  .min(8, "비밀번호는 최소 8자 이상이어야 합니다.")
  .max(72, "비밀번호는 최대 72자까지 가능합니다.");

/** email + password + password_confirm 회원가입 폼 스키마. */
export const credentialsSchema = z
  .object({
    email: z.string().email("유효한 이메일 주소를 입력해 주세요."),
    password: passwordSchema,
    password_confirm: z.string(),
  })
  .refine((v) => v.password === v.password_confirm, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["password_confirm"],
  });

/** 로그인 폼 스키마(password 는 존재만 확인 — 정책 검증은 서버가 담당). */
export const signInSchema = z.object({
  email: z.string().email("유효한 이메일 주소를 입력해 주세요."),
  password: z.string().min(1, "비밀번호를 입력해 주세요."),
});

/** 비밀번호 변경 폼 스키마(로그인 상태, email 불필요). */
export const newPasswordSchema = z
  .object({
    password: passwordSchema,
    password_confirm: z.string(),
  })
  .refine((v) => v.password === v.password_confirm, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["password_confirm"],
  });

/**
 * Supabase auth 에러 → 한국어 사용자 메시지 매핑.
 * error.code(신형) 우선, 없으면 message 문자열로 폴백. PII(이메일)는 절대 포함하지 않는다.
 */
export function mapAuthError(code: string | undefined, message: string | undefined): string {
  const key = (code ?? "").toLowerCase();
  const msg = (message ?? "").toLowerCase();

  // 이미 가입된 이메일 (signUp)
  if (
    key === "user_already_exists" ||
    key === "email_exists" ||
    msg.includes("already registered")
  ) {
    return "이미 가입된 이메일입니다. 로그인해 주세요.";
  }
  // 로그인 자격 불일치
  if (key === "invalid_credentials" || msg.includes("invalid login credentials")) {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }
  // 이메일 미확인
  if (key === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return "이메일 확인이 필요합니다. 받은 확인 메일의 링크를 눌러 주세요.";
  }
  // 비밀번호 정책 위반(약한 비밀번호)
  if (key === "weak_password" || msg.includes("password should be")) {
    return "비밀번호가 너무 약합니다. 8자 이상으로 설정해 주세요.";
  }
  // 새 비밀번호가 기존과 동일 (updateUser)
  if (key === "same_password" || msg.includes("should be different")) {
    return "기존과 다른 새 비밀번호를 입력해 주세요.";
  }
  // 발송/요청 레이트 리밋
  if (
    key === "over_email_send_rate_limit" ||
    key === "over_request_rate_limit" ||
    msg.includes("rate limit") ||
    msg.includes("too many requests")
  ) {
    return "요청이 많아 잠시 후 다시 시도해 주세요.";
  }
  return "처리에 실패했습니다. 잠시 후 다시 시도해 주세요.";
}

/** 첫 번째 zod 이슈 메시지 추출(폼 표시용). */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "입력이 올바르지 않습니다.";
}
