import { describe, it, expect } from "vitest";
import { ZodError } from "zod";
import {
  telephonyCallbackEventSchema,
  genericCallbackParser,
  clovaCallbackParser,
  getCallbackParser,
} from "./callback";

const VALID = {
  session_id: "11111111-1111-1111-1111-111111111111",
  event: "COMPLETED",
  turns: [
    { role: "SYSTEM", input_kind: "VOICE", text: "안녕하세요", at: "2026-07-15T09:00:00+09:00" },
    { role: "SENIOR", input_kind: "DTMF", text: "1", at: "2026-07-15T09:00:05+09:00" },
  ],
  duration_sec: 12,
  cost_krw: 45,
};

describe("telephonyCallbackEventSchema — 유효 페이로드", () => {
  it("전체 필드 통과", () => {
    const p = telephonyCallbackEventSchema.parse(VALID);
    expect(p.event).toBe("COMPLETED");
    expect(p.turns).toHaveLength(2);
    expect(p.cost_krw).toBe(45);
  });
  it("turns 미제공 시 빈 배열 기본값", () => {
    const p = telephonyCallbackEventSchema.parse({
      session_id: VALID.session_id,
      event: "NO_ANSWER",
    });
    expect(p.turns).toEqual([]);
    expect(p.cost_krw).toBeUndefined();
  });
});

describe("telephonyCallbackEventSchema — 4xx 검증 대상(거부)", () => {
  it("session_id 가 uuid 아니면 거부", () => {
    expect(() => telephonyCallbackEventSchema.parse({ ...VALID, session_id: "nope" })).toThrow(
      ZodError,
    );
  });
  it("알 수 없는 event 거부", () => {
    expect(() => telephonyCallbackEventSchema.parse({ ...VALID, event: "BUSY" })).toThrow(ZodError);
  });
  it("turn.at 이 datetime 아니면 거부", () => {
    const bad = { ...VALID, turns: [{ role: "SENIOR", input_kind: "VOICE", text: "x", at: "어제" }] };
    expect(() => telephonyCallbackEventSchema.parse(bad)).toThrow(ZodError);
  });
  it("음수 cost_krw 거부", () => {
    expect(() => telephonyCallbackEventSchema.parse({ ...VALID, cost_krw: -1 })).toThrow(ZodError);
  });
});

describe("파서 선택", () => {
  it("generic 파서는 중립 계약을 그대로 검증", () => {
    expect(genericCallbackParser(VALID).session_id).toBe(VALID.session_id);
  });
  it("getCallbackParser: mock/generic/미지정은 generic", () => {
    expect(getCallbackParser("mock")).toBe(genericCallbackParser);
    expect(getCallbackParser("generic")).toBe(genericCallbackParser);
    expect(getCallbackParser("unknown")).toBe(genericCallbackParser);
  });
  it("getCallbackParser('clova')는 clova 파서(미구현)", () => {
    expect(getCallbackParser("clova")).toBe(clovaCallbackParser);
    expect(() => clovaCallbackParser(VALID)).toThrow(); // 스펙 확정 전 명시적 실패
  });
});
