# 텔레포니 실벤더 연동 — ClawOps (확정)

> 상태(2026-07-16): **실벤더 ClawOps 확정 · 계정/키/발신번호(070-5275-3827) 발급 완료 ·
> API 연동 검증(numbers 200 OK).** 벤더 중립 계층(provider 선택·콜백 계약·상태 기계·재시도)에
> ClawOps 실구현을 꽂았다. 이 문서는 확정 스펙과 실콜 E2E 전 확인 목록을 담는다.
> (CLOVA 스켈레톤은 `docs/telephony-clova.md` 에 참고용으로 남긴다 — 미채택.)

## 확정 스펙 (재조사 불필요)

- Base `https://api.claw-ops.com` (오버라이드: `CLAWOPS_API_BASE_URL`).
- 인증 `Authorization: Bearer ${CLAWOPS_API_KEY}`. 계정 경로 `/v1/accounts/${CLAWOPS_ACCOUNT_ID}`.
- **발신**: `POST .../calls` JSON `{ To, From, Url, StatusCallback, StatusCallbackEvent, Timeout, MachineDetection }`
  → Call 객체 `{ CallId: "CA..." }`. `Url` 은 통화 연결 시 **VoiceML(TwiML 호환 XML)** 을 반환할 우리 서버 URL.
- **전사**: `POST .../calls/{callId}/transcript`(생성 요청) / `GET` 동일 경로 → `{ status, segments:[{speaker, text}] }` (비동기 생성).
- **통화 조회/이벤트**: `GET .../calls/{callId}`, `GET .../calls/{callId}/events`.
- **상태 웹훅**: StatusCallback URL 로 POST, `{ CallId, CallStatus, AnsweredBy }`, `X-Signature` 헤더(스킴 미문서화).

Twilio 호환으로 **VoiceML(`<Response><Say><Gather><Pause><Hangup>`) 을 가정**한다. 이 호환 가정은
**실콜 E2E 에서 검증 예정** — 태그/속성이 다르면 `lib/telephony/voiceml.ts` 만 조정한다.

## 아키텍처 (벤더 중립 — 재사용)

```
[dispatch-calls cron]  provider=clawops(async)         [telephony/callback route]  (ClawOps → 우리)
  └ 세션 생성(SCHEDULED)                                   └ 인증: URL 쿼리 자체 토큰(HMAC)
  └ adapter.triggerCall → POST calls → CallId              └ CallId/쿼리 session 으로 세션 상관
  └ provider_call_id 저장 + 상태 DIALING                   └ clawopsCallbackParser → 중립 계약(zod)
       │                                                    └ COMPLETED: transcript 확보 → DTMF+전사 분류
       ▼ (ClawOps 가 통화 진행)                              └ processCallback: 상태전이·재시도·멱등(공유)
  [ClawOps → Url] VoiceML 시나리오 라우트                    ├ SCHEDULE 리포트 / CONSENT self_consent
  [Gather DTMF → action] step 진행 + DTMF 를 call_turns 저장  └ NO_ANSWER/FAILED → next_attempt_at 재시도
```

- 어댑터 선택: `lib/telephony/provider.ts` (`TELEPHONY_PROVIDER=mock|clova|clawops`).
- 실벤더 어댑터: `lib/telephony/clawops-adapter.ts` (triggerCall / fetchTranscript / cost / 토큰).
- VoiceML 시나리오(순수): `lib/telephony/voiceml.ts`, 라우트: `app/api/telephony/voiceml/route.ts`.
- 콜백 파서: `clawopsCallbackParser` (`lib/telephony/callback.ts`), 처리: `callback-handler.ts`(공유).
- 대화 두뇌(분류·리포트·동의 판정)는 벤더 무관 자체 코드(`lib/ai`, `lib/calls`) 재사용.

## VoiceML 시나리오 흐름 (음성 우선 — 2026-07-16 전환)

> 시니어가 키패드를 어려워하므로 **음성 응답을 우선 유도**한다. Gather 는
> `input="speech dtmf"`(음성 우선 + DTMF silent fallback), `language="ko-KR"`,
> `speechTimeout="auto"`. 멘트에서 버튼 안내는 제거하고 음성 답변을 유도하되, **버튼을
> 눌러도 여전히 인식**된다(안내만 제거, DTMF 경로 유지).

**SCHEDULE 콜**
```
intro   Say(인사 + "혈압약 확인 전화예요" + 녹음·전사 고지
            + "하셨으면 '네, 했어요', 아직이면 '아직이요'처럼 말씀해 주세요")
        + Gather(speech dtmf, numDigits=1, speechTimeout=auto, ko-KR, →step=answer)
answer  ├ DTMF 1/2/3  → SENIOR/DTMF 턴 저장 → Say(기분) + Pause(5s) + Say(종료) + Hangup
        ├ SpeechResult → SENIOR/VOICE 턴 저장 → Say(기분) + Pause(5s) + Say(종료) + Hangup
        │               (이행 판정은 실시간에 하지 않음 — 콜백 분류가 담당)
        ├ 무입력 & 첫 응답 → Say(음성 유도 재질문) + Gather(→step=answer&reask=1)
        └ 무입력 & 재질문 후 → 기분 + 종료 (UNCERTAIN — 억지 판정 금지)
```
**CONSENT 콜**
```
intro   Say(서비스 안내 + 녹음·전사 고지
            + "동의하시면 '동의합니다', 원치 않으시면 '괜찮습니다'라고 말씀해 주세요")
        + Gather(speech dtmf, →step=answer)
answer  ├ DTMF 1 → 턴 저장 → 동의 종료 멘트 + Hangup
        ├ DTMF 2 → 턴 저장 → 거부 종료 멘트 + Hangup
        ├ SpeechResult GRANTED → SENIOR/VOICE 턴 → 동의 종료
        ├ SpeechResult DENIED  → SENIOR/VOICE 턴 → 거부 종료
        ├ SpeechResult 애매 & 첫 응답 → 발화 턴 저장 + 재질문 Gather
        ├ SpeechResult 애매 & 재질문 후 → 발화 턴 저장 + 거부 종료(미동의)
        ├ 무입력 & 첫 응답 → 재질문 Gather
        └ 무입력 & 재질문 후 → 거부 종료(self_consent 미기록)
```
- DTMF(Digits)/SpeechResult 는 `call_turns` 에 SENIOR/DTMF·SENIOR/VOICE 턴으로 저장 →
  콜백 완료 시 분류 입력(DTMF 우선 → VOICE 키워드 룰 → LLM → UNCERTAIN)에 사용.
- 실제 이행 판정은 VoiceML 이 아니라 콜백 완료 시 `lib/ai/classifier` 가 수행(두뇌 위임 금지).
  CONSENT 만은 종료 멘트를 실시간 갈라야 하므로 `classifyConsent`(lib/ai) 를 그대로 호출한다
  (로직 복제 없음). 최종 self_consent 성사 판정도 콜백 시 동일 함수(`evaluateConsentGranted`)로 재확인.
- **벤더 speech 미지원 폴백**: SpeechResult 가 한 번도 안 와도(벤더가 speech Gather 미지원 시)
  통화는 재질문→기분→종료로 완주하며, 최종 분류는 콜백 시 전사(transcript) 기반으로 성립한다.
  즉 speech Gather 는 있으면 좋은 가속 경로, 없어도 파이프라인 무결.

## 콜백 상태 매핑표 (`mapClawopsCallStatus`)

| CallStatus | AnsweredBy | 중립 이벤트 | 처리 |
|---|---|---|---|
| initiated/queued/ringing/in-progress/빈값 | - | (무시) | 200 noop |
| answered | human/미지정 | ANSWERED | IN_PROGRESS |
| answered | machine*/fax | NO_ANSWER | 재시도/ MISSED |
| completed | human/미지정 | COMPLETED | 전사+분류+리포트/동의 |
| completed | machine*/fax | NO_ANSWER | 음성사서함=부재 → 재시도 |
| busy / no-answer | - | NO_ANSWER | 재시도(1분/10분)→MISSED |
| failed / canceled | - | FAILED | 재시도→MISSED |
| (미지의 종결) | - | FAILED | 조용한 유실 방지 |

`MachineDetection: "Hangup"` — 기계 응답이면 통화를 끊고 부재로 처리한다.

## provider_call_id 설계 (마이그레이션 0006)

- `call_sessions.provider_call_id text` — 벤더 CallId 저장(발신 트리거 성공 시 dispatch 가 기록).
- 세션 상관: **1차는 StatusCallback/VoiceML URL 쿼리에 실은 우리 `session_id`**(URL 은 우리가 구성 →
  벤더가 그대로 되부름). 2차 폴백은 `CallId → provider_call_id` 역조회(전사 조회 등 CallId 로만
  통화를 지목하는 경로 대비).

## 전사 확보 전략

- COMPLETED 콜백에서 `POST transcript`(생성 요청) 후 짧은 재시도로 `GET`(기본 3회 × 1.5초, best-effort).
- 준비 안 됐으면 **DTMF 턴만으로 분류 진행**(DTMF 우선 원칙 — 판정 가능). 전사 세그먼트는 SENIOR
  자유 발화(기분 답변 등)만 `call_turns` 로 보강(우리 멘트는 VoiceML 이 이미 저장 → 중복 없음).
- 멱등: 이미 종결(COMPLETED/MISSED)된 세션이면 전사/원가 재작업 없이 `processCallback` 이 무시.

## 원가 기록 (`cost_krw`)

- 회선 `CLAWOPS_COST_PER_MIN_KRW`(기본 60) + 전사 `CLAWOPS_TRANSCRIPT_PER_MIN_KRW`(기본 10, 전사 확보 시).
- 분 단위 올림 과금(최소 1분) × duration → 벤더 원가. 여기에 LLM 원가(분류/리포트)를 합산해 기록.

## 녹음 정책 (불변)

- 우리는 **전사(transcript)만 저장**한다. 녹음 파일은 다운로드·저장하지 않는다(PII·저장 최소화).
- 자유 발화는 `<Pause>` 동안 통화가 이어지며 전사만 API 로 수집한다(원본 오디오 미보관).
- **확인 항목**: ClawOps 측 자동 녹음(recording) 비활성화 옵션 — 미확인. 콘솔/발신 파라미터에서
  녹음 저장을 끌 수 있는지 확인 필요(우리가 저장 안 해도 벤더 측 보관 최소화).

## 인증 (자체 토큰)

- VoiceML/StatusCallback URL 쿼리에 `token = HMAC-SHA256(TELEPHONY_CALLBACK_SECRET, sessionId)[:32]`.
  마스터 시크릿을 URL 에 직접 노출하지 않고 세션별 파생 토큰으로 검증(`verifySessionToken`).
- **TODO(E2E)**: 웹훅 `X-Signature` 서명 스킴 확정 시 벤더 서명 검증을 추가한다(현재 자체 토큰만).

## 실콜 E2E 전 확인 목록 (오케스트레이터가 사용자와 수행)

1. env 설정: `TELEPHONY_PROVIDER=clawops`, `CLAWOPS_API_KEY/ACCOUNT_ID/FROM_NUMBER`,
   `TELEPHONY_CALLBACK_SECRET`, `NEXT_PUBLIC_SITE_URL`(공개 도메인) — Vercel + 로컬 동기화.
2. 마이그레이션 0006 적용(Supabase SQL Editor) — `provider_call_id` 컬럼 존재 확인.
3. 발신번호(070-5275-3827) 등록/승인 상태 확인.
4. **VoiceML 호환 검증**: 실콜 1건으로 `<Say language="ko-KR">`·`<Gather input="speech dtmf">`·
   `<Pause>`·`<Hangup>` 동작 확인. 태그/속성 이름이 다르면 `voiceml.ts` 조정.
4b. **Gather speech 지원 여부 확인**: ClawOps 가 `input="speech dtmf"`/`speechTimeout`/`language`
   /SpeechResult 콜백 필드를 지원하는지 실콜로 확인. **미지원이어도 통화는 완주**해야 하며(음성 무입력→
   재질문→기분→종료), 분류는 콜백 전사 기반으로 성립함을 확인. 지원 시 SpeechResult 가 SENIOR/VOICE
   턴으로 실시간 저장돼 분류 가속 경로가 동작하는지 확인. 필드명이 다르면(SpeechResult 외) 라우트
   `readGatherInput` 의 키 목록 보정.
5. **StatusCallback 페이로드 검증**: 실제 `CallStatus`/`AnsweredBy` 문자열 값 확인 → 매핑표 보정.
   Content-Type(form vs json) 확인(라우트는 둘 다 처리).
6. **전사 API 검증**: `segments[].speaker` 라벨 실제 값 확인 → `transcriptSegmentsToTurns` 의
   speaker 필터 보정(현재 agent/system/bot/caller/outbound 계열 제외 휴리스틱).
7. **X-Signature 스킴** 확인 후 벤더 서명 검증 추가(자체 토큰과 병행/대체).
8. **녹음 비활성화 옵션** 확인(위 녹음 정책).
9. 무응답 재시도(1분/10분 → MISSED) E2E, 음성사서함(MachineDetection) 부재 처리 E2E.
10. cost_krw 실측 대조(단가 env 보정).
