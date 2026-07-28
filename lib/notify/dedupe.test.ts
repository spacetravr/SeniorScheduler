import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseNotifyDedupe, kstYmd, noopNotifyDedupe } from "@/lib/notify/dedupe";
import { routeNotify } from "@/lib/notify";
import type { NotifyAdapter, NotifyResult } from "@/lib/contracts/notify";

/**
 * 하루 1회 발송 상한 테스트.
 * 핵심 관심사: ① 같은 날 두 번째는 skip ② KST 자정 경계에서 다시 발송
 * ③ unique 충돌(23505)이 "이미 보냄" ④ 저장소 장애 시 fail-open(발송을 막지 않음).
 */

// ── 가짜 Supabase: notify_log 한 테이블 + unique(guardian,kind,channel,ymd) 흉내 ──
type Row = {
  id: string;
  guardian_id: string;
  kind: string;
  channel: string;
  ymd: string;
  tone: string | null;
};

function fakeDb(
  opts: {
    /** insert 가 항상 이 에러를 돌려주게(테이블 없음 등) */
    insertError?: { code?: string; message?: string };
    /** insert 가 throw (네트워크 장애) */
    insertThrows?: boolean;
    /** 조회-후-삽입 사이에 다른 프로세스가 먼저 넣은 상황: 첫 insert 를 23505 로 */
    forceConflictOnce?: boolean;
  } = {},
) {
  const rows: Row[] = [];
  let seq = 0;
  let forced = opts.forceConflictOnce ?? false;

  const client = {
    from(table: string) {
      if (table !== "notify_log") throw new Error(`unexpected table: ${table}`);
      return {
        insert(values: Record<string, string | null>) {
          return {
            select(_cols: string) {
              return {
                async single() {
                  if (opts.insertThrows) throw new Error("network down");
                  if (opts.insertError) return { data: null, error: opts.insertError };
                  if (forced) {
                    forced = false;
                    return { data: null, error: { code: "23505", message: "duplicate key" } };
                  }
                  const dup = rows.some(
                    (r) =>
                      r.guardian_id === values.guardian_id &&
                      r.kind === values.kind &&
                      r.channel === values.channel &&
                      r.ymd === values.ymd,
                  );
                  if (dup) return { data: null, error: { code: "23505", message: "duplicate key" } };
                  const row = { id: `row-${++seq}`, ...values } as unknown as Row;
                  rows.push(row);
                  return { data: { id: row.id }, error: null };
                },
              };
            },
          };
        },
        delete() {
          return {
            async eq(col: string, val: string) {
              const i = rows.findIndex((r) => (r as unknown as Record<string, string>)[col] === val);
              if (i >= 0) rows.splice(i, 1);
              return { error: null };
            },
          };
        },
      };
    },
  };

  return { client: client as unknown as SupabaseClient, rows };
}

const GUARDIAN = "11111111-1111-4111-8111-111111111111";

function sendingAdapter(
  result: NotifyResult = { channel: "EMAIL", status: "sent" },
): { adapter: NotifyAdapter; send: ReturnType<typeof vi.fn> } {
  const send = vi.fn(async () => result);
  return {
    adapter: { channel: "EMAIL", isEnabled: () => true, send },
    send,
  };
}

const baseInput = {
  kind: "EXCEPTION_ALERT" as const,
  level: "EXCEPTION" as const,
  tone: "ALERT" as const,
  recipients: { EMAIL: "a@b.test" },
  subject: "제목",
  text: "본문",
  guardianId: GUARDIAN,
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

// ── kstYmd (시간대 규칙 — CLAUDE.md 불변) ──
describe("kstYmd", () => {
  it("KST 기준 달력 날짜를 돌려준다 (UTC 아님)", () => {
    // 2026-07-28T14:59:59Z = 2026-07-28 23:59:59 KST → 아직 28일
    expect(kstYmd(new Date("2026-07-28T14:59:59Z"))).toBe("2026-07-28");
    // 2026-07-28T15:00:00Z = 2026-07-29 00:00:00 KST → 29일
    expect(kstYmd(new Date("2026-07-28T15:00:00Z"))).toBe("2026-07-29");
  });

  it("UTC 자정(09:00 KST)은 날짜가 넘어가지 않는다", () => {
    expect(kstYmd(new Date("2026-07-28T00:00:00Z"))).toBe("2026-07-28");
  });
});

// ── 저장소 단위 ──
describe("createSupabaseNotifyDedupe", () => {
  const key = {
    guardianId: GUARDIAN,
    kind: "EXCEPTION_ALERT" as const,
    channel: "EMAIL" as const,
    ymd: "2026-07-28",
  };

  it("첫 선점은 claimed, 같은 키 두 번째는 already_sent(23505)", async () => {
    const { client } = fakeDb();
    const store = createSupabaseNotifyDedupe(client);
    const first = await store.claim(key);
    expect(first.status).toBe("claimed");
    expect(await store.claim(key)).toEqual({ status: "already_sent" });
  });

  it("채널·종류·날짜가 다르면 각각 따로 센다", async () => {
    const { client } = fakeDb();
    const store = createSupabaseNotifyDedupe(client);
    expect((await store.claim(key)).status).toBe("claimed");
    expect((await store.claim({ ...key, channel: "ALIMTALK" })).status).toBe("claimed");
    expect((await store.claim({ ...key, kind: "WEEKLY_DIGEST" })).status).toBe("claimed");
    expect((await store.claim({ ...key, ymd: "2026-07-29" })).status).toBe("claimed");
  });

  it("release 하면 같은 날 다시 선점할 수 있다(발송 실패 → 재시도 허용)", async () => {
    const { client, rows } = fakeDb();
    const store = createSupabaseNotifyDedupe(client);
    const c = await store.claim(key);
    expect(c.status).toBe("claimed");
    await store.release(c.status === "claimed" ? c.receiptId : null);
    expect(rows).toHaveLength(0);
    expect((await store.claim(key)).status).toBe("claimed");
  });

  it("DB 오류는 unavailable 로 강등한다(throw 금지)", async () => {
    const { client } = fakeDb({ insertError: { code: "42P01", message: "relation does not exist" } });
    const store = createSupabaseNotifyDedupe(client);
    expect(await store.claim(key)).toEqual({ status: "unavailable", reason: "claim_failed" });
  });

  it("클라이언트가 throw 해도 unavailable 로 흡수한다", async () => {
    const { client } = fakeDb({ insertThrows: true });
    const store = createSupabaseNotifyDedupe(client);
    expect((await store.claim(key)).status).toBe("unavailable");
  });

  it("잘못된 키(비 uuid)는 상한을 포기하되 throw 하지 않는다", async () => {
    const { client } = fakeDb();
    const store = createSupabaseNotifyDedupe(client);
    expect(await store.claim({ ...key, guardianId: "not-a-uuid" })).toEqual({
      status: "unavailable",
      reason: "invalid_key",
    });
  });

  it("로그에 PII(수신 주소)를 남기지 않는다 — 저장 컬럼도 메타뿐", async () => {
    const { client, rows } = fakeDb();
    await createSupabaseNotifyDedupe(client).claim({ ...key, tone: "ALERT" });
    expect(Object.keys(rows[0]).sort()).toEqual(
      ["channel", "guardian_id", "id", "kind", "tone", "ymd"].sort(),
    );
  });
});

// ── 라우터 통합 ──
describe("routeNotify — 하루 1회 상한", () => {
  it("같은 날 두 번째 호출은 already_sent_today 로 skip 되고 어댑터를 호출하지 않는다", async () => {
    const { client } = fakeDb();
    const store = createSupabaseNotifyDedupe(client);
    const now = new Date("2026-07-28T10:00:00Z");

    const a1 = sendingAdapter();
    const r1 = await routeNotify({ ...baseInput, now }, [a1.adapter], store);
    expect(r1).toEqual([{ channel: "EMAIL", status: "sent" }]);

    const a2 = sendingAdapter();
    const r2 = await routeNotify(
      { ...baseInput, now: new Date("2026-07-28T13:00:00Z") },
      [a2.adapter],
      store,
    );
    expect(r2).toEqual([{ channel: "EMAIL", status: "skipped", reason: "already_sent_today" }]);
    expect(a2.send).not.toHaveBeenCalled();
  });

  it("KST 자정을 넘기면 다시 발송한다", async () => {
    const { client } = fakeDb();
    const store = createSupabaseNotifyDedupe(client);

    // 23:59 KST (28일)
    const a1 = sendingAdapter();
    await routeNotify({ ...baseInput, now: new Date("2026-07-28T14:59:00Z") }, [a1.adapter], store);
    expect(a1.send).toHaveBeenCalledTimes(1);

    // 00:01 KST (29일) — 같은 UTC 날짜지만 KST 로는 다음 날
    const a2 = sendingAdapter();
    const r2 = await routeNotify(
      { ...baseInput, now: new Date("2026-07-28T15:01:00Z") },
      [a2.adapter],
      store,
    );
    expect(r2).toEqual([{ channel: "EMAIL", status: "sent" }]);
    expect(a2.send).toHaveBeenCalledTimes(1);
  });

  it("선점과 발송 사이 경쟁(23505)은 '이미 보냄'으로 처리하고 중복 발송하지 않는다", async () => {
    // 다른 프로세스가 먼저 같은 키를 넣은 상황을 강제.
    const { client } = fakeDb({ forceConflictOnce: true });
    const store = createSupabaseNotifyDedupe(client);
    const a = sendingAdapter();
    const res = await routeNotify({ ...baseInput, now: new Date() }, [a.adapter], store);
    expect(res).toEqual([{ channel: "EMAIL", status: "skipped", reason: "already_sent_today" }]);
    expect(a.send).not.toHaveBeenCalled();
  });

  it("동시 실행(크론 겹침)에서도 실제 발송은 1회뿐이다", async () => {
    const { client } = fakeDb();
    const store = createSupabaseNotifyDedupe(client);
    const a = sendingAdapter();
    const now = new Date("2026-07-28T10:00:00Z");
    const [r1, r2] = await Promise.all([
      routeNotify({ ...baseInput, now }, [a.adapter], store),
      routeNotify({ ...baseInput, now }, [a.adapter], store),
    ]);
    expect(a.send).toHaveBeenCalledTimes(1);
    const statuses = [r1[0].status, r2[0].status].sort();
    expect(statuses).toEqual(["sent", "skipped"]);
  });

  it("발송이 실패하면 로그를 남기지 않아 다음 시도가 가능하다", async () => {
    const { client, rows } = fakeDb();
    const store = createSupabaseNotifyDedupe(client);
    const now = new Date("2026-07-28T10:00:00Z");

    const failing = sendingAdapter({ channel: "EMAIL", status: "failed", reason: "send_failed" });
    const r1 = await routeNotify({ ...baseInput, now }, [failing.adapter], store);
    expect(r1[0].status).toBe("failed");
    expect(rows).toHaveLength(0);

    const ok = sendingAdapter();
    const r2 = await routeNotify({ ...baseInput, now }, [ok.adapter], store);
    expect(r2).toEqual([{ channel: "EMAIL", status: "sent" }]);
    expect(rows).toHaveLength(1);
  });

  it("어댑터가 throw 해도 로그를 남기지 않는다(다음 시도 가능)", async () => {
    const { client, rows } = fakeDb();
    const store = createSupabaseNotifyDedupe(client);
    const thrower: NotifyAdapter = {
      channel: "EMAIL",
      isEnabled: () => true,
      send: async () => {
        throw new Error("boom");
      },
    };
    const res = await routeNotify({ ...baseInput, now: new Date() }, [thrower], store);
    expect(res[0]).toEqual({ channel: "EMAIL", status: "failed", reason: "adapter_threw" });
    expect(rows).toHaveLength(0);
  });

  it("저장소 장애(fail-open): 상한 조회가 실패해도 발송을 막지 않는다", async () => {
    const { client } = fakeDb({ insertError: { code: "42P01" } });
    const store = createSupabaseNotifyDedupe(client);
    const a1 = sendingAdapter();
    const a2 = sendingAdapter();
    const now = new Date("2026-07-28T10:00:00Z");
    expect(await routeNotify({ ...baseInput, now }, [a1.adapter], store)).toEqual([
      { channel: "EMAIL", status: "sent" },
    ]);
    expect(await routeNotify({ ...baseInput, now }, [a2.adapter], store)).toEqual([
      { channel: "EMAIL", status: "sent" },
    ]);
  });

  it("guardianId 가 없으면 상한을 걸지 않는다(기존 호출부 무변경 보장)", async () => {
    const { client, rows } = fakeDb();
    const store = createSupabaseNotifyDedupe(client);
    const { guardianId: _omit, ...noGuardian } = baseInput;
    const a1 = sendingAdapter();
    const a2 = sendingAdapter();
    await routeNotify(noGuardian, [a1.adapter], store);
    await routeNotify(noGuardian, [a2.adapter], store);
    expect(a1.send).toHaveBeenCalledTimes(1);
    expect(a2.send).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(0);
  });

  it("기본 저장소(noop)는 상한 없이 통과시킨다", async () => {
    expect((await noopNotifyDedupe.claim({
      guardianId: GUARDIAN,
      kind: "WEEKLY_DIGEST",
      channel: "EMAIL",
      ymd: "2026-07-28",
    })).status).toBe("unavailable");
    await expect(noopNotifyDedupe.release("x")).resolves.toBeUndefined();
  });

  it("채널별로 따로 센다 — EMAIL 상한이 ALIMTALK 를 막지 않는다", async () => {
    const { client } = fakeDb();
    const store = createSupabaseNotifyDedupe(client);
    const now = new Date("2026-07-28T10:00:00Z");
    const email: NotifyAdapter = {
      channel: "EMAIL",
      isEnabled: () => true,
      send: async () => ({ channel: "EMAIL", status: "sent" }),
    };
    const talkSend = vi.fn(async (): Promise<NotifyResult> => ({ channel: "ALIMTALK", status: "sent" }));
    const talk: NotifyAdapter = { channel: "ALIMTALK", isEnabled: () => true, send: talkSend };
    const input = {
      ...baseInput,
      now,
      recipients: { EMAIL: "a@b.test", ALIMTALK: "01000000000" },
    };

    await routeNotify(input, [email], store); // EMAIL 만 소진
    const res = await routeNotify(input, [email, talk], store);
    expect(res[0]).toEqual({ channel: "EMAIL", status: "skipped", reason: "already_sent_today" });
    expect(res[1]).toEqual({ channel: "ALIMTALK", status: "sent" });
    expect(talkSend).toHaveBeenCalledTimes(1);
  });

  it("skip 사유에 PII 를 담지 않는다", async () => {
    const { client } = fakeDb();
    const store = createSupabaseNotifyDedupe(client);
    const now = new Date();
    await routeNotify({ ...baseInput, now }, [sendingAdapter().adapter], store);
    const res = await routeNotify({ ...baseInput, now }, [sendingAdapter().adapter], store);
    expect(res[0].reason).toBe("already_sent_today");
    expect(res[0].reason ?? "").not.toContain("@");
  });
});
