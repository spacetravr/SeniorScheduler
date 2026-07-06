import { describe, it, expect } from "vitest";
import {
  credentialsSchema,
  newPasswordSchema,
  signInSchema,
  passwordSchema,
  mapAuthError,
  firstIssue,
} from "./auth-validation";

describe("passwordSchema", () => {
  it("8자 미만은 거부", () => {
    const r = passwordSchema.safeParse("1234567");
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toContain("최소 8자");
  });

  it("정확히 8자는 허용", () => {
    expect(passwordSchema.safeParse("12345678").success).toBe(true);
  });

  it("72자는 허용, 73자는 bcrypt 한계로 거부", () => {
    expect(passwordSchema.safeParse("a".repeat(72)).success).toBe(true);
    const r = passwordSchema.safeParse("a".repeat(73));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toContain("최대 72자");
  });
});

describe("credentialsSchema", () => {
  it("정상 입력 통과", () => {
    const r = credentialsSchema.safeParse({
      email: "a@b.com",
      password: "supersecret",
      password_confirm: "supersecret",
    });
    expect(r.success).toBe(true);
  });

  it("확인 불일치는 password_confirm 경로 이슈로 거부", () => {
    const r = credentialsSchema.safeParse({
      email: "a@b.com",
      password: "supersecret",
      password_confirm: "different1",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues[0];
      expect(issue?.path).toEqual(["password_confirm"]);
      expect(issue?.message).toContain("일치하지 않습니다");
    }
  });

  it("잘못된 이메일 거부", () => {
    const r = credentialsSchema.safeParse({
      email: "not-email",
      password: "supersecret",
      password_confirm: "supersecret",
    });
    expect(r.success).toBe(false);
  });

  it("짧은 비밀번호 거부", () => {
    const r = credentialsSchema.safeParse({
      email: "a@b.com",
      password: "short",
      password_confirm: "short",
    });
    expect(r.success).toBe(false);
  });
});

describe("newPasswordSchema", () => {
  it("email 없이 password/확인만으로 통과", () => {
    const r = newPasswordSchema.safeParse({
      password: "newsecret1",
      password_confirm: "newsecret1",
    });
    expect(r.success).toBe(true);
  });

  it("확인 불일치 거부", () => {
    const r = newPasswordSchema.safeParse({
      password: "newsecret1",
      password_confirm: "nope",
    });
    expect(r.success).toBe(false);
  });
});

describe("signInSchema", () => {
  it("빈 비밀번호 거부", () => {
    const r = signInSchema.safeParse({ email: "a@b.com", password: "" });
    expect(r.success).toBe(false);
  });

  it("정상 통과 (로그인은 길이 정책 미적용)", () => {
    const r = signInSchema.safeParse({ email: "a@b.com", password: "x" });
    expect(r.success).toBe(true);
  });
});

describe("mapAuthError", () => {
  it("이미 가입된 이메일 (code)", () => {
    expect(mapAuthError("user_already_exists", undefined)).toBe(
      "이미 가입된 이메일입니다. 로그인해 주세요.",
    );
    expect(mapAuthError("email_exists", undefined)).toBe(
      "이미 가입된 이메일입니다. 로그인해 주세요.",
    );
  });

  it("이미 가입된 이메일 (message 폴백)", () => {
    expect(mapAuthError(undefined, "User already registered")).toBe(
      "이미 가입된 이메일입니다. 로그인해 주세요.",
    );
  });

  it("잘못된 자격 증명", () => {
    expect(mapAuthError("invalid_credentials", undefined)).toBe(
      "이메일 또는 비밀번호가 올바르지 않습니다.",
    );
    expect(mapAuthError(undefined, "Invalid login credentials")).toBe(
      "이메일 또는 비밀번호가 올바르지 않습니다.",
    );
  });

  it("이메일 미확인", () => {
    expect(mapAuthError("email_not_confirmed", undefined)).toContain("이메일 확인이 필요");
  });

  it("약한 비밀번호", () => {
    expect(mapAuthError("weak_password", undefined)).toContain("너무 약합니다");
  });

  it("동일 비밀번호", () => {
    expect(mapAuthError("same_password", undefined)).toContain("다른 새 비밀번호");
  });

  it("레이트 리밋 (이메일 발송)", () => {
    expect(mapAuthError("over_email_send_rate_limit", undefined)).toBe(
      "요청이 많아 잠시 후 다시 시도해 주세요.",
    );
    expect(mapAuthError("over_request_rate_limit", undefined)).toBe(
      "요청이 많아 잠시 후 다시 시도해 주세요.",
    );
  });

  it("알 수 없는 에러는 일반 메시지", () => {
    expect(mapAuthError("something_weird", "unknown")).toBe(
      "처리에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    );
    expect(mapAuthError(undefined, undefined)).toBe(
      "처리에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    );
  });

  it("PII(이메일)를 메시지에 포함하지 않는다", () => {
    const out = mapAuthError("invalid_credentials", "for user someone@example.com");
    expect(out).not.toContain("someone@example.com");
  });
});

describe("firstIssue", () => {
  it("첫 이슈 메시지 반환", () => {
    const r = credentialsSchema.safeParse({ email: "bad", password: "x", password_confirm: "y" });
    if (!r.success) expect(typeof firstIssue(r.error)).toBe("string");
  });
});
