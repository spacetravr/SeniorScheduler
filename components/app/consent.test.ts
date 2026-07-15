import { describe, it, expect } from "vitest";
import { getConsentStatus, consentStatusLabel } from "./consent";

const T = "2026-07-01T10:00:00+09:00";

describe("getConsentStatus", () => {
  it("대리동의(consent_at)가 없으면 NONE → '동의 필요'", () => {
    const status = getConsentStatus({ consent_at: null, self_consent_at: null });
    expect(status).toBe("NONE");
    expect(consentStatusLabel[status]).toBe("동의 필요");
  });

  it("대리동의만 있고 본인 동의가 없으면 SELF_PENDING → '본인 동의 대기'", () => {
    const status = getConsentStatus({ consent_at: T, self_consent_at: null });
    expect(status).toBe("SELF_PENDING");
    expect(consentStatusLabel[status]).toBe("본인 동의 대기");
  });

  it("self_consent_at 가 undefined(컬럼 미존재)여도 SELF_PENDING 으로 안전 처리", () => {
    // 실 DB에 컬럼이 없어 undefined 로 올 수 있음
    const status = getConsentStatus({
      consent_at: T,
      self_consent_at: undefined as unknown as string | null,
    });
    expect(status).toBe("SELF_PENDING");
  });

  it("대리동의·본인 동의 둘 다 있으면 DONE → '동의 완료'", () => {
    const status = getConsentStatus({ consent_at: T, self_consent_at: T });
    expect(status).toBe("DONE");
    expect(consentStatusLabel[status]).toBe("동의 완료");
  });
});
