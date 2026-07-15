import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Senior, Schedule } from "@/lib/contracts/domain";
import type { GeneratedReport } from "@/lib/ai/report";
import { getAdminClient } from "@/lib/supabase/admin";
import { createLlmClient } from "@/lib/ai/llm";
import { getConfiguredProvider, resolveClawOpsConfig } from "@/lib/telephony/provider";
import {
  getCallbackParser,
  clawopsCallbackParser,
  ClawopsIgnorableStatusError,
  type CallbackTurn,
  type TelephonyCallbackPayload,
} from "@/lib/telephony/callback";
import { ClawOpsAdapter, verifySessionToken } from "@/lib/telephony/clawops-adapter";
import {
  processCallback,
  type CallbackStore,
  type CallbackSessionRow,
  type SessionPatch,
} from "@/lib/telephony/callback-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/telephony/callback — 실벤더 비동기 결과 수신부 (CLAUDE.md `## 전화 발신`).
 *
 * 실벤더는 발신 트리거 후 통화 결과를 콜백으로 보낸다. 이 라우트가 벤더별 원시 페이로드를
 * 중립 계약(lib/telephony/callback)으로 파싱하고, 상태 기계·재시도·멱등 규칙(callback-handler)
 * 으로 call_sessions 를 갱신하며, COMPLETED 면 기존 분류·리포트 로직(lib/calls)을 재사용한다.
 *
 * 인증: Authorization: Bearer ${TELEPHONY_CALLBACK_SECRET} (디스패치 CRON_SECRET 과 동일 패턴).
 *   - TELEPHONY_CALLBACK_SECRET 미설정 시 라우트 비활성(503) — 무인증 노출 방지.
 *   - 서버 write 는 admin(secret key, RLS 우회). PII(전사 텍스트) 미로깅.
 */

/** Supabase admin 백엔드로 CallbackStore 구현. */
function createSupabaseStore(supabase: SupabaseClient = getAdminClient()): CallbackStore {
  return {
    async getSession(sessionId): Promise<CallbackSessionRow | null> {
      const { data, error } = await supabase
        .from("call_sessions")
        .select("id, purpose, schedule_id, senior_id, status, attempt")
        .eq("id", sessionId)
        .maybeSingle();
      if (error) {
        console.error("[callback] getSession:", error.code, error.message);
        return null;
      }
      return (data as CallbackSessionRow | null) ?? null;
    },
    async getSenior(seniorId): Promise<Senior | null> {
      const { data, error } = await supabase
        .from("seniors")
        .select(
          "id, name, phone, relationship, birth_year, consent_at, consent_by, self_consent_at, created_at",
        )
        .eq("id", seniorId)
        .maybeSingle();
      if (error) {
        console.error("[callback] getSenior:", error.code, error.message);
        return null;
      }
      return (data as Senior | null) ?? null;
    },
    async getSchedule(scheduleId): Promise<Schedule | null> {
      const { data, error } = await supabase
        .from("schedules")
        .select("id, senior_id, type, title, script_template, call_time, rrule, active, created_at")
        .eq("id", scheduleId)
        .maybeSingle();
      if (error) {
        console.error("[callback] getSchedule:", error.code, error.message);
        return null;
      }
      return (data as Schedule | null) ?? null;
    },
    async updateSession(sessionId, patch: SessionPatch): Promise<void> {
      const { error } = await supabase.from("call_sessions").update(patch).eq("id", sessionId);
      if (error) console.error("[callback] updateSession:", error.code, error.message);
    },
    async insertTurns(sessionId, turns: readonly CallbackTurn[]): Promise<void> {
      if (turns.length === 0) return;
      const { error } = await supabase.from("call_turns").insert(
        turns.map((t) => ({
          session_id: sessionId,
          role: t.role,
          input_kind: t.input_kind,
          text: t.text,
          created_at: t.at,
        })),
      );
      if (error) console.error("[callback] insertTurns:", error.code, error.message);
    },
    async reportExists(sessionId): Promise<boolean> {
      const { data, error } = await supabase
        .from("call_reports")
        .select("id")
        .eq("session_id", sessionId)
        .maybeSingle();
      if (error) {
        console.error("[callback] reportExists:", error.code, error.message);
        return true; // 조회 실패 시 보수적으로 "있음" 처리 → 이중 리포트 생성 방지.
      }
      return data != null;
    },
    async insertReport(sessionId, report: GeneratedReport): Promise<void> {
      const { error } = await supabase.from("call_reports").insert({
        session_id: sessionId,
        adherence_status: report.adherence_status,
        summary: report.summary,
        mood_flag: report.mood_flag,
        health_flag: report.health_flag,
        prompt_version: report.prompt_version,
      });
      // unique(session_id) 경합(중복 콜백 동시 처리)은 23505 — 정상(이미 기록됨)으로 취급.
      if (error && error.code !== "23505") {
        console.error("[callback] insertReport:", error.code, error.message);
      }
    },
    async setSelfConsent(seniorId, atIso): Promise<void> {
      const { error } = await supabase
        .from("seniors")
        .update({ self_consent_at: atIso })
        .eq("id", seniorId);
      if (error) console.error("[callback] setSelfConsent:", error.code, error.message);
    },
    async getExistingTurns(sessionId): Promise<CallbackTurn[]> {
      const { data, error } = await supabase
        .from("call_turns")
        .select("role, input_kind, text, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      if (error) {
        console.error("[callback] getExistingTurns:", error.code, error.message);
        return [];
      }
      return (data ?? []).map((t) => ({
        role: t.role as "SYSTEM" | "SENIOR",
        input_kind: t.input_kind as "VOICE" | "DTMF",
        text: (t.text as string) ?? "",
        at: t.created_at as string,
      }));
    },
  };
}

export async function POST(req: Request) {
  const secret = process.env.TELEPHONY_CALLBACK_SECRET;
  if (!secret) {
    // 시크릿 미설정 → 무인증 콜백 수신 위험 → 라우트 비활성.
    console.error("[callback] TELEPHONY_CALLBACK_SECRET 미설정 — 라우트 비활성");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const provider = getConfiguredProvider();
  if (provider === "clawops") return handleClawops(req, secret);

  // ── generic/clova: Authorization Bearer 인증 + JSON 바디 ──────────────────────
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // 벤더별 파서로 원시 페이로드 → 중립 계약. 검증 실패 시 4xx.
  const parser = getCallbackParser(provider);
  let payload;
  try {
    payload = parser(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "invalid_payload", issues: err.issues }, { status: 400 });
    }
    // clova 파서 미구현 등 — 501(미구현)로 명시.
    console.error("[callback] parser:", err instanceof Error ? err.name : "error");
    return NextResponse.json({ error: "parser_unavailable" }, { status: 501 });
  }

  const result = await processCallback(payload, {
    store: createSupabaseStore(),
    llm: createLlmClient(),
    now: new Date(),
  });

  if (result.status === "not_found") {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }
  // ignored(멱등)·ok 모두 200 — 벤더 재전송을 유발하지 않도록 성공 응답.
  return NextResponse.json(result, { status: 200 });
}

/** ClawOps StatusCallback 바디(form/json) → 평문 객체. */
async function readClawopsBody(req: Request): Promise<Record<string, unknown>> {
  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) {
      return (await req.json()) as Record<string, unknown>;
    }
    const form = await req.formData();
    const obj: Record<string, unknown> = {};
    for (const [k, v] of form.entries()) obj[k] = typeof v === "string" ? v : "";
    return obj;
  } catch {
    return {};
  }
}

/**
 * ClawOps 상태 웹훅 처리.
 *
 * 인증: StatusCallback URL 은 우리가 구성했으므로(쿼리 session+token) 자체 토큰으로 검증한다.
 *   TODO(E2E): 벤더 X-Signature 스킴 확정 시 벤더 서명 검증 추가.
 * 세션 상관: 1차는 쿼리 session, 없으면 CallId→provider_call_id 역조회(0006 컬럼).
 * COMPLETED: transcript API 로 전사 확보(best-effort) → call_turns 보강 후 DTMF+전사로 분류.
 *   전사 미준비면 DTMF 턴만으로 진행(DTMF 우선 원칙). cost = 단가×duration(+전사) + LLM.
 */
async function handleClawops(req: Request, secret: string): Promise<NextResponse> {
  const url = new URL(req.url);
  const querySession = url.searchParams.get("session");
  const token = url.searchParams.get("token") ?? "";

  const body = await readClawopsBody(req);
  const callId = typeof body.CallId === "string" ? body.CallId : null;

  const supabase = getAdminClient();

  // 세션 식별: 쿼리 session 우선, 없으면 CallId 역조회.
  let sessionId = querySession;
  if (!sessionId && callId) {
    const { data } = await supabase
      .from("call_sessions")
      .select("id")
      .eq("provider_call_id", callId)
      .maybeSingle();
    sessionId = (data?.id as string | undefined) ?? null;
  }
  if (!sessionId) {
    return NextResponse.json({ error: "session_not_identified" }, { status: 404 });
  }
  // 자체 토큰 인증(URL 쿼리 기반).
  if (!verifySessionToken(sessionId, token, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 원시 → 중립 계약(session_id 주입). 중간 상태는 200 noop.
  let payload: TelephonyCallbackPayload;
  try {
    payload = clawopsCallbackParser({ ...body, session_id: sessionId });
  } catch (err) {
    if (err instanceof ClawopsIgnorableStatusError) {
      return NextResponse.json({ status: "ignored", reason: "intermediate" }, { status: 200 });
    }
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "invalid_payload", issues: err.issues }, { status: 400 });
    }
    console.error("[callback] clawops parser:", err instanceof Error ? err.name : "error");
    return NextResponse.json({ error: "parser_error" }, { status: 400 });
  }

  const store = createSupabaseStore(supabase);

  // COMPLETED: 종결 전(멱등)에만 전사 확보 + 원가 산정.
  if (payload.event === "COMPLETED") {
    const existing = await store.getSession(sessionId);
    // 이미 종결이면 전사/원가 재작업 없이 멱등 처리로 위임.
    if (existing && existing.status !== "COMPLETED" && existing.status !== "MISSED") {
      const cfg = resolveClawOpsConfig();
      let transcriptTurns: CallbackTurn[] = [];
      const durationSec = payload.duration_sec ?? 0;
      if (cfg.ok && callId) {
        const adapter = new ClawOpsAdapter(cfg.config);
        const nowIso = new Date().toISOString();
        try {
          transcriptTurns = await adapter.fetchTranscript(callId, nowIso);
        } catch (e) {
          console.error("[callback] transcript:", e instanceof Error ? e.name : "error");
        }
        if (transcriptTurns.length > 0) {
          await store.insertTurns(sessionId, transcriptTurns);
        }
        payload = {
          ...payload,
          cost_krw: adapter.costKrw(durationSec, transcriptTurns.length > 0),
        };
      }
    }
  }

  const result = await processCallback(payload, {
    store,
    llm: createLlmClient(),
    now: new Date(),
  });

  if (result.status === "not_found") {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }
  return NextResponse.json(result, { status: 200 });
}
