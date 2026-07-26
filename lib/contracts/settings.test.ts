import { describe, it, expect } from "vitest";
import { notifySettingsSchema, DEFAULT_NOTIFY_SETTINGS } from "./settings";

describe("notifySettingsSchema", () => {
  it("3개 boolean 이 모두 있으면 통과한다", () => {
    const r = notifySettingsSchema.safeParse({
      notify_call_result: true,
      notify_missed: false,
      notify_weekly_summary: true,
    });
    expect(r.success).toBe(true);
  });

  it("필드 누락은 거부한다", () => {
    const r = notifySettingsSchema.safeParse({
      notify_call_result: true,
      notify_missed: true,
    });
    expect(r.success).toBe(false);
  });

  it("boolean 이 아닌 타입은 거부한다", () => {
    const r = notifySettingsSchema.safeParse({
      notify_call_result: "yes",
      notify_missed: true,
      notify_weekly_summary: false,
    });
    expect(r.success).toBe(false);
  });

  it("기본값은 스키마를 만족한다", () => {
    expect(notifySettingsSchema.safeParse(DEFAULT_NOTIFY_SETTINGS).success).toBe(true);
  });
});
