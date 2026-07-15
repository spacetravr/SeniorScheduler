import { describe, it, expect } from "vitest";
import { getConfiguredProvider, resolveClawOpsConfig, selectTelephony } from "./provider";

const FULL: Record<string, string | undefined> = {
  TELEPHONY_PROVIDER: "clawops",
  CLAWOPS_API_KEY: "sk",
  CLAWOPS_ACCOUNT_ID: "AC1",
  CLAWOPS_FROM_NUMBER: "070-5275-3827",
  TELEPHONY_CALLBACK_SECRET: "secret",
  NEXT_PUBLIC_SITE_URL: "https://voice.test",
};

describe("getConfiguredProvider — clawops", () => {
  it("clawops(대소문자·공백 무관) 인식", () => {
    expect(getConfiguredProvider("clawops")).toBe("clawops");
    expect(getConfiguredProvider(" ClawOps ")).toBe("clawops");
  });
  it("mock/clova 는 그대로", () => {
    expect(getConfiguredProvider("clova")).toBe("clova");
    expect(getConfiguredProvider("mock")).toBe("mock");
  });
});

describe("resolveClawOpsConfig", () => {
  it("필수 완비 → ok + 기본 단가", () => {
    const r = resolveClawOpsConfig(FULL);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.fromNumber).toBe("070-5275-3827");
      expect(r.config.costPerMinKrw).toBe(60);
      expect(r.config.transcriptPerMinKrw).toBe(10);
      expect(r.config.apiBaseUrl).toBeUndefined();
    }
  });
  it("단가 env 오버라이드", () => {
    const r = resolveClawOpsConfig({
      ...FULL,
      CLAWOPS_COST_PER_MIN_KRW: "88",
      CLAWOPS_TRANSCRIPT_PER_MIN_KRW: "5",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.costPerMinKrw).toBe(88);
      expect(r.config.transcriptPerMinKrw).toBe(5);
    }
  });
  it("누락 키가 있으면 ok:false + missing", () => {
    const r = resolveClawOpsConfig({ ...FULL, CLAWOPS_API_KEY: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toContain("CLAWOPS_API_KEY");
  });
  it("SITE_URL/콜백시크릿 누락도 필수로 취급", () => {
    const r = resolveClawOpsConfig({ ...FULL, NEXT_PUBLIC_SITE_URL: "  ", TELEPHONY_CALLBACK_SECRET: undefined });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.missing).toContain("NEXT_PUBLIC_SITE_URL");
      expect(r.missing).toContain("TELEPHONY_CALLBACK_SECRET");
    }
  });
});

describe("selectTelephony — clawops", () => {
  it("완비 → ok async + triggerCall 지원 어댑터", () => {
    const sel = selectTelephony(FULL);
    expect(sel.ok).toBe(true);
    if (sel.ok) {
      expect(sel.provider).toBe("clawops");
      expect(sel.mode).toBe("async");
      expect(typeof sel.adapter.triggerCall).toBe("function");
    }
  });
  it("미비 → ok:false(missing_config) — 조용한 mock 폴백 금지", () => {
    const sel = selectTelephony({ TELEPHONY_PROVIDER: "clawops" });
    expect(sel.ok).toBe(false);
    if (!sel.ok) {
      expect(sel.provider).toBe("clawops");
      expect(sel.reason).toBe("missing_config");
      expect(sel.missing.length).toBeGreaterThan(0);
    }
  });
});
