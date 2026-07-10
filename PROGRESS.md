# PROGRESS.md — 세션 인수인계 로그

> **규칙**: 컨텍스트 compact 임박 또는 큰 작업 단위 완료 시 이 파일을 갱신하고 `/clear`.
> 새 세션은 CLAUDE.md → PLAN.md → 이 파일 순으로 읽고 재개.
> 최신 항목이 **위**. 형식: 완료 / 진행 중 / 다음 할 일 / 결정사항 / 블로커.

---

## 2026-07-06 — 세션 #1: 프로젝트 초기화 + Phase 0 착수

### 완료
- `.claude/agents/` 3역할(ui-builder=opus, data-api=opus, reviewer=sonnet) 모델 배분 확정 (frontmatter)
- CLAUDE.md에 `## 세션 운영 규칙` 섹션 추가 (모델 배분·PROGRESS.md 인수인계·버전 고정)
- Next.js 스캐폴딩 + npm install + `npm run build` 통과
- **Phase 0 코드 완성** (ui-builder ∥ data-api 병렬 → reviewer FAIL 1건(tsconfig target 누락, 오케스트레이터가 ES2017 추가로 해결) → 빌드 PASS):
  - 랜딩 `/`: 히어로→문제공감→3단계→가격티저(PRICING 상수)→CTA 2개+대기자 모달, 의료조언 미제공 고지
  - CTA 추적: session_uuid(localStorage) + utm 3종(sessionStorage) → VIEW 1회 dedup/클릭/제출
  - `supabase/migrations/0001_cta_waitlist.sql` (RLS deny-all, 쓰기는 서버 secret key 경유 — 승인된 설계)
  - `/api/cta`(204, VIEW 중복 23505 흡수), `/api/waitlist`(201, 이메일 중복 성공 처리), PII 로그 미포함
  - `/admin/metrics`: ADMIN_PASSWORD 게이트(?pw= 또는 쿠키), utm_source별 VIEW→CLICK→SUBMIT 퍼널
- `.env.local` 세팅 완료 (신형 키: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY, ADMIN_PASSWORD=vs-beta-2026)

### 완료 (Phase 0 종료 — 2026-07-06)
- 마이그레이션 원격 적용 (사용자가 SQL Editor 실행) + 로컬 스모크 8/8 통과
- 채널별 퍼널 분리 집계 검증 (kakao vs naver) → **Phase 0 완료 기준 충족**
- OG/트위터 메타 태그 추가
- **Vercel 프로덕션 배포: https://voicescheduler.vercel.app** (프로젝트 voicescheduler, 팀 voice-scheduler)
  - env 5종 등록: SUPABASE URL/PUBLISHABLE/SECRET, ADMIN_PASSWORD, NEXT_PUBLIC_SITE_URL
  - ⚠️ `TZ`는 Vercel 예약 변수라 등록 불가 → 코드에서 항상 Asia/Seoul 명시(date-fns-tz)로 대응, Cron은 -9h 변환 (CLAUDE.md 규칙대로)
- 프로덕션 스모크 통과 (랜딩 200/CTA 204/waitlist 201/OG 렌더), 테스트 데이터 정리 완료 (테이블 0행)
- `lib/contracts/domain.ts` 선커밋: Senior/Schedule/CallSession/CallTurn/CallReport zod 스키마 + 상태 라벨 + MEDICAL_DISCLAIMER

### 완료 (Phase 2 코드 — 2026-07-06)
- **데이터 계층** (data-api, reviewer PASS, 머지 8d1dd1b):
  - `supabase/migrations/0002_guardians_seniors_schedules.sql`: guardians/seniors/schedules + RLS(guardian_id = auth.uid() 격리) + 동의 트리거(미동의 active 차단, 동의 철회 시 일정 자동 OFF) + auth.users→guardians 자동 생성(security definer, search_path 고정)
  - Auth: `@supabase/ssr` 서버/브라우저 클라이언트, `middleware.ts`(/app/* 가드→/login), magic link(`/api/auth/confirm` verifyOtp token_hash 방식), 로그아웃
  - CRUD server actions: `lib/actions/seniors.ts`·`schedules.ts` (zod 검증, RLS 클라이언트 경유, admin 미사용, 동의 이중 방어), 조회 `lib/db/queries.ts`
  - `lib/scheduling/occurrences.ts`: RRULE→다음 발신 시각, Asia/Seoul 명시(rrule UTC 함정 우회 — FREQ/BYDAY만 파싱 후 fromZonedTime), 유닛 테스트 18개
  - **지원 RRULE 범위: `FREQ=DAILY` / `FREQ=WEEKLY;BYDAY=...` 만** (그 외 InvalidRruleError — 폼도 이 두 형태만 생성)
- **UI 결합** (ui-builder, reviewer PASS, 머지됨):
  - `/login` 신규(magic link 폼), 대시보드 오늘 일정→`getTodayCallInstances()` 실데이터, seniors/schedules CRUD 폼·토글 실연결(낙관적 갱신+원복), 설정에 이메일+로그아웃, 빈 상태 UI
  - mock 잔존(Phase 3 범위, "예시 데이터" 라벨 부착): `/app/calls`(+상세), `/app/reports`, 대시보드 주간 이행률·최근 통화 결과
- 통합 main: `npm test` 27/27, 빌드 통과(Middleware 포함)
- ⚠️ **미검증**: 실제 Supabase 대상 동작 — 아래 수동 작업 완료 후 스모크 필요

### 다음 할 일
1. ~~0002 마이그레이션 실행~~ ✅ 완료 (사용자, SQL Editor)
2. ~~Auth URL 설정~~ ✅ 완료 (Site URL=localhost:3000(임시)·Redirect URLs 2종)
   - ⚠️ **이메일 템플릿 수정은 불가** — 2026-06부터 신규 무료 프로젝트는 기본 메일 제공자로 템플릿 편집 차단 → 콜백에 PKCE `?code=` 교환 경로 추가로 대응(0e98533, 기본 ConfirmationURL 템플릿 그대로 동작. token_hash 경로도 유지). PKCE 한계: 메일을 **요청한 브라우저에서** 링크를 열어야 함
3. 로컬 스모크: /app→/login redirect → 메일 로그인 → 피보호자 등록(동의) → 일정 등록 → 토글 ON → 대시보드 오늘 인스턴스 표시 확인 → **Phase 2 완료 판정**
4. 스모크 후: Site URL을 `https://voicescheduler.vercel.app`으로 원복 + Vercel 배포
5. **베타 공개 전 커스텀 SMTP 연결 필수** — 무료 기본 메일은 프로젝트 전체 시간당 2통 제한. SMTP 연결 시 30통/h + 템플릿 편집 재개방(도메인 없으면 Brevo 단일 발신자 인증 또는 Gmail 앱 비밀번호)
6. Phase 3 (벤더 비교 선행 결정 필요 — PLAN 3-0)

### 완료 (Phase 1 — 2026-07-06)
- 보호자 웹 전 화면 mock 완성 (ui-builder): `/app`(대시보드)·`/app/seniors`(동의 체크박스 폼)·`/app/schedules`(ON/OFF 토글+RRULE 폼)·`/app/calls`+`[id]`(전사 타임라인)·`/app/reports`(MEDICAL_DISCLAIMER 고정)·`/app/settings`
- 공통: `components/app/` StatusBadge(6종 뱃지)·AppNav(모바일 탭바+데스크톱 사이드)·format.ts(KST 문자열 포맷, Date 연산 없음)
- reviewer FAIL 1건(fmtRrule 유닛 테스트 누락) → ui-builder가 format.test.ts 추가(9 테스트, 요일 정렬 버그 발견·수정) → `npm test` exit 0, 빌드 21라우트 통과
- **Phase 1 완료 기준 충족: 로그인 없이 mock으로 전 화면 클릭 가능**

### 완료 (로그인 개선 1/2 — 2026-07-06 밤)
- **첫 실사용 피드백 2건 접수**: ① 대시보드에서 클릭 안 되는 요소들(오늘의 일정 카드 링크 없음 + mock 섹션이 고장처럼 보임) ② magic link 로그인 이상함 — dev 로그로 원인 확정: 첫 시도 `pkce_code_verifier_not_found` 실패했는데 `/login?error=expired_link` 파라미터를 로그인 페이지가 **읽지도 표시하지도 않음** (조용한 실패)
- **결정: 이메일+비밀번호를 주 로그인으로 전환** (사용자 선택). magic link는 "비밀번호 분실 시 메일 로그인" 보조로 유지 → 별도 재설정 플로우 불필요 (로그인 후 설정에서 비밀번호 변경)
- **데이터 계층 완료** (reviewer PASS, 머지됨): `lib/actions/auth.ts`에 `signUpWithPassword`/`signInWithPassword`/`updatePassword` 추가. zod 8~72자, 에러 한국어 매핑(`lib/actions/auth-validation.ts`, 21 유닛 테스트), PII 무로깅. guardians 자동 생성은 기존 DB 트리거가 signUp에도 적용됨(확인 완료). 총 테스트 61개.
- ui-builder가 쓸 시그니처: `signUpWithPassword(fd: email,password,password_confirm)` → `{ok:true;message;session:boolean}|{ok:false;error}` (session=true면 즉시 /app 이동, false면 "확인 메일" 안내) / `signInWithPassword(fd: email,password)` / `updatePassword(fd: password,password_confirm)` — 모두 `AuthActionResult` 반환

### 완료 (로그인 개선 2/2 — 2026-07-07, reviewer PASS·머지됨)
- ui-builder(`feat/ui-password-login`, 커밋 3개) → reviewer PASS → main 머지, 머지 후 `npm test` 65/65:
  - `/login` 개편: 이메일+비밀번호 로그인/회원가입 탭 전환 폼, signUp `session:true`→/app·false→확인 메일 안내, "비밀번호를 잊으셨나요? 메일로 로그인" 접힌 보조 폼(sendMagicLink), **`?error=expired_link|invalid_link|기타` 한국어 경고 배너**(`components/app/login-messages.ts` 순수 함수 + 테스트 4개, XSS 없음 — 고정 문자열만 렌더)
  - 대시보드: 오늘의 일정 카드→`/app/schedules` 링크화, mock 섹션(이행률·최근 통화) 비클릭 명확화+"실제 통화가 시작되면 채워집니다"
  - `/app/settings`: 비밀번호 변경/최초 설정 폼(`updatePassword`)
  - 접근성: role=alert/status, 탭 aria-selected, 제출 중 disabled
- reviewer non-blocking 메모: 이모지(📬)는 디자인 확정 시 아이콘으로 교체 검토 / login page searchParams 타입이 배열 케이스(`?error=a&error=b`) 미고려(실사용 영향 미미)

### 진행 중 (Phase 2 스모크 — 2026-07-07~08)
- **사용자 계정에 임시 비밀번호 설정 완료** (오케스트레이터가 admin API로): spacetr17@khu.ac.kr / `ansim-beta-0707` — API 로그인 검증 통과. 사용자는 로그인 후 설정에서 변경 권장
- 로컬 스모크 진행 중: 로그인→대시보드→일정 이동까지 확인됨. **피보호자 등록(동의)→일정 등록→토글 ON→대시보드 오늘 인스턴스 표시**는 사용자 확인 대기 → 완료 시 Phase 2 완료 판정
- ⚠️ **Windows dev 서버 이슈 1회**: `.next` 캐시 파일 깨짐(errno -4094)으로 전 요청 실패 → `.next` 삭제+재시작으로 복구. 재발 시 동일 조치, 반복되면 백신 예외 등록 검토
- 이번에 클릭해보며 나온 개선 요청은 이 파일에 추가 기록할 것

### 다음 할 일
1. ~~Supabase "Confirm email" 토글 OFF~~ ✅ 완료 (2026-07-10, 사용자 수동 → API로 `mailer_autoconfirm: true` 반영 확인. 나중에 SMTP 연결 후 ON 전환 가능)
2. 스모크 통과 확인 → Site URL 원복(`https://voicescheduler.vercel.app`) → **Vercel 배포** (admin 대시보드 개편 + 비밀번호 로그인 — 프로덕션은 아직 구버전)
3. **Phase 3 진입 (배포 후)**: 벤더 비교(국내 CPaaS vs CLOVA AiCall, PLAN 3-0 — 사용자 결정 필요)와 무관하게 MockAdapter로 파이프라인(발신 스케줄러→call_sessions 상태 기계→LLM 분류·리포트→calls/reports 화면 실연결) 선개발 가능
4. 디자인은 토큰 교체만으로 전체 반영되는 구조 확인 — 확정값 대기, 기능 개발 블로킹 아님
- **CTA 운영 정비 (2026-07-06 저녁, reviewer PASS·머지됨)**: `USER_CHECK.md` 신설(유포용 utm 링크 규칙·데이터 설명·열람 방법 — utm_source=test 규칙 포함) + `/admin/metrics` 한글 대시보드 전면 개편(요약 카드·퍼널 설명·채널 표·일별 추이·최근 활동·대기자 마스킹, test 유입 집계 제외, KST 명시, lib.test.ts 13케이스). 총 테스트 40개. **프로덕션 미배포 — Phase 2 스모크 후 함께 배포.**

### 기타 대기 항목
1. 디자인 토큰 확정값 오면 globals.css 교체 (Phase 1 항목 4)
2. ADMIN_PASSWORD(vs-beta-2026) 설문 배포 전 변경 권장

### 결정사항
- **스택 버전 (호환성 우선, 메이저 업그레이드는 오케스트레이터 승인 필요)**:
  - Next.js **14.2.x** + React **18.3** (App Router) — Supabase SSR·생태계와 가장 검증된 조합
  - Tailwind CSS **3.4** (v4는 설정 체계가 달라 보류) — 토큰은 CSS 변수 → `tailwind.config.ts`에서 참조
  - zod 3.x / date-fns 3.x + date-fns-tz 3.x / rrule 2.8 / @supabase/supabase-js 2.x + @supabase/ssr / vitest 2.x
- **Supabase**: project id `hcygbbbbzfpgucqkmxav` (URL: `https://hcygbbbbzfpgucqkmxav.supabase.co`) — 사용자 보유 확인
- **가격 티저 (잠정, 오케스트레이터 결정 — 상수 분리로 교체 용이)**:
  - 베타 기간: **무료**
  - 정식 출시 예상가: **월 9,900원** (1일 1회 안부·복약 전화 기준) — "베타 신청 시 정식 출시 후 첫 달 무료" 훅
  - 위치: `lib/contracts/pricing.ts` 상수로 분리 (UI는 import만)

### 블로커
- **Supabase anon key + service role key 필요** — 사용자가 대시보드(Settings → API)에서 복사해 `.env.local`에 넣어야 CTA 실데이터 저장 가능. 그 전까지 UI·스키마 파일은 로컬에서 완성 가능.
