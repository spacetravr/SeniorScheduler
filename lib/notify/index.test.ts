import { describe, expect, it, vi } from "vitest";
import { shouldNotify, routeNotify, parseNotifyLevel } from "@/lib/notify";
import { NOTIFY_LEVELS, type NotifyAdapter, type NotifyResult } from "@/lib/contracts/notify";
import { DIGEST_TONES } from "@/lib/contracts/report-view";

/** 발송 여부 전수 매트릭스 (레벨 3 × 톤 3 × 종류 2 = 18칸). */
describe("shouldNotify — EXCEPTION_ALERT", () => {
  const cases: Array<[level: (typeof NOTIFY_LEVELS)[number], tone: (typeof DIGEST_TONES)[number], expected: boolean]> = [
    ["ALL", "CALM", false],
    ["ALL", "ATTENTION", true],
    ["ALL", "ALERT", true],
    ["EXCEPTION", "CALM", false],
    ["EXCEPTION", "ATTENTION", false],
    ["EXCEPTION", "ALERT", true],
    ["WEEKLY_ONLY", "CALM", false],
    ["WEEKLY_ONLY", "ATTENTION", false],
    ["WEEKLY_ONLY", "ALERT", false],
  ];

  for (const [level, tone, expected] of cases) {
    it(`${level} × ${tone} → ${expected ? "발송" : "미발송"}`, () => {
      expect(shouldNotify("EXCEPTION_ALERT", level, tone)).toBe(expected);
    });
  }

  it("CALM 은 어떤 레벨에서도 보내지 않는다 (정상은 조용히)", () => {
    for (const level of NOTIFY_LEVELS) {
      expect(shouldNotify("EXCEPTION_ALERT", level, "CALM")).toBe(false);
    }
  });
});

describe("shouldNotify — WEEKLY_DIGEST", () => {
  it("레벨·톤과 무관하게 항상 발송 대상 (수신 동의로만 통제)", () => {
    for (const level of NOTIFY_LEVELS) {
      for (const tone of DIGEST_TONES) {
        expect(shouldNotify("WEEKLY_DIGEST", level, tone)).toBe(true);
      }
    }
  });
});

/** 테스트용 어댑터. */
function fakeAdapter(over: Partial<NotifyAdapter> & { channel?: "EMAIL" | "ALIMTALK" } = {}): NotifyAdapter {
  return {
    channel: over.channel ?? "EMAIL",
    isEnabled: over.isEnabled ?? (() => true),
    send:
      over.send ??
      (async (): Promise<NotifyResult> => ({ channel: over.channel ?? "EMAIL", status: "sent" })),
  };
}

const baseInput = {
  kind: "EXCEPTION_ALERT" as const,
  level: "EXCEPTION" as const,
  tone: "ALERT" as const,
  recipients: { EMAIL: "a@b.test" },
  subject: "제목",
  text: "본문",
};

describe("routeNotify", () => {
  it("판정에서 걸리면 어댑터를 호출하지 않고 빈 배열", async () => {
    const send = vi.fn();
    const res = await routeNotify({ ...baseInput, tone: "CALM" }, [fakeAdapter({ send })]);
    expect(res).toEqual([]);
    expect(send).not.toHaveBeenCalled();
  });

  it("발송 대상이면 활성 어댑터로 전달한다", async () => {
    const res = await routeNotify(baseInput, [fakeAdapter()]);
    expect(res).toEqual([{ channel: "EMAIL", status: "sent" }]);
  });

  it("비활성 어댑터는 skipped(adapter_disabled)", async () => {
    const res = await routeNotify(baseInput, [fakeAdapter({ isEnabled: () => false })]);
    expect(res[0]).toEqual({ channel: "EMAIL", status: "skipped", reason: "adapter_disabled" });
  });

  it("해당 채널 수신자가 없으면 skipped(no_recipient)", async () => {
    const res = await routeNotify({ ...baseInput, recipients: { EMAIL: null } }, [fakeAdapter()]);
    expect(res[0]).toEqual({ channel: "EMAIL", status: "skipped", reason: "no_recipient" });
  });

  it("어댑터가 throw 해도 라우터는 throw 하지 않고 failed 로 강등한다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await routeNotify(baseInput, [
      fakeAdapter({
        send: async () => {
          throw new Error("boom");
        },
      }),
    ]);
    expect(res[0]).toEqual({ channel: "EMAIL", status: "failed", reason: "adapter_threw" });
    vi.restoreAllMocks();
  });

  it("reason 에 PII(이메일 주소)를 담지 않는다", async () => {
    const res = await routeNotify({ ...baseInput, recipients: { EMAIL: null } }, [fakeAdapter()]);
    for (const r of res) expect(r.reason ?? "").not.toContain("@");
  });

  it("여러 채널을 각각 처리한다", async () => {
    const res = await routeNotify(
      { ...baseInput, recipients: { EMAIL: "a@b.test", ALIMTALK: "01000000000" } },
      [
        fakeAdapter({ channel: "EMAIL" }),
        fakeAdapter({
          channel: "ALIMTALK",
          send: async () => ({ channel: "ALIMTALK", status: "skipped", reason: "vendor_not_implemented" }),
        }),
      ],
    );
    expect(res.map((r) => r.channel)).toEqual(["EMAIL", "ALIMTALK"]);
    expect(res[1].status).toBe("skipped");
  });
});

describe("parseNotifyLevel", () => {
  it("알 수 없는 값은 기본값(EXCEPTION)으로 강등", () => {
    expect(parseNotifyLevel(undefined)).toBe("EXCEPTION");
    expect(parseNotifyLevel("NOPE")).toBe("EXCEPTION");
    expect(parseNotifyLevel(null)).toBe("EXCEPTION");
  });
  it("유효한 값은 그대로", () => {
    expect(parseNotifyLevel("ALL")).toBe("ALL");
    expect(parseNotifyLevel("WEEKLY_ONLY")).toBe("WEEKLY_ONLY");
  });
});
