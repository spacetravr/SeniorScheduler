import { describe, it, expect } from "vitest";
import { NOTIFY_LEVELS } from "@/lib/contracts/notify";
import { toNotifyLevel, toNotifySettings } from "./notifyLevel";

describe("toNotifyLevel", () => {
  it("통화 결과 알림이 켜져 있으면 ALL", () => {
    expect(
      toNotifyLevel({
        notify_call_result: true,
        notify_missed: false,
        notify_weekly_summary: false,
      }),
    ).toBe("ALL");
  });

  it("불발 알림만 켜져 있으면 EXCEPTION", () => {
    expect(
      toNotifyLevel({
        notify_call_result: false,
        notify_missed: true,
        notify_weekly_summary: false,
      }),
    ).toBe("EXCEPTION");
  });

  it("둘 다 꺼져 있으면 WEEKLY_ONLY", () => {
    expect(
      toNotifyLevel({
        notify_call_result: false,
        notify_missed: false,
        notify_weekly_summary: true,
      }),
    ).toBe("WEEKLY_ONLY");
  });
});

describe("toNotifySettings", () => {
  it("모든 레벨에서 왕복 일치", () => {
    for (const level of NOTIFY_LEVELS) {
      expect(toNotifyLevel(toNotifySettings(level))).toBe(level);
    }
  });

  it("주간 요약은 어느 레벨에서도 켜진다", () => {
    for (const level of NOTIFY_LEVELS) {
      expect(toNotifySettings(level).notify_weekly_summary).toBe(true);
    }
  });
});
