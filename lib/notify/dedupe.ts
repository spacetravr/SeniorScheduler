/**
 * 발송 상한(하루 1회) — "보호자 × 종류 × 채널 × KST 날짜" 로 중복 발송을 막는다.
 *
 * 왜(docs/research/benchmark-ux.md · THIRD-PLAN P0-3): 불필요한 알림이 해지 1위 요인이다.
 * 같은 날 이상 신호가 여러 번 생기면(통화가 연달아 MISSED 등) 예외 알림이 통화 건수만큼
 * 나가는데, 그것이 곧 알림 피로다. **판정(shouldNotify)은 그대로 두고 발송 상한만 건다.**
 *
 * 설계 — 왜 "조회 후 삽입" 이 아니라 "선점(claim) 후 발송" 인가:
 *   조회→발송→기록 순서는 조회와 기록 사이에 틈이 있어, 크론 재시도·중복 실행이 겹치면
 *   두 프로세스가 모두 "아직 안 보냄" 을 읽고 둘 다 발송한다(그 뒤 하나만 23505 로 튕겨도
 *   메일은 이미 두 통 나갔다). 그래서 **발송 직전에 먼저 로그 행을 선점**하고,
 *   - unique 충돌(23505) → 이미 오늘 보냄 → `{status:"skipped", reason:"already_sent_today"}`
 *   - 발송이 sent 가 아니면 선점 행을 되돌린다(release) → 다음 시도 가능
 *   결과 상태는 "성공한 발송만 로그에 남는다" 로 동일하면서 경쟁 조건의 틈이 없다.
 *
 * fail-open 원칙: DB 조회·기록이 실패하면 **발송을 막지 않는다**. 알림을 놓치는 것보다
 * 드물게 한 번 더 가는 쪽이 낫고, 무엇보다 통화 파이프라인·크론이 알림 저장소 장애로
 * 멈추면 안 된다. 실패는 코드성 문자열로만 로깅한다(PII 금지).
 *
 * 시간대(CLAUDE.md 불변): 날짜 경계는 항상 Asia/Seoul 명시. UTC 자정 기준이 되면
 * 21:00 KST 알림이 "다음 날" 로 새어 나가 상한이 무력화된다.
 *
 * 규약: 이 모듈의 어떤 함수도 throw 하지 않는다.
 */
import { formatInTimeZone } from "date-fns-tz";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NOTIFY_CHANNELS, NOTIFY_KINDS } from "@/lib/contracts/notify";
import { DIGEST_TONES } from "@/lib/contracts/report-view";

const KST = "Asia/Seoul";

/** 지금(절대시각) 의 KST 달력 날짜 `yyyy-MM-dd`. 상한의 단위. */
export function kstYmd(now: Date = new Date()): string {
  return formatInTimeZone(now, KST, "yyyy-MM-dd");
}

/** 상한 키 — DB unique 인덱스(notify_log_daily_uk) 와 1:1. */
export const notifyLogKeySchema = z.object({
  guardianId: z.string().uuid(),
  kind: z.enum(NOTIFY_KINDS),
  channel: z.enum(NOTIFY_CHANNELS),
  ymd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "yyyy-MM-dd (KST)"),
  /** 진단용 — 키에는 포함하지 않는다. */
  tone: z.enum(DIGEST_TONES).optional(),
});
export type NotifyLogKey = z.infer<typeof notifyLogKeySchema>;

/**
 * 선점 결과.
 *  - claimed      : 이 프로세스가 오늘치를 차지했다 → 발송해도 된다(실패 시 release).
 *  - already_sent : 오늘 이미 보냈다 → 조용히 skip.
 *  - unavailable  : 저장소를 쓸 수 없다 → **fail-open**(발송 진행, 되돌릴 것도 없음).
 */
export type NotifyClaim =
  | { status: "claimed"; receiptId: string | null }
  | { status: "already_sent" }
  | { status: "unavailable"; reason: string };

export interface NotifyDedupeStore {
  /** 발송 직전 호출. 오늘치 로그 행을 선점한다. */
  claim(key: NotifyLogKey): Promise<NotifyClaim>;
  /** 발송이 sent 가 아니었을 때 선점을 되돌린다(다음 시도 허용). throw 하지 않는다. */
  release(receiptId: string | null): Promise<void>;
}

/** 상한 없음(기존 동작 유지). 저장소를 주입하지 않은 호출부·테스트의 기본값. */
export const noopNotifyDedupe: NotifyDedupeStore = {
  async claim() {
    return { status: "unavailable", reason: "no_store" };
  },
  async release() {
    /* no-op */
  },
};

/** PostgreSQL unique_violation. */
const UNIQUE_VIOLATION = "23505";

type PgErrorLike = { code?: string | null; message?: string | null } | null;

/**
 * Supabase(admin 클라이언트) 기반 저장소.
 * `notify_log` 는 write 정책이 없으므로 **서버 secret key 클라이언트**로만 동작한다
 * (RLS 클라이언트를 넣으면 insert 가 막혀 unavailable → fail-open 으로 흐른다).
 */
export function createSupabaseNotifyDedupe(client: SupabaseClient): NotifyDedupeStore {
  return {
    async claim(key: NotifyLogKey): Promise<NotifyClaim> {
      const parsed = notifyLogKeySchema.safeParse(key);
      if (!parsed.success) {
        // 키가 이상하면 상한을 포기하고 발송은 진행한다(fail-open). 값 자체는 로깅하지 않는다.
        console.warn("[notify/dedupe] invalid key — 상한 미적용");
        return { status: "unavailable", reason: "invalid_key" };
      }
      const k = parsed.data;
      try {
        const { data, error } = await client
          .from("notify_log")
          .insert({
            guardian_id: k.guardianId,
            kind: k.kind,
            channel: k.channel,
            ymd: k.ymd,
            tone: k.tone ?? null,
          })
          .select("id")
          .single();

        const err = error as PgErrorLike;
        if (err) {
          if (err.code === UNIQUE_VIOLATION) return { status: "already_sent" };
          // 테이블 미생성(42P01) 등 — 상한 없이 발송은 계속한다.
          console.error("[notify/dedupe] claim failed:", err.code ?? "unknown");
          return { status: "unavailable", reason: "claim_failed" };
        }
        const id = (data as { id?: string } | null)?.id ?? null;
        return { status: "claimed", receiptId: id };
      } catch (e) {
        console.error("[notify/dedupe] claim unexpected:", e instanceof Error ? e.name : "error");
        return { status: "unavailable", reason: "claim_unexpected" };
      }
    },

    async release(receiptId: string | null): Promise<void> {
      if (!receiptId) return;
      try {
        const { error } = await client.from("notify_log").delete().eq("id", receiptId);
        const err = error as PgErrorLike;
        // 되돌리기 실패는 "오늘 하루 이 채널로 더 안 보냄" 이 될 뿐 — 발송 사고가 아니라 감수한다.
        if (err) console.error("[notify/dedupe] release failed:", err.code ?? "unknown");
      } catch (e) {
        console.error("[notify/dedupe] release unexpected:", e instanceof Error ? e.name : "error");
      }
    },
  };
}
