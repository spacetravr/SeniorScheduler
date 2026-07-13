---
name: smoke
description: 핵심 플로우 스모크 테스트. 발동 조건 — 사용자가 "스모크 돌려줘"·"스모크 테스트"라고 요청할 때, vercel 프로덕션 배포 직후 검증할 때(/smoke prod), 기능 브랜치를 main에 머지한 뒤 동작 확인할 때, /ship 스킬의 배포 후 검증 단계에서 호출될 때. 인자 "prod"면 프로덕션(https://seniorscheduler.vercel.app), 없으면 로컬 dev(http://localhost:3000) 대상.
---

# /smoke — 핵심 플로우 스모크 테스트

랜딩·사전등록·CTA 추적·(로컬 한정) 인증 플로우를 검증하고 통과/실패 체크리스트를 출력한다.

## 1. 대상 결정
- 인자가 `prod` → `BASE=https://seniorscheduler.vercel.app`
- 그 외 → `BASE=http://localhost:3000`. `curl -s -o /dev/null -w "%{http_code}" $BASE`가 200이 아니면 `npm run dev`를 **백그라운드로 기동**하고 200이 될 때까지 대기(최대 60초).

## 2. 실행 방식 결정
- `mcp__playwright__*` 도구가 사용 가능하면 → 브라우저 실조작으로 §3 공개 플로우 + §4 인증 플로우 수행.
- 없으면 → curl/REST 수준으로 §3만 수행하고, §4는 수동 확인 절차를 안내 출력.

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

## 4. 인증 플로우 (로컬 전용)
> ⚠️ **프로덕션에서는 절대 수행 금지.** 프로덕션 계정 자격증명을 브라우저 자동화에 넣지 말 것 — 테스트 전용 계정만 사용 (PROGRESS.md 도구 로드맵 A-1 경고). `prod` 인자면 이 섹션은 건너뛰고 "로컬에서 별도 수행 필요"로 표기.

Playwright MCP로 순서대로:
1. `/login` → 테스트 계정 이메일+비밀번호 로그인 → `/app` 진입 확인
2. `/app/seniors` → 피보호자 등록 (**동의 체크박스 필수 체크**) → 목록 표시 확인
3. `/app/schedules` → 일정 등록 (FREQ=DAILY 또는 WEEKLY;BYDAY 형태만 지원됨)
4. 발신 토글 **ON** (낙관적 갱신 후 유지되는지 확인)
5. `/app`(대시보드) → 오늘의 일정에 방금 등록한 인스턴스 표시 확인

Playwright 없으면 위 5단계를 수동 확인 절차로 출력하고 종료.

## 5. 결과 출력
통과/실패 체크리스트로 정리:
```
[PASS/FAIL] / 200 + 핵심 요소
[PASS/FAIL] /preregister 200
[PASS/FAIL] POST /api/cta 204
[PASS/FAIL] POST /api/waitlist 201
[PASS/FAIL] 테스트 행 삭제 (cta_events, waitlist)
[PASS/FAIL] /admin/metrics 200 (pw 마스킹)
[PASS/FAIL/SKIP] 인증 플로우 5단계 (로컬 전용)
```
실패 시 **어떤 단계에서 기대값 대비 무엇이 달랐는지**(상태 코드·응답 바디·누락 요소) 명시. 이메일·비밀번호 등 PII/시크릿은 출력에 포함 금지.
