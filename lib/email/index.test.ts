import { describe, it, expect, vi, afterEach } from "vitest";
import {
  selectEmailBackend,
  ResendAdapter,
  DisabledAdapter,
} from "./index";

const msg = { to: "a@b.test", subject: "제목", text: "본문" };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("selectEmailBackend", () => {
  it("RESEND_API_KEY 있으면 ResendAdapter 를 반환한다", () => {
    expect(selectEmailBackend("re_key", undefined)).toBeInstanceOf(ResendAdapter);
  });

  it("키가 없으면 DisabledAdapter 를 반환한다", () => {
    expect(selectEmailBackend(undefined, undefined)).toBeInstanceOf(DisabledAdapter);
  });
});

describe("DisabledAdapter", () => {
  it("발송을 skip 하고 {ok:true, skipped:true} 를 반환한다(throw 금지)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await new DisabledAdapter().send(msg);
    expect(r).toEqual({ ok: true, skipped: true });
  });
});

describe("ResendAdapter", () => {
  it("200 응답이면 {ok:true} — Resend 엔드포인트로 POST 한다", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
    const r = await new ResendAdapter("re_key", "from@x.test").send(msg);
    expect(r).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init as RequestInit).method).toBe("POST");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.from).toBe("from@x.test");
    expect(body.to).toBe("a@b.test");
  });

  it("비2xx 는 {ok:false} 로 강등한다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 422 }));
    const r = await new ResendAdapter("re_key").send(msg);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("422");
  });

  it("네트워크 오류는 throw 하지 않고 {ok:false} 로 강등한다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("boom"));
    const r = await new ResendAdapter("re_key").send(msg);
    expect(r.ok).toBe(false);
  });
});
