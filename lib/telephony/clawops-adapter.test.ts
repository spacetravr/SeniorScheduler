import { describe, it, expect, vi } from "vitest";
import {
  ClawOpsAdapter,
  signSessionToken,
  verifySessionToken,
  toE164Kr,
  computeCallCostKrw,
  transcriptSegmentsToTurns,
  dedupeTranscriptTurns,
  type ClawOpsConfig,
} from "./clawops-adapter";
import type { CallbackTurn } from "./callback";

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

  it("세그먼트 순서대로 타임스탬프 미세 증가(동률 제거 → splitAtFreeForm 경계 안정)", () => {
    const turns = transcriptSegmentsToTurns(
      [
        { speaker: "callee", text: "약 먹었어요" }, // 일정 확인 응답
        { speaker: "callee", text: "기분은 좋아요" }, // 기분(자유 발화)
        { speaker: "callee", text: "오늘 산책했어요" }, // 일상(자유 발화)
      ],
      "2026-07-16T09:00:00.000Z",
    );
    const times = turns.map((t) => t.at);
    // 발화 순서 보존 — 엄격히 증가(동률 없음).
    expect(times).toEqual([
      "2026-07-16T09:00:00.000Z",
      "2026-07-16T09:00:00.001Z",
      "2026-07-16T09:00:00.002Z",
    ]);
    for (let i = 1; i < times.length; i++) {
      expect(Date.parse(times[i])).toBeGreaterThan(Date.parse(times[i - 1]));
    }
  });

  it("atIso 파싱 불가 시 방어적으로 원본 atIso 사용", () => {
    const turns = transcriptSegmentsToTurns([{ speaker: "callee", text: "네" }], "not-a-date");
    expect(turns[0].at).toBe("not-a-date");
  });
});

describe("dedupeTranscriptTurns — 실시간 Gather 저장 발화와 전사 중복 제거", () => {
  const s = (text: string, at = "2026-07-16T09:00:00.000Z"): CallbackTurn => ({
    role: "SENIOR",
    input_kind: "VOICE",
    text,
    at,
  });

  it("이미 저장된 SENIOR 발화와 텍스트가 같은 전사 턴은 버린다(공백·대소문자 무시)", () => {
    const existing: CallbackTurn[] = [
      { role: "SYSTEM", input_kind: "VOICE", text: "오늘 기분은 좀 어떠세요?", at: "2026-07-16T09:00:00.000Z" },
      s("기분은 좋아요"), // 실시간 Gather 로 저장됨
    ];
    const transcript: CallbackTurn[] = [
      s("  기분은   좋아요  "), // 같은 발화(공백만 다름) → 중복
      s("오늘 산책했어요"), // 새 발화 → 유지
    ];
    const out = dedupeTranscriptTurns(transcript, existing);
    expect(out.map((t) => t.text)).toEqual(["오늘 산책했어요"]);
  });

  it("SYSTEM 턴 텍스트와 겹쳐도 SENIOR 만 dedup 기준(전사 SENIOR 발화 보존)", () => {
    const existing: CallbackTurn[] = [
      { role: "SYSTEM", input_kind: "VOICE", text: "오늘 산책했어요", at: "2026-07-16T09:00:00.000Z" },
    ];
    const out = dedupeTranscriptTurns([s("오늘 산책했어요")], existing);
    // SYSTEM 멘트와 우연히 같아도 SENIOR 발화는 유지(SENIOR 기준으로만 중복 판단).
    expect(out.map((t) => t.text)).toEqual(["오늘 산책했어요"]);
  });

  it("전사 내부 중복도 1회로 접는다", () => {
    const out = dedupeTranscriptTurns([s("네 먹었어요"), s("네 먹었어요")], []);
    expect(out.map((t) => t.text)).toEqual(["네 먹었어요"]);
  });

  it("speech 미지원(실시간 SENIOR 턴 없음)이면 전사가 그대로 보강된다", () => {
    const existing: CallbackTurn[] = [
      { role: "SYSTEM", input_kind: "VOICE", text: "오늘 기분은 좀 어떠세요?", at: "2026-07-16T09:00:00.000Z" },
    ];
    const transcript = [s("기분 좋아요"), s("산책했어요")];
    const out = dedupeTranscriptTurns(transcript, existing);
    expect(out.map((t) => t.text)).toEqual(["기분 좋아요", "산책했어요"]);
  });
});

describe("ClawOpsAdapter.triggerCall", () => {
  it("POST calls: Bearer 인증 + To E.164/From 등록형식 그대로 + VoiceML/StatusCallback URL(토큰 포함) + MachineDetection Hangup", async () => {
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
    expect(body.From).toBe("070-5275-3827");
    expect(body.MachineDetection).toBe("Hangup");
    // 녹음 미저장(녹음 정책) — 벤더 측 자동 녹음 비활성 시도. 효과는 실콜에서 검증 예정.
    expect(body.Record).toBe(false);
    expect(body.Url).toContain("/api/telephony/voiceml?session=sess-1&token=");
    expect(body.Url).toContain("step=intro");
    expect(body.StatusCallback).toContain("/api/telephony/callback?session=sess-1&token=");
    // URL 토큰이 세션 토큰과 일치.
    const token = signSessionToken("sess-1", CONFIG.callbackSecret);
    expect(body.Url).toContain(`token=${token}`);
  });

  it("실응답 camelCase callId 도 providerCallId 로 파싱 (2026-07-16 실콜 확인)", async () => {
    const fetchMock = vi.fn(async () => jsonRes({ callId: "CA_real", status: "queued" }));
    const adapter = new ClawOpsAdapter(CONFIG, fetchMock as unknown as typeof fetch, noSleep);
    const res = await adapter.triggerCall({
      sessionId: "sess-1",
      seniorId: "senior-1",
      to: "010-1234-5678",
      purpose: "SCHEDULE",
    });
    expect(res.providerCallId).toBe("CA_real");
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
