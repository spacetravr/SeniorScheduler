# 텔레포니 실벤더 연동 (CLOVA AiCall / 국내 CPaaS)

> ⚠️ 상태(2026-07-16): **미채택 — 실벤더는 ClawOps 로 확정됨.** 확정 스펙·아키텍처·E2E 체크리스트는
> `docs/telephony.md` 를 참조한다. 이 문서는 벤더 중립 계층 설계 근거와 CLOVA 검토 이력을 남기는
> 참고용이다(CLOVA 스켈레톤 어댑터/파서는 코드에 그대로 보존 — provider=clova).
>
> 아래는 확정 전(2026-07-15) 원본 기록이다.

## 왜 스켈레톤인가

CLOVA AiCall 은 공개 문서상 **콘솔/엑셀 캠페인 기반 아웃바운드**만 확인되고,
프로그램적 **발신 REST API** 와 **결과 웹훅(콜백)** 이 확인되지 않는다(계정 발급 후 재확인 필요).
따라서 실제 HTTP 연동 대신, 벤더가 바뀌어도 재사용 가능한 중립 계층을 먼저 완성했다.

## 아키텍처 (벤더 중립)

```
[dispatch-calls cron]                       [telephony/callback route]
  provider=clova(async)                       (실벤더 → 우리)
   └ 세션 생성(SCHEDULED)                       └ 인증(Bearer TELEPHONY_CALLBACK_SECRET)
   └ adapter.triggerCall(sessionId,...)         └ 벤더별 파서 → 중립 계약(zod)
   └ 상태 DIALING(발신 중)                        └ processCallback: 상태전이·재시도·멱등
        │                                             ├ COMPLETED → 기존 분류/리포트 재사용
        ▼ (벤더가 통화 진행)                            ├ NO_ANSWER/FAILED → next_attempt_at 재시도 예약
   [벤더 콜백] ─────────────────────────────────────►  └ (SCHEDULE)리포트 / (CONSENT)self_consent
```

- 어댑터 선택: `lib/telephony/provider.ts` (`TELEPHONY_PROVIDER=mock|clova`).
- 실벤더 어댑터 스켈레톤: `lib/telephony/clova-adapter.ts` — `triggerCall` 이 스펙 확정 전까지
  `TelephonyNotConfiguredError` 를 던진다(조용한 mock 폴백 없음).
- 콜백 중립 계약·파서: `lib/telephony/callback.ts` (generic 파서 구현, clova 파서 TODO).
- 콜백 처리(상태전이·재시도·멱등): `lib/telephony/callback-handler.ts`.
- 대화 두뇌(분류·리포트·동의 판정)는 벤더 무관 자체 코드(`lib/ai`, `lib/calls`) 재사용.

## 확정해야 할 질문 목록 (계정 발급 후 벤더에 확인)

1. **발신 API 존재 여부** — 세션 1건을 프로그램적으로 발신하는 REST 엔드포인트가 있는가?
   (콘솔/엑셀 캠페인만 있고 API 가 없다면 → **발신 API 를 제공하는 국내 CPaaS 로 어댑터만 교체**.
   콜백 수신부·처리 로직·대화 두뇌는 그대로 재사용 가능.)
2. **콜백/웹훅 유무·등록 방법** — 통화 결과 통지 URL 을 콘솔/API 어디에 등록하는가?
   인증 헤더 규약은?(우리는 `Authorization: Bearer <TELEPHONY_CALLBACK_SECRET>` 를 기대.)
3. **세션 상관키** — 우리 `sessionId` 를 발신 요청에 실어 콜백에서 그대로 echo 받을 수 있는가?
   (불가하면 벤더 통화 id ↔ 우리 세션 매핑용 `provider_call_id` 컬럼을 마이그레이션으로 추가.)
4. **전사(STT) 획득 경로** — 콜백에 전사가 포함되는가, 아니면 Object Storage 등에서 별도
   조회해야 하는가? DTMF 입력은 별도 필드로 오는가?
5. **통화당 단가** — 회선/STT/TTS 과금 항목과 산정식. `call_sessions.cost_krw` 기록 근거
   (콜백 `cost_krw` 필드로 받거나, 단가표로 산정).
6. **상태 코드 매핑** — 벤더 상태코드 → `ANSWERED | NO_ANSWER | COMPLETED | FAILED` 매핑표.

## 계정 발급 후 체크리스트

1. NCP 콘솔에서 CLOVA AiCall 선행 상품 신청(Contact Center 등 의존 상품 포함).
2. Contact Center(Outbound) 생성 → `CLOVA_CONTACT_CENTER_ID` 확보.
3. 발신번호 등록/인증 → `CLOVA_CALLER_NUMBER`.
4. 최소 시나리오(Agent) 구성 → `CLOVA_AGENT_ID`.
   - 주의(가드레일): 대화 분기·판정 로직을 벤더 시나리오 빌더에 위임하지 않는다.
     시나리오는 "안내 멘트 재생 + 응답(음성/DTMF) 수집 + 콜백 전송" 최소 역할만.
5. API 인증키 발급 → `CLOVA_API_KEY_ID` / `CLOVA_API_KEY`.
6. 위 질문 1~6 확인 후:
   - `lib/telephony/clova-adapter.ts` 의 `triggerCall` HTTP 연동 채우기.
   - `lib/telephony/callback.ts` 의 `clovaCallbackParser` 원시→중립 매핑 채우기.
   - 필요 시 마이그레이션 0006 으로 `provider_call_id` 추가.
7. 스테이징에서 콜백 수신 e2e 확인(무응답 재시도 1분/10분 → MISSED 포함).

## 발신 API 가 없을 경우 대안

CLOVA 에 프로그램적 발신 API 가 없다면, **발신 API + 결과 웹훅을 제공하는 국내 CPaaS**
(SIP/REST 아웃바운드)로 어댑터만 교체한다. 교체 범위는 `clova-adapter.ts` + `callback.ts` 의
벤더 파서뿐이며, 나머지(디스패치 async 경로, 콜백 처리, 상태 기계, 재시도, 분류/리포트)는
벤더 무관하게 그대로 재사용된다.

## CLOVA Chatbot 약관에서 확인된 의무 (2026-07-15, 사용자 가입 진행 중 확인)

> 출처: 네이버 클라우드 플랫폼 CLOVA Chatbot 서비스 이용약관 (2024-10-29 시행)

1. **제5조 ②③ — 데이터 활용 고지·동의 의무 (우리 쪽 의무)**: 네이버(회사 등)는 성능 향상 목적으로
   대화 모델·이용자 대화 데이터를 취득·보관·활용할 수 있고, **고객(우리)이 이용자(부모님)에게 이를
   설명하고 동의를 얻을 의무**가 있다 → **동의 콜 멘트/개인정보 고지에 "대화 내용이 챗봇 서비스
   품질 향상에 활용될 수 있음" 문구 반영 필요** (실발신 전 필수 체크리스트에 추가).
2. **제10조 — 개인정보 처리 위탁**: 이용자 개인정보(전화번호 등)를 네이버에 제공/처리위탁하게 되므로
   위수탁 계약 또는 제3자 제공 동의 필요 여부 검토 → 개인정보 처리방침에 수탁사 명시.
3. **제3조 — 이용 승낙**: 신청 후 회사 승낙으로 계약 성립 (승인 단계 존재 가능).
4. **제6조 ② — Trial 요금제**: Chatbot은 3개월 Trial 존재. 기한 내 유료 전환 안 하면 데이터 삭제
   (대화 모델 백업 필요) — 베타 기간 비용 절약에 활용 가능하나 만료일 캘린더 등록 권장.
