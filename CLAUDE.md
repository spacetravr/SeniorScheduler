# CLAUDE.md — 시니어 일정관리 보이스콜 (Beta)

## 프로젝트 한 줄 정의
보호자(3050 자녀)가 웹에서 부모님 일정(복약/병원 등)을 등록하면, 예약 시간에 부모님의 **일반 전화(PSTN)** 로 자동 보이스콜을 발신하고, 응답을 분류해 보호자에게 결과 리포트를 제공하는 서비스의 **베타 웹**.

## 최우선 원칙 (이번 스프린트)
1. **UI 먼저, 기능 나중.** 랜딩과 보호자 웹의 화면·흐름을 먼저 완성하고, 백엔드 기능은 뒤에 붙인다. 화면은 mock 데이터로 먼저 동작시킨다.
2. **CTA 클릭 데이터 수집은 Day 1 기능.** 랜딩의 [구독하기]/[베타 사용해보기] 클릭·전환 추적은 UI와 함께 처음부터 실데이터로 동작해야 함 (설문과 함께 배포되므로).
3. 디자인 토큰은 아래 `## 디자인 토큰` 섹션이 단일 소스. 현재 placeholder이며 추후 Claude Design/외부 소스에서 확정값이 들어옴 → **하드코딩 금지, 전부 CSS 변수/Tailwind theme로만 참조.**

## 베타 범위
- **IN**: 랜딩(CTA 추적), 보호자 웹(로그인/피보호자/일정 CRUD/대시보드/통화기록 UI), 보이스콜 파이프라인(ARS+ 방식), 통화 후 LLM 분류·요약, **피보호자(부모) 동의 플로우**(첫 통화 도입부 녹음 안내 + 보호자 대리동의 체크), 통화당 원가 로깅
- **OUT (구현 금지)**: 실시간 STT-LLM-TTS 스트리밍 양방향, 보이스 클로닝, 알림톡, 네이티브 앱, 결제, 의료 조언 생성, 긴급 알림 에스컬레이션 액션(확장 단계)

## 기술 스택 (고정 — 변경 시 먼저 질문)
- Next.js 14+ (App Router, TypeScript) 단일 풀스택 앱
- DB: Supabase (PostgreSQL) + RLS
- Auth: Supabase Auth (이메일 magic link)
- LLM: Anthropic API (haiku 계열, 통화 후 배치 전용)
- 스타일: Tailwind CSS, 모바일 웹 우선
- 배포: Vercel

## 시간대 규칙 (불변)
- **이 서비스는 국내 전용. 모든 시각은 KST(Asia/Seoul) 단일 세계로 동작한다.**
- DB 컬럼은 `timestamptz` 사용. 서버/컨테이너/Cron/DB 세션 타임존을 `Asia/Seoul`로 명시 고정 (`TZ=Asia/Seoul`, Vercel Cron 표현식은 UTC로 해석되므로 KST 의도 시각을 -9h 변환해 등록하고 주석으로 KST 원본 명기).
- 코드에서 시각 비교·생성 시 항상 `Asia/Seoul` 명시 (date-fns-tz 사용). 암묵적 로컬/UTC 의존 금지.

## 전화 발신 (핵심 결정 대기 — 추상화로 선개발)
- **Twilio 폐기** (해외발신 → 발신번호 문제·원가·지연). 후보: **국내 CPaaS(발신 API/SIP) vs CLOVA AiCall** — 비교 후 확정 예정.
- 확정 전까지 `lib/telephony/`에 **TelephonyAdapter 인터페이스 + MockAdapter**로 개발 진행:
  - `interface TelephonyAdapter { initiateCall(to, sessionId): Promise<CallHandle>; /* 상태 콜백 수신 규약 */ }`
  - MockAdapter: 발신 시뮬레이션(수초 후 상태 전이 + 가짜 전사 생성) → UI/파이프라인은 벤더 없이 완성 가능
- 대화 두뇌(응답 분류, 리포트 생성, 프롬프트)는 어떤 벤더를 쓰든 **자체 코드로 유지** (`lib/ai/`). 벤더 시나리오 빌더에 로직 위임 금지.
- ARS+ 설계(벤더 무관 공통): 안내 멘트 → 음성/버튼 응답 → 분류(DTMF 우선→키워드 룰→애매하면 1회 재질문→UNCERTAIN) → 기분 질문 1턴(저장만) → 종료. 재시도 1분/10분 각 1회, 실패 시 MISSED.
- **절대 억지로 DONE/NOT_DONE 판정하지 말 것. 불확실하면 UNCERTAIN.**

## 데이터 모델
- `guardians`, `seniors`(+ `consent_at`, `consent_by` 대리동의, `self_consent_at` 본인 동의 — 동의 콜에서 확보, 실발신은 둘 다 필요), `schedules`(RRULE, 발신 ON/OFF)
- `call_sessions`(상태 기계, 시도횟수, `purpose` SCHEDULE|CONSENT — 동의 콜 구분(전기통신사업법 대응), **`cost_krw numeric` — 통화당 실원가(회선+STT+LLM+TTS 합산) 기록, 벤더 무관 필수**)
- `call_turns`, `call_reports`(adherence_status: DONE|NOT_DONE|POSTPONED|UNCERTAIN|MISSED, summary, mood_flag, health_flag, prompt_version)
- `cta_events`(VIEW|CLICK_SUBSCRIBE|CLICK_TRY|WAITLIST_SUBMIT, utm 3종, session_uuid), `waitlist`
- 녹음 원본 미저장(전사만). PII 로그 마스킹.

## 디자인 토큰 (2026-07-15 확정 — "따뜻함+신뢰": 딥 네이비 + 웜 크림 + 테라코타)
```css
:root {
  --color-primary: #1E3A5F;       /* 딥 네이비 — 신뢰. CTA·강조 */
  --color-primary-soft: #EAF0F7;  /* 네이비 틴트 — soft 배경 */
  --color-accent: #C2410B;        /* 웜 테라코타 — 강조·경고 (AA 통과) */
  --color-bg: #FBF7F0;            /* 웜 화이트 */
  --color-surface: #F0E7D8;       /* 소프트 베이지 — 교차 섹션 */
  --color-border: #E7DBC8;        /* 웜 보더 */
  --color-text: #263140;          /* 잉크 네이비 (대비 11:1+) */
  --color-text-muted: #6B5D4F;    /* 웜 토프 (대비 5.5:1) */
  --color-senior-1: #1E3A5F;      /* 피보호자 구분색 1 — 네이비 (장식용, index%3 배정) */
  --color-senior-2: #C2410B;      /* 피보호자 구분색 2 — 테라코타 */
  --color-senior-3: #5B7553;      /* 피보호자 구분색 3 — 세이지 그린 */
  --radius-base: 14px;
  --font-sans: 'Pretendard Variable', sans-serif;
  --shadow-card: 0 1px 2px rgba(38,49,64,.04), 0 10px 30px -16px rgba(38,49,64,.18);
}
```
- 단일 소스는 `app/globals.css`의 토큰 블록 (이 섹션과 동기화 유지). 모든 컴포넌트는 변수/Tailwind theme만 참조 — 하드코딩 금지 불변.
- 리스킨 시 globals.css 블록만 교체하면 전체 반영. 전 조합 WCAG AA 대비 검증됨.

## 가드레일
1. 의료 조언 생성 금지 (LLM 프롬프트 명시 + 리포트 하단 고지 문구 고정)
2. RLS로 보호자 간 데이터 격리
3. LLM 호출 통화당 최대 2회
4. 외부 서비스는 인터페이스 추상화 (`lib/telephony/`, `lib/ai/`)
5. 피보호자 동의 없이는 실발신 금지 (seniors.consent_at 체크)

## 코딩 컨벤션
- TS strict, zod 검증, 서버 로직은 Server Actions 또는 route handlers
- 커밋은 작게, 기능 단위. 분류 룰·RRULE 파싱은 유닛 테스트 필수
- 환경변수는 `.env.example`에 항상 동기화

## 멀티 에이전트 작업 규칙 (병렬 세션/서브에이전트 공통)
> 목적: 여러 작업이 동시에 진행돼도 충돌·중복이 없게.
1. **파일 소유권 경계 (겹침 금지):**
   - `ui`: `app/(marketing)/**`, `app/(app)/**`, `components/**` — 화면·컴포넌트만. API/DB 스키마 수정 금지.
   - `data`: `supabase/**`(마이그레이션), `app/api/**`, `lib/**` — 서버·DB만. 컴포넌트 스타일 수정 금지.
   - 공유 파일(`types/`, `lib/contracts/`)은 **contract-first**: 타입/zod 스키마를 먼저 커밋하고 양쪽이 그것만 참조.
2. 각 작업 단위는 별도 브랜치(`feat/ui-*`, `feat/data-*`) 또는 git worktree. main 직접 커밋 금지.
3. 작업 완료 시 반드시 reviewer 에이전트(.claude/agents/reviewer.md)로 검토 후 머지.
4. 경계를 넘는 수정이 필요하면 임의로 하지 말고 오케스트레이터(메인 세션)에 보고.
5. **핫픽스 패스트트랙 (2026-07-12 사용자 지시)**: 로직 변경이 없는 단순 수정(이미지·문구·색상·정렬 등 1~5줄 스타일/에셋 교체)은 에이전트·reviewer 생략하고 오케스트레이터가 직접 처리한다 — 브랜치에 커밋 → 빌드 확인 → 머지 → 배포 (5분 내 목표). 로직·추적·계약·DB·인증에 닿는 변경은 여전히 정식 절차(에이전트+reviewer) 필수.

## 테스트 실행 정책 (2026-07-15 사용자 지시 — 속도 우선)
- 파일 단위 수정마다 tsc/test 실행하지 않는다. 실행 시점은 ① 작업 단위(브랜치) 완료 시 ② **머지 게이트(reviewer)에서 tsc+test+build 일괄** ③ 배포 전 스모크 — 이 3곳으로 몰아준다.
- 테스트 **작성** 의무는 불변: 분류 룰·RRULE 파싱 등 판정 정확성 코드는 유닛 테스트 필수 (코딩 컨벤션 유지).

## 세션 운영 규칙
1. **모델 배분**: 오케스트레이터(메인 세션) = Fable / ui-builder·data-api = Opus / reviewer = Sonnet (`.claude/agents/*.md` frontmatter `model:`에 명시됨 — 임의 변경 금지)
2. **세션 연속성 (PROGRESS.md)**: 컨텍스트 compact 임박 또는 큰 작업 단위 완료 시 반드시 `PROGRESS.md`에 [완료한 것 / 진행 중 / 다음 할 일 / 결정사항 / 블로커]를 갱신한 뒤 `/clear`. 새 세션은 CLAUDE.md → PLAN.md → **PROGRESS.md** 순으로 읽고 재개한다.
3. **외부 도구 버전 고정**: 라이브러리·외부 서비스 도입 시 버전과 호환성 근거를 PROGRESS.md 결정사항에 기록 (예: Next 14 + React 18 + Tailwind 3.4 조합 유지 — 메이저 업그레이드는 오케스트레이터 승인 필요).

## 구현 순서
PLAN.md Phase 0 → 1 → 2 → 3. 각 Phase 완료 시 동작 확인 후 진행.
