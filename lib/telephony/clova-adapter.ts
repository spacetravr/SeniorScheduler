import {
  TelephonyNotConfiguredError,
  type Clock,
  type CallResult,
  type InitiateCallParams,
  type TelephonyAdapter,
  type TriggerCallParams,
  type TriggerCallResult,
} from "./types";

/**
 * ClovaAdapter — CLOVA AiCall(또는 국내 CPaaS) 실벤더 어댑터 스켈레톤.
 *
 * ── 현재 상태(2026-07-15) ──
 * CLOVA AiCall 은 콘솔/엑셀 캠페인 기반 아웃바운드가 문서화돼 있으나, **발신 REST API 와
 * 결과 웹훅(콜백)** 이 공개 문서상 확인되지 않았다(계정 발급 후 확인 필요). 따라서 이 어댑터는
 * 인터페이스만 구현하고 실제 HTTP 호출은 스펙 확정 시 채운다. 그 전까지 모든 발신 경로는
 * TelephonyNotConfiguredError 를 던져 **조용한 오작동(가짜 통화 기록)을 원천 차단**한다.
 *
 * ── 확정 시 확인/구현해야 할 것 (docs/telephony-clova.md 질문 목록과 동기화) ──
 *   1. 발신 API 존재 여부: 세션 1건을 프로그램적으로 발신하는 REST 엔드포인트가 있는가?
 *      (없으면 발신 API 를 제공하는 국내 CPaaS 로 이 어댑터만 교체 — 콜백/처리부는 그대로 재사용)
 *   2. 콜백/웹훅 등록 방법: 결과 통지 URL 을 콘솔/API 어디에 등록하는가? 인증 헤더 규약은?
 *   3. 전사 획득 경로: 콜백에 전사가 포함되는가, 아니면 Object Storage 등에서 별도 조회인가?
 *   4. 세션 상관키: 우리 sessionId 를 발신 요청에 실어 콜백에서 echo 받을 수 있는가?
 *   5. 통화당 단가: 회선/STT/TTS 과금 항목과 산정식(call_sessions.cost_krw 기록 근거).
 */

/** CLOVA 발신에 필요한 필수 env 키 목록 — provider.ts 설정 검증의 단일 소스. */
export const CLOVA_ENV_KEYS = [
  "CLOVA_API_KEY_ID",
  "CLOVA_API_KEY",
  "CLOVA_CONTACT_CENTER_ID",
  "CLOVA_AGENT_ID",
  "CLOVA_CALLER_NUMBER",
] as const;

/**
 * 주입식 설정(문서로 추정되는 항목 — 스펙 확정 시 이름/구성 조정 가능).
 *   - apiKeyId/apiKey: NCP API Gateway 인증(액세스키/시크릿 또는 서비스 API 키).
 *   - contactCenterId/agentId: CLOVA AiCall Contact Center(Outbound)·시나리오 Agent 식별자.
 *   - callerNumber: 등록된 발신번호(발신자 표시).
 *   - apiBaseUrl: 오버라이드용(미지정 시 벤더 기본 엔드포인트).
 */
export type ClovaConfig = {
  apiKeyId: string;
  apiKey: string;
  contactCenterId: string;
  agentId: string;
  callerNumber: string;
  apiBaseUrl?: string;
};

export class ClovaAdapter implements TelephonyAdapter {
  constructor(private readonly config: ClovaConfig) {}

  /**
   * 동기 대화-드라이버 모델은 실벤더에 해당하지 않는다(실벤더는 콜백 비동기).
   * 잘못 호출되면 명시적으로 실패시킨다.
   */
  async initiateCall(_params: InitiateCallParams, _clock: Clock): Promise<CallResult> {
    throw new TelephonyNotConfiguredError(
      "ClovaAdapter 는 동기 initiateCall 을 지원하지 않습니다. 비동기 triggerCall + 콜백을 사용하세요.",
    );
  }

  /**
   * 비동기 발신 트리거. 스펙 확정 전까지 TelephonyNotConfiguredError 를 던진다.
   *
   * TODO(스펙 확정 시): 아래를 채운다.
   *   - to 를 벤더 규격으로 정규화(발신번호 this.config.callerNumber).
   *   - POST {apiBaseUrl}/.../campaigns|calls (contactCenterId, agentId, 대상 번호,
   *     상관키=params.sessionId) 로 1건 발신 요청.
   *   - 인증 헤더(this.config.apiKeyId/apiKey) 부착. cache: "no-store".
   *   - 성공 시 { providerCallId } 반환. 결과(전사/과금/상태)는 콜백으로 수신.
   */
  async triggerCall(_params: TriggerCallParams): Promise<TriggerCallResult> {
    // 설정 값 참조 표시(미사용 경고 방지 + 확정 시 사용 위치 명시).
    void this.config;
    throw new TelephonyNotConfiguredError(
      "ClovaAdapter.triggerCall 미구현: CLOVA 발신 API 스펙 확정 후 HTTP 연동을 채우세요(docs/telephony-clova.md).",
    );
  }
}
