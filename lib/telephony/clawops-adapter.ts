import { createHmac, timingSafeEqual } from "node:crypto";
import {
  TelephonyNotConfiguredError,
  type Clock,
  type CallResult,
  type InitiateCallParams,
  type TelephonyAdapter,
  type TriggerCallParams,
  type TriggerCallResult,
} from "./types";
import type { CallbackTurn } from "./callback";

/**
 * ClawOpsAdapter — ClawOps(국내 전화 API, Twilio 호환) 실벤더 어댑터.
 *
 * ── 확정 스펙(2026-07-16, 오케스트레이터 검증 완료) ──
 *   - Base `https://api.claw-ops.com`, 인증 `Authorization: Bearer ${CLAWOPS_API_KEY}`.
 *   - 계정 경로 `/v1/accounts/${CLAWOPS_ACCOUNT_ID}`.
 *   - 발신: POST `.../calls` JSON { To, From, Url, StatusCallback, StatusCallbackEvent,
 *     Timeout(초), MachineDetection } → Call 객체(CallId "CA..." 형식).
 *   - 전사: POST `.../calls/{callId}/transcript`(요청) / GET 동일 경로(비동기 생성) →
 *     { status, segments:[{speaker, text}] }.
 *   - 상태 웹훅: StatusCallback URL 로 POST, { CallId, CallStatus, AnsweredBy }.
 *
 * ── 개발 중 실발신 금지 ──
 * 이 파일은 HTTP 요청을 **구성만** 한다. 실제 발신 검증(E2E)은 오케스트레이터가 사용자와
 * 별도 수행한다. 유닛 테스트는 fetch 를 전부 모킹한다(실네트워크 0).
 *
 * ── VoiceML 호환 가정 ──
 * Url 이 반환할 VoiceML 은 TwiML 호환으로 가정한다(lib/telephony/voiceml.ts 참조). 호환
 * 가정은 실콜 E2E 에서 검증 예정.
 *
 * ── 녹음 정책 ──
 * 전사(transcript)만 저장한다. 녹음 파일은 다운로드·저장하지 않는다. ClawOps 측 자동 녹음
 * 비활성화 옵션은 미확인 — docs/telephony.md 확인 항목.
 *
 * ── 서명 검증 TODO ──
 * 웹훅 X-Signature 헤더의 서명 스킴이 미문서화 상태다. 당장은 우리가 구성한 URL 쿼리의
 * 자체 토큰(HMAC(TELEPHONY_CALLBACK_SECRET, sessionId))으로 콜백/VoiceML 요청을 인증한다.
 * TODO(E2E): X-Signature 스킴 확인 후 벤더 서명 검증을 추가한다.
 */

/** ClawOps 발신에 필요한 필수 env 키 목록 — provider.ts 설정 검증의 단일 소스. */
export const CLAWOPS_ENV_KEYS = [
  "CLAWOPS_API_KEY",
  "CLAWOPS_ACCOUNT_ID",
  "CLAWOPS_FROM_NUMBER",
  "TELEPHONY_CALLBACK_SECRET",
  "NEXT_PUBLIC_SITE_URL",
] as const;

export type ClawOpsConfig = {
  apiKey: string;
  accountId: string;
  /** 등록된 발신번호(070-5275-3827). E.164 로 정규화해 From 에 사용. */
  fromNumber: string;
  /** URL 구성 기준(https://도메인). VoiceML·StatusCallback 절대 URL 생성. */
  siteUrl: string;
  /** 콜백/VoiceML 자체 토큰(HMAC) 시크릿. */
  callbackSecret: string;
  /** API 베이스 오버라이드(미지정 시 https://api.claw-ops.com). */
  apiBaseUrl?: string;
  /** 회선 분당 단가(KRW). 기본 60. */
  costPerMinKrw: number;
  /** 전사 분당 단가(KRW). 기본 10. */
  transcriptPerMinKrw: number;
};

/** 링잉 타임아웃(초) — 이 시간 내 미응답이면 벤더가 no-answer 콜백. 재시도(1분/10분)와 조화. */
export const CLAWOPS_RING_TIMEOUT_SEC = 30;

const DEFAULT_BASE = "https://api.claw-ops.com";

// ── 자체 토큰(HMAC) — VoiceML/콜백 URL 쿼리 인증 ────────────────────────────────
// 마스터 시크릿을 URL 에 직접 노출하지 않도록 세션별 파생 토큰을 쓴다(벤더에 URL 이 전달됨).

/** sessionId → 세션별 토큰(HMAC-SHA256 hex 32자). */
export function signSessionToken(sessionId: string, secret: string): string {
  return createHmac("sha256", secret).update(sessionId).digest("hex").slice(0, 32);
}

/** 토큰 검증(타이밍 안전 비교). 불일치/형식 오류면 false. */
export function verifySessionToken(sessionId: string, token: string, secret: string): boolean {
  const expected = signSessionToken(sessionId, secret);
  if (typeof token !== "string" || token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ── 전화번호 정규화(국내 → E.164) ───────────────────────────────────────────────
/** "010-1234-5678" → "+821012345678". 이미 +로 시작하면 숫자만 유지. */
export function toE164Kr(local: string): string {
  const trimmed = local.trim();
  if (trimmed.startsWith("+")) return "+" + trimmed.slice(1).replace(/\D/g, "");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("82")) return "+" + digits;
  if (digits.startsWith("0")) return "+82" + digits.slice(1);
  return "+82" + digits;
}

// ── 통화 원가 산정 ──────────────────────────────────────────────────────────────
/**
 * duration(초) → 회선(+전사) 원가(KRW). 분 단위 올림 과금(최소 1분).
 * LLM 비용은 처리 계층(classifyAndReportSchedule)이 별도 합산한다.
 */
export function computeCallCostKrw(
  durationSec: number,
  opts: { costPerMinKrw: number; transcriptPerMinKrw: number; includeTranscript: boolean },
): number {
  const minutes = Math.max(1, Math.ceil((durationSec || 0) / 60));
  const perMin = opts.costPerMinKrw + (opts.includeTranscript ? opts.transcriptPerMinKrw : 0);
  return Math.round(minutes * perMin * 100) / 100;
}

// ── 전사 세그먼트 → 중립 턴 ──────────────────────────────────────────────────────
/**
 * ClawOps transcript segments → SENIOR VOICE 턴.
 *
 * VoiceML 이 이미 SYSTEM 멘트·SENIOR DTMF 턴을 저장하므로, 전사에서는 **피보호자 자유 발화**
 * (SENIOR VOICE)만 뽑아 보강한다(SYSTEM 멘트 중복 저장 방지). speaker 라벨 규약은 미확정 —
 * agent/system/bot 계열이 아니면 SENIOR 로 간주한다(TODO: E2E 에서 speaker 라벨 확정).
 *
 * ── 세그먼트 순서 보존(2026-07-16) ──
 * 전사 세그먼트는 발화 순서(일정 확인 답 → 기분 → 일상…)를 담지만, 콜백 시점 단일 atIso 를
 * 모든 턴에 그대로 부여하면 created_at 이 동률이 되어 splitAtFreeForm 의 시간순 경계 분리가
 * 흔들릴 수 있다. 따라서 세그먼트 순서대로 밀리초를 미세 증가시켜 순서를 안정적으로 보존한다
 * (동률 제거 → 자유-발화 경계가 결정적). atIso 파싱 불가 시엔 그대로 atIso 사용(방어적).
 */
export function transcriptSegmentsToTurns(
  segments: Array<{ speaker?: string; text?: string }>,
  atIso: string,
): CallbackTurn[] {
  const baseMs = Date.parse(atIso);
  const turns: CallbackTurn[] = [];
  let seq = 0;
  for (const seg of segments ?? []) {
    const text = (seg.text ?? "").trim();
    if (text === "") continue;
    const speaker = (seg.speaker ?? "").toLowerCase();
    const isAgent = /agent|system|bot|ivr|caller|outbound/.test(speaker);
    if (isAgent) continue; // 우리 멘트는 VoiceML 에서 이미 기록됨.
    const at = Number.isFinite(baseMs) ? new Date(baseMs + seq).toISOString() : atIso;
    turns.push({ role: "SENIOR", input_kind: "VOICE", text, at });
    seq++;
  }
  return turns;
}

/** dedup 비교용 정규화 — 공백 접기 + 트림 + 소문자(전사·인식 표기 흔들림 흡수). */
function normalizeTurnText(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * 콜백 전사 턴을 이미 저장된(실시간 Gather) 턴과 대조해 중복을 제거한다.
 *
 * 적응형 Gather(2026-07-16) 도입으로 기분·일상 발화가 실시간 SpeechResult 로 SENIOR/VOICE 턴에
 * 이미 저장될 수 있다. 통화 후 ClawOps 전사가 같은 발화를 다시 실어오면 중복 삽입되므로, 기존
 * SENIOR 턴 텍스트(정규화)와 일치하는 전사 턴은 버린다. 전사 내부 중복도 1회로 접는다.
 * (벤더가 speech 미지원이면 실시간 SENIOR/VOICE 턴이 없으므로 전사가 그대로 보강된다.)
 */
export function dedupeTranscriptTurns(
  transcript: readonly CallbackTurn[],
  existing: readonly CallbackTurn[],
): CallbackTurn[] {
  const seen = new Set(
    existing.filter((t) => t.role === "SENIOR").map((t) => normalizeTurnText(t.text)),
  );
  const out: CallbackTurn[] = [];
  for (const t of transcript) {
    const key = normalizeTurnText(t.text);
    if (key === "" || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

type FetchImpl = typeof fetch;
type SleepImpl = (ms: number) => Promise<void>;

const realSleep: SleepImpl = (ms) => new Promise((r) => setTimeout(r, ms));

export class ClawOpsAdapter implements TelephonyAdapter {
  private readonly base: string;
  private readonly accountBase: string;

  constructor(
    private readonly config: ClawOpsConfig,
    private readonly fetchImpl: FetchImpl = fetch,
    private readonly sleep: SleepImpl = realSleep,
  ) {
    this.base = (config.apiBaseUrl?.trim() || DEFAULT_BASE).replace(/\/$/, "");
    this.accountBase = `${this.base}/v1/accounts/${config.accountId}`;
  }

  /** 동기 대화-드라이버 모델은 실벤더 비동기 모델에 해당하지 않는다. */
  async initiateCall(_params: InitiateCallParams, _clock: Clock): Promise<CallResult> {
    throw new TelephonyNotConfiguredError(
      "ClawOpsAdapter 는 동기 initiateCall 을 지원하지 않습니다. 비동기 triggerCall + 콜백을 사용하세요.",
    );
  }

  /** VoiceML(통화 연결 시 재생) 라우트 URL — 세션 식별 + 자체 토큰 쿼리 포함. */
  private voicemlUrl(sessionId: string): string {
    const token = signSessionToken(sessionId, this.config.callbackSecret);
    const site = this.config.siteUrl.replace(/\/$/, "");
    return `${site}/api/telephony/voiceml?session=${encodeURIComponent(sessionId)}&token=${token}&step=intro`;
  }

  /** 상태 웹훅(StatusCallback) 라우트 URL — 세션 식별 + 자체 토큰 쿼리 포함. */
  private statusCallbackUrl(sessionId: string): string {
    const token = signSessionToken(sessionId, this.config.callbackSecret);
    const site = this.config.siteUrl.replace(/\/$/, "");
    return `${site}/api/telephony/callback?session=${encodeURIComponent(sessionId)}&token=${token}`;
  }

  /**
   * 비동기 발신 트리거. POST calls 로 1건 발신 요청 후 CallId 반환.
   * MachineDetection: "Hangup" — 음성사서함(기계 응답)이면 통화를 끊어 부재(NO_ANSWER)로 처리.
   * 전화번호·멘트 원문은 로깅하지 않는다(가드레일 PII).
   */
  async triggerCall(params: TriggerCallParams): Promise<TriggerCallResult> {
    const body = {
      To: toE164Kr(params.to),
      From: toE164Kr(this.config.fromNumber),
      Url: this.voicemlUrl(params.sessionId),
      StatusCallback: this.statusCallbackUrl(params.sessionId),
      StatusCallbackEvent: "initiated ringing answered completed",
      Timeout: CLAWOPS_RING_TIMEOUT_SEC,
      MachineDetection: "Hangup" as const,
    };

    const res = await this.fetchImpl(`${this.accountBase}/calls`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!res.ok) {
      // 상태코드만 로깅(응답 본문에 PII 가능 — 미로깅).
      throw new TelephonyNotConfiguredError(`ClawOps 발신 실패: HTTP ${res.status}`);
    }

    const json = (await res.json().catch(() => null)) as { CallId?: string } | null;
    const providerCallId = typeof json?.CallId === "string" ? json.CallId : null;
    return { providerCallId };
  }

  /**
   * 전사 확보(best-effort). POST transcript(생성 요청) → 짧은 재시도로 GET.
   * 준비 안 됐으면 빈 배열 반환(호출자는 DTMF 턴만으로 분류 진행 — DTMF 우선 원칙).
   *
   * @param atIso 전사 턴에 부여할 타임스탬프(콜백 완료 시각, ISO instant).
   */
  async fetchTranscript(
    callId: string,
    atIso: string,
    opts: { attempts?: number; intervalMs?: number } = {},
  ): Promise<CallbackTurn[]> {
    const attempts = opts.attempts ?? 3;
    const intervalMs = opts.intervalMs ?? 1500;
    const url = `${this.accountBase}/calls/${encodeURIComponent(callId)}/transcript`;
    const headers = { Authorization: `Bearer ${this.config.apiKey}` };

    // 생성 요청(비동기). 실패해도 GET 재시도로 이어감.
    await this.fetchImpl(url, { method: "POST", headers, cache: "no-store" }).catch(() => null);

    for (let i = 0; i < attempts; i++) {
      const res = await this.fetchImpl(url, { method: "GET", headers, cache: "no-store" }).catch(
        () => null,
      );
      if (res && res.ok) {
        const json = (await res.json().catch(() => null)) as {
          status?: string;
          segments?: Array<{ speaker?: string; text?: string }>;
        } | null;
        const ready = (json?.status ?? "").toLowerCase();
        if (json && (ready === "completed" || ready === "done" || ready === "ready")) {
          return transcriptSegmentsToTurns(json.segments ?? [], atIso);
        }
        if (Array.isArray(json?.segments) && json!.segments!.length > 0 && ready !== "processing") {
          return transcriptSegmentsToTurns(json!.segments!, atIso);
        }
      }
      if (i < attempts - 1) await this.sleep(intervalMs);
    }
    return []; // 준비 안 됨 → DTMF 턴만으로 분류 진행(다음 tick/후속 콜백에서 보강 가능).
  }

  /** duration → cost(전사 포함 여부 반영). 콜백 처리부가 vendor cost 로 사용. */
  costKrw(durationSec: number, includeTranscript: boolean): number {
    return computeCallCostKrw(durationSec, {
      costPerMinKrw: this.config.costPerMinKrw,
      transcriptPerMinKrw: this.config.transcriptPerMinKrw,
      includeTranscript,
    });
  }
}
