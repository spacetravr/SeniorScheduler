/**
 * EMAIL 발송 어댑터 — 기존 lib/email(Resend/Disabled)을 NotifyAdapter 계약으로 감싼다.
 *
 * 재구현하지 않는다: 백엔드 선택·타임아웃·PII 미로깅 규칙은 전부 lib/email 이 이미 갖고 있고,
 * 여기서는 결과 형태만 NotifyResult 로 번역한다(래퍼 = 얇게).
 *
 * 규약(lib/contracts/notify.ts): **절대 throw 하지 않는다.** 예외는 status:"failed" 로 강등.
 * reason 에는 PII(수신 주소·본문) 를 넣지 않는다 — 코드성 문자열만.
 */
import { selectEmailBackend, type EmailAdapter } from "@/lib/email";
import type { NotifyAdapter, NotifyResult, NotifySendInput } from "@/lib/contracts/notify";

export class EmailNotifyAdapter implements NotifyAdapter {
  readonly channel = "EMAIL" as const;

  constructor(
    private readonly backend: EmailAdapter = selectEmailBackend(),
    /** 키 유무 판정 — 주입 가능(테스트). 기본은 RESEND_API_KEY 존재 여부. */
    private readonly enabled: boolean = Boolean(process.env.RESEND_API_KEY),
  ) {}

  isEnabled(): boolean {
    return this.enabled;
  }

  async send(input: NotifySendInput): Promise<NotifyResult> {
    if (!this.isEnabled()) {
      return { channel: this.channel, status: "skipped", reason: "email_backend_disabled" };
    }
    if (!input.to) {
      return { channel: this.channel, status: "skipped", reason: "no_recipient" };
    }
    try {
      const res = await this.backend.send({
        to: input.to,
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
      });
      // lib/email 은 키 없음(DisabledAdapter)도 ok:true+skipped 로 알린다 → skipped 로 보존.
      if (res.skipped) {
        return { channel: this.channel, status: "skipped", reason: "email_backend_disabled" };
      }
      if (res.ok) return { channel: this.channel, status: "sent" };
      return { channel: this.channel, status: "failed", reason: res.error ?? "send_failed" };
    } catch (err) {
      // lib/email 은 throw 하지 않지만, 어댑터 주입(테스트·향후 백엔드) 대비 최종 방어선.
      console.error("[notify/email] unexpected:", err instanceof Error ? err.name : "error");
      return { channel: this.channel, status: "failed", reason: "unexpected_error" };
    }
  }
}

/** 기본 EMAIL 어댑터 (env 기반). */
export function createEmailNotifyAdapter(
  apiKey: string | undefined = process.env.RESEND_API_KEY,
): NotifyAdapter {
  return new EmailNotifyAdapter(selectEmailBackend(apiKey), Boolean(apiKey));
}
