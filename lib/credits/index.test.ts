import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  shouldDeductForCall,
  sumDeltas,
  ensureSignupGrant,
  getCreditBalance,
  deductForCall,
} from "./index";
import { CREDIT_SIGNUP_GRANT } from "@/lib/contracts/credits";

// ── DB mock: credit_ledger 부분 unique(0009) + seniors 조회를 흉내낸 인메모리 클라이언트 ──
type LedgerRow = {
  guardian_id: string;
  delta: number;
  reason: string;
  call_session_id: string | null;
};

class FakeStore {
  ledger: LedgerRow[] = [];
  seniors = new Map<string, string>(); // senior_id → guardian_id

  insert(table: string, payload: LedgerRow): { error: { code: string } | null } {
    if (table !== "credit_ledger") return { error: null };
    // 부분 unique 1: guardian 당 SIGNUP_GRANT 1건.
    if (
      payload.reason === "SIGNUP_GRANT" &&
      this.ledger.some((r) => r.reason === "SIGNUP_GRANT" && r.guardian_id === payload.guardian_id)
    ) {
      return { error: { code: "23505" } };
    }
    // 부분 unique 2: 세션당 CALL_DEDUCT 1건.
    if (
      payload.reason === "CALL_DEDUCT" &&
      this.ledger.some(
        (r) => r.reason === "CALL_DEDUCT" && r.call_session_id === payload.call_session_id,
      )
    ) {
      return { error: { code: "23505" } };
    }
    this.ledger.push(payload);
    return { error: null };
  }

  single(table: string, filters: Record<string, unknown>) {
    if (table === "seniors") {
      const gid = this.seniors.get(filters.id as string);
      return gid
        ? { data: { guardian_id: gid }, error: null }
        : { data: null, error: { code: "PGRST116", message: "not found" } };
    }
    return { data: null, error: null };
  }

  list(table: string, filters: Record<string, unknown>) {
    if (table === "credit_ledger") {
      const rows = this.ledger
        .filter((r) => r.guardian_id === filters.guardian_id)
        .map((r) => ({ delta: r.delta }));
      return { data: rows, error: null };
    }
    return { data: [], error: null };
  }
}

class TableQuery {
  private filters: Record<string, unknown> = {};
  constructor(
    private store: FakeStore,
    private table: string,
  ) {}
  insert(payload: LedgerRow) {
    return Promise.resolve(this.store.insert(this.table, payload));
  }
  select(_cols?: string) {
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters[col] = val;
    return this;
  }
  single() {
    return Promise.resolve(this.store.single(this.table, this.filters));
  }
  // select().eq() 를 await 하면(단건 아님) list 로 종결.
  then<T>(onF: (v: { data: unknown; error: unknown }) => T) {
    return Promise.resolve(this.store.list(this.table, this.filters)).then(onF);
  }
}

function makeClient(store: FakeStore): SupabaseClient {
  return { from: (table: string) => new TableQuery(store, table) } as unknown as SupabaseClient;
}

const G = "11111111-1111-1111-1111-111111111111"; // guardian
const S = "22222222-2222-2222-2222-222222222222"; // senior
const SESS = "33333333-3333-3333-3333-333333333333"; // session

let store: FakeStore;
let client: SupabaseClient;

beforeEach(() => {
  store = new FakeStore();
  store.seniors.set(S, G);
  client = makeClient(store);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

// ── 순수 규칙 ────────────────────────────────────────────────────────────────
describe("shouldDeductForCall — SCHEDULE·COMPLETED 만 차감", () => {
  it("SCHEDULE + COMPLETED → true", () => {
    expect(shouldDeductForCall({ purpose: "SCHEDULE", status: "COMPLETED" })).toBe(true);
  });
  it("CONSENT + COMPLETED → false", () => {
    expect(shouldDeductForCall({ purpose: "CONSENT", status: "COMPLETED" })).toBe(false);
  });
  it("SCHEDULE + MISSED → false", () => {
    expect(shouldDeductForCall({ purpose: "SCHEDULE", status: "MISSED" })).toBe(false);
  });
  it("SCHEDULE + IN_PROGRESS → false", () => {
    expect(shouldDeductForCall({ purpose: "SCHEDULE", status: "IN_PROGRESS" })).toBe(false);
  });
});

describe("sumDeltas — 잔액 합산", () => {
  it("빈 원장 = 0", () => {
    expect(sumDeltas([])).toBe(0);
  });
  it("적립+차감 합산", () => {
    expect(sumDeltas([{ delta: 120 }, { delta: -1 }, { delta: -1 }])).toBe(118);
  });
  it("null delta 는 0 취급", () => {
    expect(sumDeltas([{ delta: 120 }, { delta: null }])).toBe(120);
  });
});

// ── 가입 보너스 멱등 ──────────────────────────────────────────────────────────
describe("ensureSignupGrant / getCreditBalance — 가입 보너스 멱등", () => {
  it("첫 조회 시 보너스 120 지연 적립", async () => {
    expect(await getCreditBalance(G, client)).toBe(CREDIT_SIGNUP_GRANT);
    expect(store.ledger.filter((r) => r.reason === "SIGNUP_GRANT")).toHaveLength(1);
  });

  it("반복 호출해도 보너스는 1회만(멱등)", async () => {
    await ensureSignupGrant(G, client);
    await ensureSignupGrant(G, client);
    await getCreditBalance(G, client);
    expect(store.ledger.filter((r) => r.reason === "SIGNUP_GRANT")).toHaveLength(1);
    expect(await getCreditBalance(G, client)).toBe(CREDIT_SIGNUP_GRANT);
  });
});

// ── 차감 규칙 ─────────────────────────────────────────────────────────────────
describe("deductForCall — 차감 규칙(SCHEDULE·COMPLETED 만)", () => {
  it("SCHEDULE + COMPLETED → -1 기록 + guardian 해석", async () => {
    await deductForCall({ id: SESS, purpose: "SCHEDULE", status: "COMPLETED", senior_id: S }, client);
    const deducts = store.ledger.filter((r) => r.reason === "CALL_DEDUCT");
    expect(deducts).toHaveLength(1);
    expect(deducts[0]).toMatchObject({ guardian_id: G, delta: -1, call_session_id: SESS });
  });

  it("CONSENT 콜은 무차감", async () => {
    await deductForCall({ id: SESS, purpose: "CONSENT", status: "COMPLETED", senior_id: S }, client);
    expect(store.ledger.filter((r) => r.reason === "CALL_DEDUCT")).toHaveLength(0);
  });

  it("MISSED 는 무차감", async () => {
    await deductForCall({ id: SESS, purpose: "SCHEDULE", status: "MISSED", senior_id: S }, client);
    expect(store.ledger.filter((r) => r.reason === "CALL_DEDUCT")).toHaveLength(0);
  });

  it("senior 조회 실패해도 throw 하지 않음(파이프라인 보호)", async () => {
    await expect(
      deductForCall(
        { id: SESS, purpose: "SCHEDULE", status: "COMPLETED", senior_id: "unknown" },
        client,
      ),
    ).resolves.toBeUndefined();
    expect(store.ledger.filter((r) => r.reason === "CALL_DEDUCT")).toHaveLength(0);
  });
});

// ── 중복 차감 멱등 ────────────────────────────────────────────────────────────
describe("deductForCall — 중복 차감 멱등(세션당 1건)", () => {
  it("같은 세션 2회 호출해도 -1 한 번만", async () => {
    const s = { id: SESS, purpose: "SCHEDULE", status: "COMPLETED", senior_id: S };
    await deductForCall(s, client);
    await deductForCall(s, client);
    expect(store.ledger.filter((r) => r.reason === "CALL_DEDUCT")).toHaveLength(1);
  });

  it("잔액에 반영: 120 - 1 = 119 (중복 차감돼도 동일)", async () => {
    const s = { id: SESS, purpose: "SCHEDULE", status: "COMPLETED", senior_id: S };
    await getCreditBalance(G, client); // 보너스 적립
    await deductForCall(s, client);
    await deductForCall(s, client); // 멱등 무시
    expect(await getCreditBalance(G, client)).toBe(CREDIT_SIGNUP_GRANT - 1);
  });
});
