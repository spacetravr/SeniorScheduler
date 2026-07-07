import { describe, it, expect } from "vitest";
import { loginErrorMessage } from "./login-messages";

describe("loginErrorMessage", () => {
  it("값이 없으면 null", () => {
    expect(loginErrorMessage(null)).toBeNull();
    expect(loginErrorMessage(undefined)).toBeNull();
    expect(loginErrorMessage("")).toBeNull();
  });

  it("expired_link → 만료/재요청 안내", () => {
    expect(loginErrorMessage("expired_link")).toContain("만료됐거나 이미 사용됐어요");
  });

  it("invalid_link → 올바르지 않음 안내", () => {
    expect(loginErrorMessage("invalid_link")).toContain("올바르지 않아요");
  });

  it("알 수 없는 값 → 일반 안내로 폴백", () => {
    expect(loginErrorMessage("something_else")).toBe(
      "로그인에 실패했어요. 다시 시도해 주세요.",
    );
  });
});
