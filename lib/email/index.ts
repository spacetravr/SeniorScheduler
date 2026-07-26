/**
 * 이메일 발송 추상화 (CLAUDE.md 가드레일 4 — 외부 서비스는 인터페이스 추상화).
 *
 * 백엔드 선택:
 *   ① RESEND_API_KEY 있으면 ResendAdapter (fetch 로 Resend REST 직접 호출, SDK 미설치).
 *   ② 없으면 DisabledAdapter — 발송을 skip 하고 서버 로그 1줄만 남긴다(throw 금지).
 *
 * - lib/ai/llm.ts 의 selectBackend 패턴을 그대로 따른다(키 유무로 분기, 오류는 강등).
 * - PII 보호: 수신 이메일 주소는 로그에 남기지 않는다.
 * - 신규 npm 의존성 추가 금지 — fetch 직접 호출.
 */

/** 발송 요청 메시지. */
export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/** 발송 결과. skipped=true 는 "백엔드 비활성으로 의도적 미발송"(정상). */
export type EmailResult = { ok: boolean; skipped?: boolean; error?: string };

export interface EmailAdapter {
  send(msg: EmailMessage): Promise<EmailResult>;
}

const RESEND_URL = "https://api.resend.com/emails";
const RESEND_TIMEOUT_MS = 8000;
const DEFAULT_FROM = "onboarding@resend.dev";

/** AbortController 기반 타임아웃 래퍼 — 초과 시 fetch throw → send 가 {ok:false} 로 강등. */
async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RESEND_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Resend REST 어댑터. 실패(네트워크/비2xx)는 {ok:false} 로 강등 — throw 하지 않는다. */
export class ResendAdapter implements EmailAdapter {
  constructor(
    private readonly apiKey: string,
    private readonly from: string = DEFAULT_FROM,
  ) {}

  async send(msg: EmailMessage): Promise<EmailResult> {
    try {
      const res = await fetchWithTimeout(RESEND_URL, {
        method: "POST",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          from: this.from,
          to: msg.to,
          subject: msg.subject,
          text: msg.text,
          ...(msg.html ? { html: msg.html } : {}),
        }),
      });
      if (!res.ok) {
        // 상태 코드만 로깅 — 수신 주소·본문(PII) 원문 미로깅.
        console.error("[email] resend non-ok:", res.status);
        return { ok: false, error: `resend_${res.status}` };
      }
      return { ok: true };
    } catch (err) {
      console.error("[email] resend fetch failed:", err instanceof Error ? err.name : "error");
      return { ok: false, error: "network_error" };
    }
  }
}

/** 키 없음 경로 — 발송 skip. 로그 1줄, 수신 주소 미로깅. 절대 throw 하지 않는다. */
export class DisabledAdapter implements EmailAdapter {
  async send(_msg: EmailMessage): Promise<EmailResult> {
    console.warn("[email] disabled — RESEND_API_KEY 미설정, 발송 skip");
    return { ok: true, skipped: true };
  }
}

/**
 * 백엔드 선택 (키 있으면 Resend, 없으면 Disabled).
 * @param apiKey  RESEND_API_KEY (명시 전달 가능).
 * @param from    RESEND_FROM (미지정 시 onboarding@resend.dev).
 */
export function selectEmailBackend(
  apiKey: string | undefined = process.env.RESEND_API_KEY,
  from: string | undefined = process.env.RESEND_FROM,
): EmailAdapter {
  if (apiKey) return new ResendAdapter(apiKey, from || DEFAULT_FROM);
  return new DisabledAdapter();
}
