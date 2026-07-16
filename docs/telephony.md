# 텔레포니 실벤더 연동 — ClawOps (확정)

> 상태(2026-07-16): **실벤더 ClawOps 확정 · 실콜 E2E 1건(65초 완주) 완료 · 관찰 사실 반영.**
> 벤더 중립 계층(provider 선택·콜백 계약·상태 기계·재시도)에 ClawOps 실구현을 꽂았다.
> (CLOVA 스켈레톤은 `docs/telephony-clova.md` 에 참고용으로 남긴다 — 미채택.)

## 실콜 E2E 관찰 사실 (2026-07-16 · 실측 · 추측 아님)

1건(65초, 통화 완주) 분석 결과:
- **상태 웹훅(initiated/in-progress/completed) 정상 수신** — 상태 기계·리포트·cost 기록 전부 작동.
- **Gather 의 speech 입력이 action 콜백을 트리거하지 않음** — 사용자가 7회 발화했으나 voiceml
  라우트는 intro 1회만 호출됨(step 진행 전무). 즉 실시간 음성 기반 step 전환은 이 벤더에서 불가.
  DTMF 는 미검증(사용자가 안 누름)이나 즉시 분기 경로는 유지. → **SCHEDULE 흐름을 단일 문서로 재구성**.
- **전사 API 는 정상이나 생성이 통화 종료 후 수십 초 소요** — 3회×1.5초 재시도로는 항상 미완성.
  지금 조회하면 완성돼 있음(segmentCount 11, speaker "AGENT"/"CUSTOMER"). → **콜백 재시도 ~30초로
  연장 + 디스패치 크론 전사 백필** 추가.
- **발신 응답·통화 조회 필드는 camelCase**(callId, answeredBy 등). `answeredBy` 실값 **"unknown"** 관찰
  → human 취급(성사)으로 매핑 확정(machine/fax 만 기계).
- **리포트 summary 잘림**("어르신께 저녁 약 복"에서 끊김) — Gemini 2.5 계열 thinking 이 출력 토큰
  예산(256)을 소비해 출력이 잘림. → `thinkingConfig.thinkingBudget=0` + `maxOutputTokens=1024` 로 수정.

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

## VoiceML 시나리오 흐름 (단일 문서 — 2026-07-16 실콜 확정)

> **speech 가 action 을 트리거하지 않으므로**(관찰 사실), SCHEDULE 을 **하나의 자기완결 VoiceML
> 문서**로 재구성했다. Gather 는 `input="dtmf speech"`(DTMF 우선 — 실질적으로 DTMF 만 action 을
> 부른다), `language="ko-KR"`, 짧은 `timeout`. Twilio 의미론상 Gather 는 입력이 없으면 **같은
> 문서의 다음 verb 로 진행**하므로, action 이 안 와도 따뜻한 흐름 전체가 재생된다. 시니어 발화는
> 전부 통화 후 전사로 수집한다.

**SCHEDULE 콜 (단일 문서)**
```
intro   Say(인사 + "혈압약 확인 전화예요" + 녹음·전사 고지
            + "하셨으면 '네, 했어요', 아직이면 '아직이요'처럼 말씀해 주세요")
        + Gather(dtmf speech, numDigits=1, timeout, ko-KR, →step=answer)   ← DTMF 만 action 분기
        + Say(기분 질문)      + Pause(10s)     ┐ 같은 문서에서 이어지는 따뜻한 종결부
        + Say(일상 질문1)     + Pause(12s)     │ (action 이 안 와도 그대로 재생)
        + Say(일상 질문2)     + Pause(12s)     │
        + Say(따뜻한 마무리) + Hangup          ┘
answer  (DTMF 가 와서 action 이 호출된 경우에만)
        SENIOR/DTMF 턴 저장 + Say(응답 인지 멘트 + 기분 질문) + Pause(10s)
        + 일상1 + Pause + 일상2 + Pause + 마무리 + Hangup   ← intro 와 중복 없이 기분부터 이어짐
```
- 기분·일상 질문 SYSTEM 턴은 `call_turns` 경계 마커로 저장된다(splitAtFreeForm). DTMF 는 SENIOR/DTMF
  턴으로 저장. 시니어 자유 발화는 통화 후 전사가 채운다.
- **재질문 생략(SCHEDULE)**: 단일 문서에서 action 이 안 오면 재질문도 못 하므로 SCHEDULE 은 재질문
  없이 곧장 따뜻한 흐름으로 진행한다(무입력=UNCERTAIN → 콜백/백필 전사가 판정).

**CONSENT 콜** (speech action 지원 벤더에서만 실시간 분기 의미 — 미지원 시 콜백 전사로 재판정)
```
intro   Say(서비스 안내 + 녹음·전사 고지 + "동의하시면 '동의합니다'…") + Gather(dtmf speech, →answer)
answer  ├ DTMF 1 → 동의 종료 / DTMF 2 → 거부 종료
        ├ SpeechResult GRANTED/DENIED → 동의/거부 종료(+SENIOR/VOICE 턴)
        └ 애매·무입력 → 첫 응답 재질문 / 재질문 후 미동의 종료
```
- 실제 이행 판정은 VoiceML 이 아니라 콜백 완료 시 `lib/ai/classifier` 가 수행(두뇌 위임 금지).
  최종 self_consent 성사 판정도 콜백 시 `evaluateConsentGranted`(classifyConsent)로 재확인.
- **전사 위치 부여**: 전사 SENIOR 턴은 경계 마커보다 늦게 삽입되므로 그대로 두면 전부 자유 발화로
  몰려 이행 판정이 항상 UNCERTAIN 이 된다. `positionTranscriptTurns` 가 첫 발화(=일정 확인 답)를
  경계 앞으로, 나머지를 경계 뒤로 위치시켜(created_at 조정) splitAtFreeForm 이 올바로 분리하게 한다.

## 콜백 상태 매핑표 (`mapClawopsCallStatus`)

| CallStatus | AnsweredBy | 중립 이벤트 | 처리 |
|---|---|---|---|
| initiated/queued/ringing/in-progress/빈값 | - | (무시) | 200 noop |
| answered | human/**unknown**/미지정 | ANSWERED | IN_PROGRESS |
| answered | machine*/fax | NO_ANSWER | 재시도/ MISSED |
| completed | human/**unknown**/미지정 | COMPLETED | 전사+분류+리포트/동의 |
| completed | machine*/fax | NO_ANSWER | 음성사서함=부재 → 재시도 |

> `AnsweredBy` **"unknown"**(실콜 관찰값)은 MachineDetection 이 사람/기계를 확정 못 한 값 →
> **human 취급(성사)**. machine/fax 만 기계로 본다(억지 부재 처리 시 실제 통화 유실 방지).
| busy / no-answer | - | NO_ANSWER | 재시도(1분/10분)→MISSED |
| failed / canceled | - | FAILED | 재시도→MISSED |
| (미지의 종결) | - | FAILED | 조용한 유실 방지 |

`MachineDetection: "Hangup"` — 기계 응답이면 통화를 끊고 부재로 처리한다.

## provider_call_id 설계 (마이그레이션 0006)

- `call_sessions.provider_call_id text` — 벤더 CallId 저장(발신 트리거 성공 시 dispatch 가 기록).
- 세션 상관: **1차는 StatusCallback/VoiceML URL 쿼리에 실은 우리 `session_id`**(URL 은 우리가 구성 →
  벤더가 그대로 되부름). 2차 폴백은 `CallId → provider_call_id` 역조회(전사 조회 등 CallId 로만
  통화를 지목하는 경로 대비).

## 전사 확보 전략 (콜백 재시도 연장 + 디스패치 백필)

- COMPLETED 콜백에서 `POST transcript`(생성 요청) 후 재시도로 `GET`(**기본 10회 × 3초 = ~30초**,
  Vercel 함수 300초 한도 내 — 실콜 확인상 전사 생성은 수십 초 소요). best-effort.
- 확보 시 `positionTranscriptTurns` 로 경계에 맞춰 삽입(첫 발화=이행 답 앞, 나머지 뒤). dedupe 로
  실시간 DTMF 턴과 중복 제거. 우리 멘트(SYSTEM)는 VoiceML 이 이미 저장 → 전사에서 제외.
- **디스패치 백필(async·clawops)**: 콜백에서도 못 채우면(전사 지연), 5분 크론이 **최근 2시간 내
  COMPLETED 이면서 SENIOR 턴 0건**인 세션을 훑어 전사를 재조회·삽입한다. 삽입 후 기존 리포트가
  **UNCERTAIN 이고 새 SENIOR 턴이 생겼으면 재분류**해 리포트를 갱신한다.
  - **LLM 상한(가드레일 3)**: 세션이 소비한 LLM 호출 수를 `call_sessions.llm_calls_used`(마이그레이션
    0007)에 기록하고, 백필 재분류는 남은 예산(2 - used)만큼만 LLM 을 쓴다(0 이면 룰 분류만).
  - **멱등**: SENIOR 턴이 삽입되면 다음 tick 에서 "SENIOR 0건" 조건에 걸리지 않아 재실행되지 않는다.
- 준비 안 됐으면 **DTMF 턴만으로 분류 진행**(DTMF 우선 원칙 — 판정 가능).
- 멱등: 이미 종결(COMPLETED/MISSED)된 세션이면 상태/원가 재작업 없이 `processCallback` 이 무시.

## 원가 기록 (`cost_krw`)

- 회선 `CLAWOPS_COST_PER_MIN_KRW`(기본 60) + 전사 `CLAWOPS_TRANSCRIPT_PER_MIN_KRW`(기본 10, 전사 확보 시).
- 분 단위 올림 과금(최소 1분) × duration → 벤더 원가. 여기에 LLM 원가(분류/리포트)를 합산해 기록.

## 녹음 정책 (불변)

- 우리는 **전사(transcript)만 저장**한다. 녹음 파일은 다운로드·저장하지 않는다(PII·저장 최소화).
- 자유 발화는 `<Pause>` 동안 통화가 이어지며 전사만 API 로 수집한다(원본 오디오 미보관).
- **발신 파라미터 `Record: false`** 추가(Twilio 호환) — 벤더 측 자동 녹음 비활성화 시도. 해로울 것
  없음. **효과(ClawOps 가 이 파라미터를 존중하는지)는 실콜에서 검증 예정.**

## 인증 (자체 토큰)

- VoiceML/StatusCallback URL 쿼리에 `token = HMAC-SHA256(TELEPHONY_CALLBACK_SECRET, sessionId)[:32]`.
  마스터 시크릿을 URL 에 직접 노출하지 않고 세션별 파생 토큰으로 검증(`verifySessionToken`).
- **TODO(E2E)**: 웹훅 `X-Signature` 서명 스킴 확정 시 벤더 서명 검증을 추가한다(현재 자체 토큰만).

## 실콜 E2E 전 확인 목록 (오케스트레이터가 사용자와 수행)

1. env 설정: `TELEPHONY_PROVIDER=clawops`, `CLAWOPS_API_KEY/ACCOUNT_ID/FROM_NUMBER`,
   `TELEPHONY_CALLBACK_SECRET`, `NEXT_PUBLIC_SITE_URL`(공개 도메인) — Vercel + 로컬 동기화.
2. 마이그레이션 0006·**0007(llm_calls_used)** 적용(Supabase SQL Editor) — 컬럼 존재 확인.
3. 발신번호(070-5275-3827) 등록/승인 상태 확인.
4. ~~VoiceML 호환 검증~~ **(완료)** — `<Say>`·`<Gather>`·`<Pause>`·`<Hangup>` 동작 확인됨(65초 완주).
4b. ~~Gather speech 지원 확인~~ **(완료 — 미지원 확정)**: speech 입력이 action 을 트리거하지 않음.
   → SCHEDULE 단일 문서로 전환, 발화는 전사로 수집. **DTMF 즉시 분기(step=answer)는 실콜 재검증 필요**
   (지난 콜에서 사용자가 버튼을 안 눌러 미검증).
5. ~~StatusCallback 검증~~ **(대부분 완료)**: camelCase(callId/answeredBy), answeredBy "unknown"=human.
   Content-Type 재확인만 남음(라우트는 form/json 둘 다 처리).
6. ~~전사 speaker 라벨~~ **(완료)**: "AGENT"/"CUSTOMER" 확인 — 현행 필터(agent 계열 제외)가 CUSTOMER 를
   SENIOR 로 올바로 남긴다. 재검증만.
7. **X-Signature 스킴** 확인 후 벤더 서명 검증 추가(자체 토큰과 병행/대체) — 미완.
8. **녹음 비활성화**: 발신 `Record: false` 추가함 — 벤더가 존중하는지 실콜 검증.
9. 무응답 재시도(1분/10분 → MISSED) E2E, 음성사서함(MachineDetection) 부재 처리 E2E — 미검증.
10. cost_krw 실측 대조(단가 env 보정).
11. **전사 지연·백필 E2E**: 콜백 30초 재시도로 확보되는지, 못 하면 다음 5분 크론 백필이 채우고
    UNCERTAIN→재분류로 리포트가 갱신되는지 확인. **summary 잘림 재발 여부**(thinkingBudget=0 반영) 확인.
