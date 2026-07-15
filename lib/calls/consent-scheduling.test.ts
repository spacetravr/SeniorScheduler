import { describe, it, expect } from "vitest";
import {
  isOpenStatus,
  hasOpenConsentSession,
  shouldScheduleConsentCall,
  isConsentSessionDue,
  OPEN_CALL_STATUSES,
} from "./consent-scheduling";

describe("isOpenStatus", () => {
  it.each(OPEN_CALL_STATUSES)("%s 는 열린 상태", (s) => {
    expect(isOpenStatus(s)).toBe(true);
  });
  it.each(["COMPLETED", "MISSED", "UNKNOWN"])("%s 는 종결/무효 상태", (s) => {
    expect(isOpenStatus(s)).toBe(false);
  });
});

describe("hasOpenConsentSession", () => {
  it("빈 목록이면 열린 세션 없음", () => {
    expect(hasOpenConsentSession([])).toBe(false);
  });
  it("종결 세션만 있으면 열린 세션 없음", () => {
    expect(hasOpenConsentSession([{ status: "COMPLETED" }, { status: "MISSED" }])).toBe(false);
  });
  it("열린 세션이 하나라도 있으면 true", () => {
    expect(hasOpenConsentSession([{ status: "MISSED" }, { status: "SCHEDULED" }])).toBe(true);
    expect(hasOpenConsentSession([{ status: "IN_PROGRESS" }])).toBe(true);
  });
});

describe("shouldScheduleConsentCall", () => {
  const consentedNotSelf = {
    consent_at: "2026-07-15T00:00:00+09:00",
    self_consent_at: null,
  };

  it("대리동의 있음 + 본인동의 없음 + 열린 세션 없음 → 예약", () => {
    expect(shouldScheduleConsentCall(consentedNotSelf, [])).toBe(true);
    expect(shouldScheduleConsentCall(consentedNotSelf, [{ status: "MISSED" }])).toBe(true);
  });

  it("이미 열린 CONSENT 세션이 있으면 예약 안 함(중복 방지)", () => {
    expect(shouldScheduleConsentCall(consentedNotSelf, [{ status: "SCHEDULED" }])).toBe(false);
    expect(shouldScheduleConsentCall(consentedNotSelf, [{ status: "IN_PROGRESS" }])).toBe(false);
  });

  it("대리동의가 없으면 예약 안 함", () => {
    expect(
      shouldScheduleConsentCall({ consent_at: null, self_consent_at: null }, []),
    ).toBe(false);
  });

  it("이미 본인동의를 받았으면 예약 안 함", () => {
    expect(
      shouldScheduleConsentCall(
        { consent_at: "2026-07-15T00:00:00+09:00", self_consent_at: "2026-07-15T01:00:00+09:00" },
        [],
      ),
    ).toBe(false);
  });
});

describe("isConsentSessionDue", () => {
  const now = new Date("2026-07-15T03:00:00.000Z");

  it("SCHEDULED 이고 예정 시각이 지났으면 due", () => {
    expect(
      isConsentSessionDue({ status: "SCHEDULED", scheduled_at: "2026-07-15T02:59:00.000Z" }, now),
    ).toBe(true);
  });

  it("예정 시각이 정확히 now 면 due(경계 포함)", () => {
    expect(
      isConsentSessionDue({ status: "SCHEDULED", scheduled_at: now.toISOString() }, now),
    ).toBe(true);
  });

  it("예정 시각이 미래면 아직 아님", () => {
    expect(
      isConsentSessionDue({ status: "SCHEDULED", scheduled_at: "2026-07-15T03:05:00.000Z" }, now),
    ).toBe(false);
  });

  it("SCHEDULED 가 아니면(진행/종결) due 아님", () => {
    for (const status of ["IN_PROGRESS", "COMPLETED", "MISSED", "DIALING"]) {
      expect(
        isConsentSessionDue({ status, scheduled_at: "2026-07-15T02:00:00.000Z" }, now),
      ).toBe(false);
    }
  });
});
