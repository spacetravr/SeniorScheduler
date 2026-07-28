/**
 * ALIMTALK(카카오 알림톡) 발송 어댑터 — **스텁**.
 *
 * 왜 스텁인가: 카카오 비즈니스 채널 개설 + 템플릿 심사(7~10일)가 사용자 액션으로 선행돼야 한다
 * (FOURTH-PLAN §0). 코드는 지금 붙여 두고, 심사가 끝나면 **env 만 채우면 활성**되게 한다.
 * 그때 바뀌는 건 이 파일의 sendViaVendor 한 곳뿐 — 라우터·렌더러·호출부는 무변경.
 *
 * 현재 동작: env 미설정 → isEnabled()=false → 라우터가 skip. env 가 설정돼도 실 HTTP 호출은
 * 아직 없으므로 skipped("vendor_not_implemented") 로 정직하게 반환한다(가짜 sent 금지).
 * 템플릿 변수 생성(lib/reports/render/alimtalk.ts)까지는 지금도 정상 동작한다.
 *
 * 규약: throw 금지. reason 에 PII(수신 번호) 금지.
 */
import type { NotifyAdapter, NotifyResult, NotifySendInput } from "@/lib/contracts/notify";

export type AlimtalkConfig = {
  /** 발신 프로필 키(@채널 식별) */
  senderKey: string;
  /** 승인된 템플릿 코드 — 예외 알림용 */
  templateCodeException: string;
  /** 승인된 템플릿 코드 — 주간 요약용 */
  templateCodeWeekly: string;
  /** 벤더 API 키 */
  apiKey: string;
  /** 벤더 API 베이스 URL */
  baseUrl: string;
};

/** env → 설정. 하나라도 비면 null(=비활성). 값 자체는 로그에 남기지 않는다. */
export function resolveAlimtalkConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): AlimtalkConfig | null {
  const senderKey = env.KAKAO_ALIMTALK_SENDER_KEY?.trim();
  const apiKey = env.KAKAO_ALIMTALK_API_KEY?.trim();
  const baseUrl = env.KAKAO_ALIMTALK_API_BASE_URL?.trim();
  const templateCodeException = env.KAKAO_ALIMTALK_TEMPLATE_EXCEPTION?.trim();
  const templateCodeWeekly = env.KAKAO_ALIMTALK_TEMPLATE_WEEKLY?.trim();
  if (!senderKey || !apiKey || !baseUrl || !templateCodeException || !templateCodeWeekly) {
    return null;
  }
  return { senderKey, apiKey, baseUrl, templateCodeException, templateCodeWeekly };
}

export class AlimtalkNotifyAdapter implements NotifyAdapter {
  readonly channel = "ALIMTALK" as const;

  constructor(private readonly config: AlimtalkConfig | null = resolveAlimtalkConfig()) {}

  isEnabled(): boolean {
    return this.config !== null;
  }

  /** 발송 종류 → 승인 템플릿 코드. 심사 통과 코드가 env 로 주입된다. */
  templateCodeFor(kind: NotifySendInput["kind"]): string | null {
    if (!this.config) return null;
    return kind === "WEEKLY_DIGEST"
      ? this.config.templateCodeWeekly
      : this.config.templateCodeException;
  }

  async send(input: NotifySendInput): Promise<NotifyResult> {
    if (!this.isEnabled()) {
      return { channel: this.channel, status: "skipped", reason: "alimtalk_not_configured" };
    }
    if (!input.to) {
      return { channel: this.channel, status: "skipped", reason: "no_recipient" };
    }
    const templateCode = this.templateCodeFor(input.kind);
    if (!templateCode) {
      return { channel: this.channel, status: "skipped", reason: "no_template_code" };
    }

    // TODO(알림톡 심사 통과 후): 여기서 벤더 REST 를 fetch 로 호출한다.
    //   POST `${config.baseUrl}/v1/messages`
    //   body: { senderKey, templateCode, to: input.to, templateVars: input.templateVars,
    //           buttons: [{ name:"리포트 보기", linkMo: input.linkUrl }, { name:"전화 걸기", ... }] }
    //   - 실패는 throw 하지 말고 {status:"failed", reason:`vendor_${status}`} 로 강등.
    //   - 수신 번호·본문은 절대 로깅하지 않는다(PII).
    //   - lib/email 의 fetchWithTimeout 패턴(AbortController 8s)을 그대로 따를 것.
    return { channel: this.channel, status: "skipped", reason: "vendor_not_implemented" };
  }
}

export function createAlimtalkNotifyAdapter(
  config: AlimtalkConfig | null = resolveAlimtalkConfig(),
): NotifyAdapter {
  return new AlimtalkNotifyAdapter(config);
}
