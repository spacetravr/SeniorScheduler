import { describe, it, expect } from "vitest";
import { isValidEmail } from "./validation";

describe("isValidEmail", () => {
  it("정상 이메일을 통과시킨다", () => {
    expect(isValidEmail("a@b.com")).toBe(true);
    expect(isValidEmail("parent.care@familycarecall.co.kr")).toBe(true);
  });

  it("앞뒤 공백을 무시한다", () => {
    expect(isValidEmail("  user@site.com  ")).toBe(true);
  });

  it("형식이 틀리면 거부한다", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("no-at-sign")).toBe(false);
    expect(isValidEmail("user@")).toBe(false);
    expect(isValidEmail("user@site")).toBe(false);
    expect(isValidEmail("user @site.com")).toBe(false);
    expect(isValidEmail("a@b@c.com")).toBe(false);
  });
});
