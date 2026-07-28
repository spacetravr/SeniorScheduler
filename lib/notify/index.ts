/**
 * 알림 라우터 — "보낼지 말지"만 판정하고, "어디로"는 어댑터에 맡긴다.
 *
 * 설계(docs/report-spec.md §1·§3, FOURTH-PLAN §2 Lane A):
 *  - 라우터는 채널을 모른다. 채널이 늘어나도(문자·푸시) 이 파일은 그대로다 = 확장 지점.
 *  - 판정 입력은 세 축뿐: 알림 레벨(NotifyLevel) × 발송 종류(NotifyKind) × 리포트 톤(DigestTone).
 *  - **절대 throw 하지 않는다.** 어댑터가 예외를 던져도 {status:"failed"} 로 강등해
 *    통화 파이프라인·크론을 죽이지 않는다(lib/ai/llm.ts 의 null 강등 원칙과 동일).
 *  - reason 에 PII(이메일 주소·전화번호·본문) 금지 — 코드성 문자열만.
 */
import type { DigestTone } from "@/lib/contracts/report-view";
import type {
  NotifyAdapter,
  NotifyChannel,
  NotifyKind,
  NotifyLevel,
  NotifyResult,
} from "@/lib/contracts/notify";
import { createEmailNotifyAdapter } from "@/lib/notify/email";
import { createAlimtalkNotifyAdapter } from "@/lib/notify/alimtalk";
import { kstYmd, noopNotifyDedupe, type NotifyDedupeStore } from "@/lib/notify/dedupe";

export { EmailNotifyAdapter, createEmailNotifyAdapter } from "@/lib/notify/email";
export { AlimtalkNotifyAdapter, createAlimtalkNotifyAdapter } from "@/lib/notify/alimtalk";
export {
  createSupabaseNotifyDedupe,
  noopNotifyDedupe,
  kstYmd,
  type NotifyDedupeStore,
} from "@/lib/notify/dedupe";

/**
 * 발송 여부 판정 (순수 함수 — 전수 테스트 대상).
 *
 * EXCEPTION_ALERT (통화 직후 예외 알림)
 *   - CALM        : 어떤 레벨에서도 보내지 않는다. 정상은 조용히(오경보 관리가 곧 제품).
 *   - ATTENTION   : ALL 에서만. EXCEPTION 은 단발 이상을 알리지 않는다(리포트에는 남는다).
 *   - ALERT       : ALL·EXCEPTION 에서 보낸다. WEEKLY_ONLY 는 받지 않는다.
 *
 * WEEKLY_DIGEST (주간 요약)
 *   - 레벨·톤과 무관하게 보낸다. 주간 요약은 "알림"이 아니라 정기 리포트이며,
 *     수신 동의(guardians.notify_weekly_summary)로만 통제한다 — WEEKLY_ONLY 도 당연히 받는다.
 */
export function shouldNotify(kind: NotifyKind, level: NotifyLevel, tone: DigestTone): boolean {
  if (kind === "WEEKLY_DIGEST") return true;
  // kind === "EXCEPTION_ALERT"
  if (tone === "CALM") return false;
  if (level === "WEEKLY_ONLY") return false;
  if (level === "ALL") return true; // ATTENTION·ALERT 모두
  return tone === "ALERT"; // level === "EXCEPTION"
}

/** 채널별 수신자. 값이 없으면 그 채널은 skip 된다. */
export type NotifyRecipients = Partial<Record<NotifyChannel, string | null>>;

export type NotifyRouteInput = {
  kind: NotifyKind;
  level: NotifyLevel;
  tone: DigestTone;
  recipients: NotifyRecipients;
  subject: string;
  text: string;
  html?: string;
  templateVars?: Record<string, string>;
  linkUrl?: string;
  /**
   * 하루 1회 발송 상한의 주체. **주면 상한이 걸리고, 없으면 상한 없이 그대로 발송**한다
   * (상한은 "보호자 × 종류 × 채널 × KST 날짜" 단위 — lib/notify/dedupe.ts).
   * 서버 호출부는 dedupe 저장소와 함께 반드시 넘길 것.
   */
  guardianId?: string | null;
  /** 상한의 날짜 경계 기준 시각(KST 로 환산). 기본 now — 테스트에서 자정 경계를 주입한다. */
  now?: Date;
};

/** 기본 어댑터 묶음 — env 기반. 테스트/호출부에서 주입 교체 가능. */
export function defaultAdapters(): NotifyAdapter[] {
  return [createEmailNotifyAdapter(), createAlimtalkNotifyAdapter()];
}

/**
 * 판정 → (하루 1회 상한) → 활성 어댑터로 전달. 결과는 채널별 배열(빈 배열 = 발송 대상 아님).
 * 어느 경로에서도 throw 하지 않는다.
 *
 * 상한(오경보 관리): `guardianId` 와 `dedupe` 저장소가 모두 주어지면, 발송 **직전에**
 * `notify_log` 오늘치 행을 선점한다.
 *   - 이미 있음(unique 충돌) → `{status:"skipped", reason:"already_sent_today"}` 로 조용히 통과
 *   - 선점 성공 후 발송이 sent 가 아니면 → 선점을 되돌린다(실패·skip 은 로그를 남기지 않음)
 *   - 저장소 오류 → 상한을 포기하고 발송은 진행(fail-open). 자세한 근거는 lib/notify/dedupe.ts.
 * 채널마다 따로 건다 — 이메일이 나갔다고 알림톡까지 막히면 안 된다.
 */
export async function routeNotify(
  input: NotifyRouteInput,
  adapters: NotifyAdapter[] = defaultAdapters(),
  dedupe: NotifyDedupeStore = noopNotifyDedupe,
): Promise<NotifyResult[]> {
  if (!shouldNotify(input.kind, input.level, input.tone)) return [];

  const guardianId = input.guardianId ?? null;
  const ymd = kstYmd(input.now ?? new Date());

  const results: NotifyResult[] = [];
  for (const adapter of adapters) {
    if (!adapter.isEnabled()) {
      results.push({ channel: adapter.channel, status: "skipped", reason: "adapter_disabled" });
      continue;
    }
    const to = input.recipients[adapter.channel];
    if (!to) {
      results.push({ channel: adapter.channel, status: "skipped", reason: "no_recipient" });
      continue;
    }

    // ── 하루 1회 상한 선점 ──
    let receiptId: string | null = null;
    let claimed = false;
    if (guardianId) {
      const claim = await dedupe.claim({
        guardianId,
        kind: input.kind,
        channel: adapter.channel,
        ymd,
        tone: input.tone,
      });
      if (claim.status === "already_sent") {
        results.push({
          channel: adapter.channel,
          status: "skipped",
          reason: "already_sent_today",
        });
        continue;
      }
      if (claim.status === "claimed") {
        claimed = true;
        receiptId = claim.receiptId;
      }
      // unavailable → fail-open: 상한 없이 발송 진행(되돌릴 선점도 없음).
    }

    let result: NotifyResult;
    try {
      result = await adapter.send({
        kind: input.kind,
        to,
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
        ...(input.templateVars ? { templateVars: input.templateVars } : {}),
        ...(input.linkUrl ? { linkUrl: input.linkUrl } : {}),
      });
    } catch (err) {
      // 어댑터 규약 위반(throw)까지 흡수 — 호출부(크론/콜백)는 절대 죽지 않는다.
      console.error("[notify] adapter threw:", adapter.channel, err instanceof Error ? err.name : "error");
      result = { channel: adapter.channel, status: "failed", reason: "adapter_threw" };
    }

    // 성공한 발송만 이력으로 남긴다 — 실패·skip 이면 선점을 되돌려 다음 시도를 허용.
    if (claimed && result.status !== "sent") await dedupe.release(receiptId);

    results.push(result);
  }
  return results;
}

/** DB(text) → NotifyLevel. 알 수 없는 값은 기본값으로 강등(throw 금지). */
export function parseNotifyLevel(raw: unknown, fallback: NotifyLevel = "EXCEPTION"): NotifyLevel {
  return raw === "ALL" || raw === "EXCEPTION" || raw === "WEEKLY_ONLY" ? raw : fallback;
}
