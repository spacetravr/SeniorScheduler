---
name: smoke
description: 핵심 플로우 스모크 테스트. 발동 조건 — 사용자가 "스모크 돌려줘"·"스모크 테스트"라고 요청할 때, vercel 프로덕션 배포 직후 검증할 때(/smoke prod), 기능 브랜치를 main에 머지한 뒤 동작 확인할 때, /ship 스킬의 배포 후 검증 단계에서 호출될 때. 인자 "prod"면 프로덕션(https://seniorscheduler.vercel.app), 없으면 로컬 dev(http://localhost:3000) 대상.
---

# /smoke — 핵심 플로우 스모크 테스트

랜딩·사전등록·CTA 추적·**신규 가입 첫 진입(빈 상태)**·(로컬 한정) 인증 플로우를 검증하고 통과/실패 체크리스트를 출력한다.

## 1. 대상 결정
- 인자가 `prod` → `BASE=https://seniorscheduler.vercel.app`
- 그 외 → `BASE=http://localhost:3000`. `curl -s -o /dev/null -w "%{http_code}" $BASE`가 200이 아니면 `npm run dev`를 **백그라운드로 기동**하고 200이 될 때까지 대기(최대 60초).

## 2. 실행 방식 결정
- `mcp__playwright__*` 도구가 사용 가능하면 → 브라우저 실조작으로 §3 공개 플로우 + §4 신규 가입 빈 상태 + §5 인증 플로우 수행.
- 없으면 → curl/REST 수준으로 §3만 수행하고, §4·§5는 수동 확인 절차를 안내 출력.

## 3. 공개 플로우 (프로덕션 허용)
1. **랜딩**: `GET $BASE/` → 200 + 응답 HTML에 핵심 요소 렌더 확인(서비스명 "Senior Scheduler", [사전등록하기] CTA, 의료 미제공 고지).
2. **사전등록 페이지**: `GET $BASE/preregister?utm_source=test` → 200.
3. **CTA 추적 API E2E**: 새 UUID 생성(`SID`) 후
   ```
   POST $BASE/api/cta
   body: {"type":"CLICK_TRY","session_uuid":"<SID>","utm_source":"test"}
   ```
   → **204** 기대 (계약: `lib/contracts/cta.ts`).
4. **waitlist API E2E**: 테스트용 이메일(예: `smoke-<타임스탬프>@test.invalid`)로
   ```
   POST $BASE/api/waitlist
   body: {"email":"<테스트 이메일>","session_uuid":"<SID>","utm_source":"test"}
   ```
   → **201 {"ok":true}** 기대.
   - ⚠️ 반드시 `utm_source=test` + 테스트용 이메일만 사용 (test는 지표 집계에서 제외되지만, 실이메일·실채널 값 금지).
5. **테스트 행 삭제 (필수 — 청소 원칙)**: 검증 직후 `.env.local`의 `SUPABASE_SECRET_KEY`로 Supabase REST DELETE:
   ```
   DELETE https://hcygbbbbzfpgucqkmxav.supabase.co/rest/v1/cta_events?session_uuid=eq.<SID>
   DELETE https://hcygbbbbzfpgucqkmxav.supabase.co/rest/v1/waitlist?session_uuid=eq.<SID>
   헤더: apikey: <SECRET> / Authorization: Bearer <SECRET>
   ```
   삭제 실패도 스모크 실패로 기록한다(다음 실행 오염 방지).
6. **admin 지표**: `GET $BASE/admin/metrics?pw=<ADMIN_PASSWORD>` → 200 + 지표 페이지 렌더 확인. `ADMIN_PASSWORD`는 `.env.local`에서 읽되 **값 자체를 출력·로그에 절대 노출하지 말 것** (URL 출력 시 `?pw=***`로 마스킹).

## 4. 신규 가입 첫 진입 — 빈 상태(empty state) 검증 ⭐ 프로덕션에서도 수행

> **왜 있는가 (2026-07-31 사고)**: 기존 계정으로만 로그인해 스모크를 돌린 탓에, **통화 기록 0건인
> 신규 가입자가 `/app` 에서 100% 500 에러**를 맞는 버그(`buildDigest` 빈 배열 → Invalid Date)가
> 프로덕션까지 갔다. 기존 계정은 리포트 160건이 있어 이 분기를 영원히 밟지 않는다.
> **빈 상태는 신규 계정으로만 재현된다 — 이 섹션을 건너뛰지 말 것.**

Playwright MCP 필요. 없으면 SKIP 으로 표기하고 수동 절차를 안내한다.

1. **일회용 계정 생성**: 이메일 `smoke-signup-<타임스탬프>@test.invalid`, 비밀번호는 매 실행 새로 생성한 8자 이상 임의 문자열.
   `/login` → [회원가입] 탭 → 이메일·비밀번호·비밀번호 확인 입력 → 제출.
   → **`/app/onboarding` 으로 이동**하면 PASS (가입 즉시 세션 발급 = `mailer_autoconfirm` ON 전제).
2. **온보딩 이탈 경로 2종** — 실행마다 번갈아 가며 최소 1종, 여유 있으면 둘 다:
   - (a) 5문항 모두 응답 → [시작하기]
   - (b) [건너뛰기] 즉시 클릭
   → 둘 다 `/app` 에 도달해야 한다.
3. **빈 상태 전 라우트 렌더 (핵심)**: 이 계정으로 아래 **7개 라우트를 전부** 방문해 정상 렌더 확인.
   `/app` · `/app/seniors` · `/app/schedules` · `/app/calls` · `/app/reports` · `/app/settings` · `/app/billing`
   - 하나라도 `Application error` / `server-side exception` 문구가 보이면 **즉시 FAIL** 하고 그 라우트를 보고한다.
   - `/app` 은 "시작 안내" 4단계 카드, `/app/reports` 는 "아직 통화 리포트가 없습니다" 가 나오는 게 정상.
   - 잔여 크레딧 배지가 **120** 으로 보이는지 확인(가입 보너스 지연 적립 동작).
4. **콘솔 에러 0건**: `mcp__playwright__browser_console_messages` (level=error) 로 확인. 0건이 아니면 FAIL.
5. **계정 삭제 (필수 — 청소 원칙)**: `.env.local` 의 `SUPABASE_SECRET_KEY` 로
   ```
   GET    <SUPABASE_URL>/auth/v1/admin/users?filter=<테스트 이메일>   → id 추출
   DELETE <SUPABASE_URL>/auth/v1/admin/users/<id>
   헤더: apikey: <SECRET> / Authorization: Bearer <SECRET>
   ```
   `guardians` 행은 FK cascade 로 함께 지워진다. 삭제 후 `guardians?select=email` 로 **실계정만 남았는지 확인**.
   삭제 실패는 스모크 FAIL (실사용자 지표·이행률 오염 방지).

> ⚠️ 실이메일·실도메인 금지(`@test.invalid` 고정). 생성한 비밀번호를 출력·로그에 남기지 말 것.

## 5. 인증 플로우 (로컬 전용)
> ⚠️ **프로덕션에서는 절대 수행 금지.** 프로덕션 계정 자격증명을 브라우저 자동화에 넣지 말 것 — 테스트 전용 계정만 사용 (PROGRESS.md 도구 로드맵 A-1 경고). `prod` 인자면 이 섹션은 건너뛰고 "로컬에서 별도 수행 필요"로 표기.

Playwright MCP로 순서대로:
1. `/login` → 테스트 계정 이메일+비밀번호 로그인 → `/app` 진입 확인
2. `/app/seniors` → 피보호자 등록 (**동의 체크박스 필수 체크**) → 목록 표시 확인
3. `/app/schedules` → 일정 등록 (FREQ=DAILY 또는 WEEKLY;BYDAY 형태만 지원됨)
4. 발신 토글 **ON** (낙관적 갱신 후 유지되는지 확인)
5. `/app`(대시보드) → 오늘의 일정에 방금 등록한 인스턴스 표시 확인

Playwright 없으면 위 5단계를 수동 확인 절차로 출력하고 종료.

## 6. 결과 출력
통과/실패 체크리스트로 정리:
```
[PASS/FAIL] / 200 + 핵심 요소
[PASS/FAIL] /preregister 200
[PASS/FAIL] POST /api/cta 204
[PASS/FAIL] POST /api/waitlist 201
[PASS/FAIL] 테스트 행 삭제 (cta_events, waitlist)
[PASS/FAIL] /admin/metrics 200 (pw 마스킹)
[PASS/FAIL/SKIP] 신규 가입 → 온보딩 → /app 진입
[PASS/FAIL/SKIP] 빈 상태 앱 7개 라우트 렌더 + 콘솔 에러 0
[PASS/FAIL/SKIP] 일회용 계정 삭제 (실계정만 잔존 확인)
[PASS/FAIL/SKIP] 인증 플로우 5단계 (로컬 전용)
```
실패 시 **어떤 단계에서 기대값 대비 무엇이 달랐는지**(상태 코드·응답 바디·누락 요소) 명시. 이메일·비밀번호 등 PII/시크릿은 출력에 포함 금지.
