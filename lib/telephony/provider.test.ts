import { describe, it, expect } from "vitest";
import { getConfiguredProvider, resolveClovaConfig, selectTelephony } from "./provider";

const FULL_CLOVA: Record<string, string | undefined> = {
  TELEPHONY_PROVIDER: "clova",
  CLOVA_API_KEY_ID: "id",
  CLOVA_API_KEY: "secret",
  CLOVA_CONTACT_CENTER_ID: "cc",
  CLOVA_AGENT_ID: "agent",
  CLOVA_CALLER_NUMBER: "0212345678",
};

describe("getConfiguredProvider", () => {
  it("기본은 mock", () => {
    expect(getConfiguredProvider(undefined)).toBe("mock");
    expect(getConfiguredProvider("")).toBe("mock");
  });
  it("clova(대소문자·공백 무관) 인식", () => {
    expect(getConfiguredProvider("clova")).toBe("clova");
    expect(getConfiguredProvider(" CLOVA ")).toBe("clova");
  });
  it("미지원 값은 mock 으로 안전 강등", () => {
    expect(getConfiguredProvider("twilio")).toBe("mock");
  });
});

describe("resolveClovaConfig", () => {
  it("모든 CLOVA_* 있으면 ok + config", () => {
    const r = resolveClovaConfig(FULL_CLOVA);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.callerNumber).toBe("0212345678");
      expect(r.config.apiBaseUrl).toBeUndefined();
    }
  });
  it("누락 키가 있으면 ok:false + missing 목록", () => {
    const r = resolveClovaConfig({ ...FULL_CLOVA, CLOVA_API_KEY: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toContain("CLOVA_API_KEY");
  });
  it("공백만 있는 값도 누락으로 취급", () => {
    const r = resolveClovaConfig({ ...FULL_CLOVA, CLOVA_CALLER_NUMBER: "   " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toEqual(["CLOVA_CALLER_NUMBER"]);
  });
});

describe("selectTelephony", () => {
  it("mock provider → ok sync + adapter", () => {
    const sel = selectTelephony({ TELEPHONY_PROVIDER: "mock" });
    expect(sel.ok).toBe(true);
    if (sel.ok) {
      expect(sel.provider).toBe("mock");
      expect(sel.mode).toBe("sync");
    }
  });
  it("clova + 설정 완비 → ok async", () => {
    const sel = selectTelephony(FULL_CLOVA);
    expect(sel.ok).toBe(true);
    if (sel.ok) {
      expect(sel.provider).toBe("clova");
      expect(sel.mode).toBe("async");
      // 실벤더 어댑터는 비동기 트리거를 지원해야 함.
      expect(typeof sel.adapter.triggerCall).toBe("function");
    }
  });
  it("clova + 설정 미비 → ok:false(missing_config) — 조용한 mock 폴백 금지", () => {
    const sel = selectTelephony({ TELEPHONY_PROVIDER: "clova" });
    expect(sel.ok).toBe(false);
    if (!sel.ok) {
      expect(sel.provider).toBe("clova");
      expect(sel.reason).toBe("missing_config");
      expect(sel.missing.length).toBeGreaterThan(0);
    }
  });
});
