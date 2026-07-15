import { describe, it, expect, vi } from "vitest";
import {
  ClawOpsAdapter,
  signSessionToken,
  verifySessionToken,
  toE164Kr,
  computeCallCostKrw,
  transcriptSegmentsToTurns,
  type ClawOpsConfig,
} from "./clawops-adapter";

const CONFIG: ClawOpsConfig = {
  apiKey: "sk_test",
  accountId: "AC123",
  fromNumber: "070-5275-3827",
  siteUrl: "https://voice.test",
  callbackSecret: "supersecret",
  costPerMinKrw: 60,
  transcriptPerMinKrw: 10,
};

// fetch Response 헬퍼(실네트워크 0 — 전부 모킹).
function jsonRes(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

const noSleep = async () => {};

describe("signSessionToken / verifySessionToken", () => {
  it("동일 세션·시크릿이면 검증 통과, 변조되면 실패", () => {
    const t = signSessionToken("sess-1", "supersecret");
    expect(t).toHaveLength(32);
    expect(verifySessionToken("sess-1", t, "supersecret")).toBe(true);
    expect(verifySessionToken("sess-1", t, "other")).toBe(false);
    expect(verifySessionToken("sess-2", t, "supersecret")).toBe(false);
    expect(verifySessionToken("sess-1", "deadbeef", "supersecret")).toBe(false);
    expect(verifySessionToken("sess-1", "", "supersecret")).toBe(false);
  });
});

describe("toE164Kr", () => {
  it("국내 로컬 → +82 정규화", () => {
    expect(toE164Kr("010-1234-5678")).toBe("+821012345678");
    expect(toE164Kr("070-5275-3827")).toBe("+827052753827");
    expect(toE164Kr("+82 10 1234 5678")).toBe("+821012345678");
    expect(toE164Kr("821012345678")).toBe("+821012345678");
  });
});

describe("computeCallCostKrw", () => {
  it("분 올림 과금(최소 1분), 전사 포함 여부 반영", () => {
    // 30초 → 1분: 회선 60 (+전사 10)
    expect(computeCallCostKrw(30, { costPerMinKrw: 60, transcriptPerMinKrw: 10, includeTranscript: false })).toBe(60);
    expect(computeCallCostKrw(30, { costPerMinKrw: 60, transcriptPerMinKrw: 10, includeTranscript: true })).toBe(70);
    // 61초 → 2분: (60+10)*2 = 140
    expect(computeCallCostKrw(61, { costPerMinKrw: 60, transcriptPerMinKrw: 10, includeTranscript: true })).toBe(140);
    // 0초 → 최소 1분
    expect(computeCallCostKrw(0, { costPerMinKrw: 60, transcriptPerMinKrw: 10, includeTranscript: false })).toBe(60);
  });
});

describe("transcriptSegmentsToTurns", () => {
  it("SENIOR 자유 발화만 추출(우리 멘트/agent 제외, 빈 텍스트 제외)", () => {
    const turns = transcriptSegmentsToTurns(
      [
        { speaker: "agent", text: "안녕하세요" },
        { speaker: "callee", text: "약 먹었어요" },
        { speaker: "customer", text: "" },
        { speaker: "customer", text: "기분 좋아요" },
      ],
      "2026-07-16T09:00:00.000Z",
    );
    // agent 제외, callee/customer 중 "caller|outbound|agent|system"에 안 걸리는 것만.
    expect(turns.map((t) => t.text)).toEqual(["약 먹었어요", "기분 좋아요"]);
    expect(turns.every((t) => t.role === "SENIOR" && t.input_kind === "VOICE")).toBe(true);
    expect(turns[0].at).toBe("2026-07-16T09:00:00.000Z");
  });
});

describe("ClawOpsAdapter.triggerCall", () => {
  it("POST calls: Bearer 인증 + To/From E.164 + VoiceML/StatusCallback URL(토큰 포함) + MachineDetection Hangup", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonRes({ CallId: "CA_abc" }));
    const adapter = new ClawOpsAdapter(CONFIG, fetchMock as unknown as typeof fetch, noSleep);

    const res = await adapter.triggerCall({
      sessionId: "sess-1",
      seniorId: "senior-1",
      to: "010-1234-5678",
      purpose: "SCHEDULE",
    });

    expect(res.providerCallId).toBe("CA_abc");
    const [urlArg, init] = fetchMock.mock.calls[0];
    expect(urlArg).toBe("https://api.claw-ops.com/v1/accounts/AC123/calls");
    expect(init!.method).toBe("POST");
    expect(init!.headers).toMatchObject({ Authorization: "Bearer sk_test" });
    const body = JSON.parse(init!.body as string);
    expect(body.To).toBe("+821012345678");
    expect(body.From).toBe("+827052753827");
    expect(body.MachineDetection).toBe("Hangup");
    expect(body.Url).toContain("/api/telephony/voiceml?session=sess-1&token=");
    expect(body.Url).toContain("step=intro");
    expect(body.StatusCallback).toContain("/api/telephony/callback?session=sess-1&token=");
    // URL 토큰이 세션 토큰과 일치.
    const token = signSessionToken("sess-1", CONFIG.callbackSecret);
    expect(body.Url).toContain(`token=${token}`);
  });

  it("HTTP 실패 시 throw(가짜 성공 기록 방지)", async () => {
    const fetchMock = vi.fn(async () => jsonRes({}, false, 500));
    const adapter = new ClawOpsAdapter(CONFIG, fetchMock as unknown as typeof fetch, noSleep);
    await expect(
      adapter.triggerCall({ sessionId: "s", seniorId: "x", to: "010-1111-2222", purpose: "CONSENT" }),
    ).rejects.toThrow();
  });

  it("apiBaseUrl 오버라이드 반영", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonRes({ CallId: "CA_1" }));
    const adapter = new ClawOpsAdapter(
      { ...CONFIG, apiBaseUrl: "https://staging.claw-ops.com/" },
      fetchMock as unknown as typeof fetch,
      noSleep,
    );
    await adapter.triggerCall({ sessionId: "s", seniorId: "x", to: "010-1", purpose: "SCHEDULE" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://staging.claw-ops.com/v1/accounts/AC123/calls");
  });
});

describe("ClawOpsAdapter.fetchTranscript", () => {
  it("POST 요청 후 GET 준비되면 SENIOR 턴 반환", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") return jsonRes({ status: "processing" });
      return jsonRes({ status: "completed", segments: [{ speaker: "callee", text: "먹었어요" }] });
    });
    const adapter = new ClawOpsAdapter(CONFIG, fetchMock as unknown as typeof fetch, noSleep);
    const turns = await adapter.fetchTranscript("CA_abc", "2026-07-16T00:00:00.000Z");
    expect(turns).toHaveLength(1);
    expect(turns[0]).toMatchObject({ role: "SENIOR", input_kind: "VOICE", text: "먹었어요" });
  });

  it("준비 안 되면 재시도 소진 후 빈 배열(DTMF만으로 진행)", async () => {
    const fetchMock = vi.fn(async () => jsonRes({ status: "processing" }));
    const adapter = new ClawOpsAdapter(CONFIG, fetchMock as unknown as typeof fetch, noSleep);
    const turns = await adapter.fetchTranscript("CA_abc", "2026-07-16T00:00:00.000Z", {
      attempts: 2,
      intervalMs: 1,
    });
    expect(turns).toEqual([]);
  });

  it("GET 에러여도 throw 하지 않고 빈 배열", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network");
    });
    const adapter = new ClawOpsAdapter(CONFIG, fetchMock as unknown as typeof fetch, noSleep);
    const turns = await adapter.fetchTranscript("CA_abc", "2026-07-16T00:00:00.000Z", { attempts: 1 });
    expect(turns).toEqual([]);
  });
});

describe("ClawOpsAdapter.costKrw / initiateCall", () => {
  it("costKrw: 단가·전사 반영", () => {
    const adapter = new ClawOpsAdapter(CONFIG);
    expect(adapter.costKrw(30, false)).toBe(60);
    expect(adapter.costKrw(30, true)).toBe(70);
  });
  it("동기 initiateCall 은 미지원(throw)", async () => {
    const adapter = new ClawOpsAdapter(CONFIG);
    await expect(
      adapter.initiateCall(
        { sessionId: "s", seniorId: "x", to: "010", purpose: "SCHEDULE", runScript: async () => {} },
        () => new Date(),
      ),
    ).rejects.toThrow();
  });
});
