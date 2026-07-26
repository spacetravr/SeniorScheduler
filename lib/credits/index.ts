import type { SupabaseClient } from "@supabase/supabase-js";
import { CREDIT_SIGNUP_GRANT } from "@/lib/contracts/credits";

/**
 * 크레딧 원장(credit_ledger) 쓰기/합산 로직 (베타 — 표시용, 발신 차단 없음).
 *
 * - 모든 write 는 admin 클라이언트(secret key, RLS 우회) 전용 — call_sessions 0003 패턴.
 * - 멱등은 DB partial unique index(0009)로 보장하고, 여기서는 충돌(23505)을 조용히 무시한다.
 * - **차감 실패가 통화 파이프라인을 죽이면 안 된다**: deductForCall 은 어떤 오류도 throw 하지
 *   않고 로그 후 통과한다(오케스트레이터 지시).
 *
 * 테스트를 위해 client 는 마지막 인자로 주입 가능(기본값 getAdminClient()). DB 는 mock 으로 대체.
 */

const DUP_KEY = "23505"; // Postgres unique_violation — 멱등 정상 케이스.

/**
 * admin 클라이언트를 **지연** 해석한다. lib/supabase/admin 은 `server-only` 를 import 하므로
 * 정적 import 하면 유닛 테스트(vitest)에서 로드가 깨진다. 테스트는 항상 client 를 주입하므로
 * 이 동적 import 는 실행되지 않는다(프로덕션 호출만 admin 로드).
 */
async function resolveClient(client?: SupabaseClient): Promise<SupabaseClient> {
  if (client) return client;
  const { getAdminClient } = await import("@/lib/supabase/admin");
  return getAdminClient();
}

/** 차감 대상 세션(형태만 필요 — dispatch 결과·콜백 세션행 모두 수용). */
export type CreditDeductSession = {
  id: string;
  purpose: string;
  status: string;
  senior_id: string;
};

/** 차감 규칙(순수): SCHEDULE 콜이 COMPLETED 로 확정된 경우에만 -1. CONSENT·MISSED 무차감. */
export function shouldDeductForCall(session: {
  purpose: string;
  status: string;
}): boolean {
  return session.purpose === "SCHEDULE" && session.status === "COMPLETED";
}

/** delta 합산(순수) — 잔액 계산 단일 지점. */
export function sumDeltas(rows: readonly { delta: number | null }[]): number {
  return rows.reduce((sum, r) => sum + Number(r.delta ?? 0), 0);
}

/**
 * 가입 보너스(SIGNUP_GRANT +120) 1회 적립. 이미 있으면(부분 unique 충돌) 무시 — 경합 안전.
 * 잔액 조회의 지연 초기화 지점(첫 조회 시 보너스 보장).
 */
export async function ensureSignupGrant(
  guardianId: string,
  clientArg?: SupabaseClient,
): Promise<void> {
  const client = await resolveClient(clientArg);
  const { error } = await client.from("credit_ledger").insert({
    guardian_id: guardianId,
    delta: CREDIT_SIGNUP_GRANT,
    reason: "SIGNUP_GRANT",
    call_session_id: null,
  });
  // 부분 unique(guardian 당 SIGNUP_GRANT 1건) 충돌 = 이미 적립됨(정상).
  if (error && error.code !== DUP_KEY) {
    console.error("[credits] signup grant:", error.code, error.message);
  }
}

/** 로그인 guardian 의 크레딧 잔액. 조회 전 가입 보너스를 보장(지연 초기화). 오류 시 0. */
export async function getCreditBalance(
  guardianId: string,
  clientArg?: SupabaseClient,
): Promise<number> {
  const client = await resolveClient(clientArg);
  await ensureSignupGrant(guardianId, client);

  const { data, error } = await client
    .from("credit_ledger")
    .select("delta")
    .eq("guardian_id", guardianId);
  if (error) {
    console.error("[credits] balance:", error.code, error.message);
    return 0;
  }
  return sumDeltas((data ?? []) as { delta: number | null }[]);
}

/**
 * COMPLETED 된 SCHEDULE 콜 1건당 -1 차감(CALL_DEDUCT). 멱등: call_session_id partial unique 로
 * 중복 차감 방지(충돌 무시). **실패해도 throw 하지 않는다** — 로그 후 통과(통화 파이프라인 보호).
 * mock(dispatch) 경로와 텔레포니 콜백 경로가 각자의 persist 직후 호출한다.
 */
export async function deductForCall(
  session: CreditDeductSession,
  clientArg?: SupabaseClient,
): Promise<void> {
  try {
    if (!shouldDeductForCall(session)) return;
    const client = await resolveClient(clientArg);

    // guardian_id 해석: senior → guardian(비정규화 없이 seniors 경유).
    const { data: senior, error: sErr } = await client
      .from("seniors")
      .select("guardian_id")
      .eq("id", session.senior_id)
      .single();
    if (sErr || !senior) {
      console.error("[credits] deduct senior load:", sErr?.code, sErr?.message);
      return;
    }

    const { error } = await client.from("credit_ledger").insert({
      guardian_id: (senior as { guardian_id: string }).guardian_id,
      delta: -1,
      reason: "CALL_DEDUCT",
      call_session_id: session.id,
    });
    // 세션당 CALL_DEDUCT 1건 부분 unique 충돌 = 이미 차감됨(정상, 멱등).
    if (error && error.code !== DUP_KEY) {
      console.error("[credits] deduct insert:", error.code, error.message);
    }
  } catch (e) {
    // 어떤 예외도 통화 파이프라인으로 전파하지 않는다.
    console.error("[credits] deduct unexpected:", e instanceof Error ? e.name : "error");
  }
}
