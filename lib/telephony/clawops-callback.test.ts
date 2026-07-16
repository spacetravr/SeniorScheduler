import { describe, it, expect } from "vitest";
import { ZodError } from "zod";
import {
  mapClawopsCallStatus,
  clawopsCallbackParser,
  ClawopsIgnorableStatusError,
  getCallbackParser,
} from "./callback";

const UUID = "11111111-1111-1111-1111-111111111111";

describe("mapClawopsCallStatus — 상태 매핑표", () => {
  it("중간 상태는 null(무시)", () => {
    for (const s of ["", "initiated", "queued", "ringing", "in-progress", "in_progress"]) {
      expect(mapClawopsCallStatus(s)).toBeNull();
    }
  });
  it("answered(사람) → ANSWERED", () => {
    expect(mapClawopsCallStatus("answered", "human")).toBe("ANSWERED");
    expect(mapClawopsCallStatus("answered")).toBe("ANSWERED");
  });
  it("completed(사람) → COMPLETED", () => {
    expect(mapClawopsCallStatus("completed", "human")).toBe("COMPLETED");
    expect(mapClawopsCallStatus("completed")).toBe("COMPLETED");
  });
  it("기계 응답(음성사서함/팩스) → NO_ANSWER(부재)", () => {
    expect(mapClawopsCallStatus("answered", "machine_start")).toBe("NO_ANSWER");
    expect(mapClawopsCallStatus("completed", "machine_end_beep")).toBe("NO_ANSWER");
    expect(mapClawopsCallStatus("completed", "fax")).toBe("NO_ANSWER");
  });
  it('AnsweredBy "unknown"(실콜 관찰값) → human 취급(성사)', () => {
    // MachineDetection 이 사람/기계를 확정 못 한 값. 억지 부재 처리 금지 → 사람으로 진행.
    expect(mapClawopsCallStatus("answered", "unknown")).toBe("ANSWERED");
    expect(mapClawopsCallStatus("completed", "unknown")).toBe("COMPLETED");
    expect(mapClawopsCallStatus("completed", "UNKNOWN")).toBe("COMPLETED");
  });
  it("busy/no-answer 계열 → NO_ANSWER", () => {
    for (const s of ["busy", "no-answer", "no_answer", "noanswer"]) {
      expect(mapClawopsCallStatus(s)).toBe("NO_ANSWER");
    }
  });
  it("failed/canceled → FAILED", () => {
    for (const s of ["failed", "canceled", "cancelled"]) {
      expect(mapClawopsCallStatus(s)).toBe("FAILED");
    }
  });
  it("미지의 종결 상태 → FAILED(재시도 정책에 태움)", () => {
    expect(mapClawopsCallStatus("weird-status")).toBe("FAILED");
  });
});

describe("clawopsCallbackParser — 원시→중립", () => {
  it("completed: session_id 주입 + provider_call_id + duration 매핑, turns 빈 배열", () => {
    const p = clawopsCallbackParser({
      session_id: UUID,
      CallId: "CA_1",
      CallStatus: "completed",
      AnsweredBy: "human",
      CallDuration: 42,
    });
    expect(p.event).toBe("COMPLETED");
    expect(p.session_id).toBe(UUID);
    expect(p.provider_call_id).toBe("CA_1");
    expect(p.duration_sec).toBe(42);
    expect(p.turns).toEqual([]); // 전사는 별도 API 로 확보.
    expect(p.cost_krw).toBeUndefined(); // 라우트가 단가로 주입.
  });

  it("중간 상태(ringing)는 ClawopsIgnorableStatusError", () => {
    expect(() => clawopsCallbackParser({ session_id: UUID, CallStatus: "ringing" })).toThrow(
      ClawopsIgnorableStatusError,
    );
  });

  it("session_id 가 uuid 아니면 ZodError(4xx)", () => {
    expect(() => clawopsCallbackParser({ session_id: "nope", CallStatus: "completed" })).toThrow(
      ZodError,
    );
  });

  it("no-answer 매핑", () => {
    const p = clawopsCallbackParser({ session_id: UUID, CallStatus: "no-answer" });
    expect(p.event).toBe("NO_ANSWER");
  });
});

describe("getCallbackParser('clawops')", () => {
  it("clawops 파서를 반환", () => {
    expect(getCallbackParser("clawops")).toBe(clawopsCallbackParser);
  });
});
