# PROGRESS.md — 세션 인수인계 로그

> **규칙**: 컨텍스트 compact 임박 또는 큰 작업 단위 완료 시 이 파일을 갱신하고 `/clear`.
> 새 세션은 CLAUDE.md → PLAN.md → 이 파일 순으로 읽고 재개.
> 최신 항목이 **위**. 형식: 완료 / 진행 중 / 다음 할 일 / 결정사항 / 블로커.

---

## 2026-07-15 — 세션 #7: 배포 + CONSENT 트리거 + 앱 디자인 폴리시 2차 + 첫 화면 UX 피드백

### 완료
- **프로덕션 배포 2회** (`vercel deploy --prod`): ① 세션 #6 미배포분(통화 화면 실데이터+웜 팔레트) ② 아래 통합분. 두 번 모두 프로덕션 스모크 전 항목 PASS (랜딩·preregister·login·/app 307·CTA 204·waitlist 201·테스트행 삭제·admin 200·디스패치 무인증 POST 401)
- **CONSENT 콜 자동 트리거** (data-api worktree → reviewer PASS → 머지 613171f): 대리동의 등록/토글 시 CONSENT 세션 자동 예약(`lib/calls/consent-scheduling.ts`+테스트 17개, seniors.ts는 admin 클라이언트 예외 — call_sessions 서버 전용 write 설계 유지), dispatch-calls에 CONSENT 블록(성사 시 self_consent_at 기록, call_reports 미생성), 0004 마이그레이션(senior당 열린 CONSENT 1개 부분 unique). vitest `.claude/worktrees/**` exclude 포함
- **앱 내부 디자인 폴리시 2차** (ui-builder worktree → reviewer PASS → 머지 5f1bc17): 전 앱 화면 카드 shadow-card·border-border 토큰 통일, 이모지→lucide 아이콘(AppNav 5종·EmptyState LucideIcon prop·리포트 플래그·📬→MailCheck). lucide-react@1.24.0 도입
- **첫 화면 UX 피드백 반영** (사용자: "등록하는 란이 첫 화면에 없다" — 패스트트랙 6e084fb): 대시보드에 피보호자/일정 등록 퀵 액션 상시 노출(0명 아니어도), 모바일 상단 Senior Scheduler 브랜드 헤더 신설(BrandWordmark 공용화, 랜딩과 동일 타이포)
- 통합 main: tsc·**테스트 156/156**·빌드 통과, push 완료. **프로덕션 = main 동기화 상태**

### ⚠️ 사용자/후속 액션
- ~~0004 마이그레이션 SQL Editor 실행~~ ✅ 완료 (2026-07-15, 사용자 실행)
- **랜딩 헤더에 로그인 링크 추가·배포됨** (6de355b — 사용자 "실서비스 진입 경로" 요청). ⚠️ 로그인 페이지에 회원가입 탭이 열려 있어 설문 유입 방문자도 계정 생성해 앱 진입 가능 — 유지/차단은 사용자 결정 대기
- **Mock 파이프라인 E2E 시연 보류**: 프로덕션 DB에 동의 시각 합성 삽입이 권한 차단됨(타당) → 사용자 승인 시 직접 삽입(A) 또는 CONSENT 트리거 머지됐으니 실제 앱 플로우 경유(B — 권장, 0004 실행 후)
- call-dispatch 워크플로는 여전히 **disabled** (사용자 지시 유지). CONSENT 트리거도 디스패치가 꺼져 있으면 세션만 쌓이고 발신 안 됨 — E2E 시 enable 필요
- git stash 1건 존재 (ui 에이전트가 메인 트리에 남긴 package.json 변경 — 브랜치 커밋본과 동일해 stash 처리, drop 가능)
- CONSENT MISSED 시 자동 재예약 없음(대리동의 재토글로 재예약) / 열린 CONSENT 세션 취소 상태(enum) 미도입 — 후속 검토

### 교훈
- ui-builder가 worktree 밖(메인 트리)에서 npm install 실행해 package.json 로컬 변경 발생 → 머지 블록. **worktree 에이전트 지시문에 "npm install도 worktree 안에서" 명시할 것**

---

## 2026-07-15 — 세션 #6: ign8t·파운더리 종합 + Phase 3 통화 파이프라인(Mock) 완성

### 완료
- **ign8t MCP 연동** (local scope, `~/.claude.json` — 키 비커밋. 세션 재시작 후 도구 로드, 그 전엔 stdio 직접 호출 스크립트로 사용). Spec 4종+백로그 확인, 완료된 UI 태스크 3건 done 동기화
- **파운더리 분석 수확**: ⚠️ **전기통신사업법 자동발신 규제**(우리 문서에 없던 유일한 중대 리스크) → 동의 콜 설계로 반영. 이중 KPI(자녀 NPS↔부모 수락률), Status Quo 마케팅 프레이밍(랜딩 카피 후보). 파운더리 생성 코드(케어콜)는 검토 후 이식 불가 판정(스택 충돌·핵심 부재) — 디자인 시안으로만 보존
- **Phase 3 완성** (data-api → reviewer PASS → 머지 c0cca22): 0003 마이그레이션(통화 3테이블+self_consent_at+RLS) / TelephonyAdapter+MockAdapter(결정적 시나리오) / 분류기(DTMF→키워드 룰→LLM→UNCERTAIN, eval 케이스 포함) / 상태 기계·재시도(1분/10분→MISSED) / 동의 콜(CONSENT) 엔진 / cost_krw 합산 / cron 라우트(CRON_SECRET)+GitHub Actions 5분 주기(공개 repo라 분량 무료, 시크릿 미등록 시 조용히 재시도)
- **동의 상태 UI** (ui-builder → reviewer PASS → 머지 1348ccc): 피보호자 카드 3단계 뱃지(동의 필요/본인 동의 대기/동의 완료)+폼 안내+대시보드 배너. DB 컬럼 없어도 안전(nullish)
- 통합 main: tsc·**테스트 134/134**·빌드 통과 (테스트 수 기준선: 71→134)
- ⚠️ 병렬 에이전트 사고 예방 1건: 같은 워킹트리에서 ui-builder가 브랜치 전환 → data-api 미커밋 작업물 노출. SendMessage로 커밋 절차 지시해 무사고 수습. **다음부터 병렬 에이전트는 git worktree 격리 필수**

### ✅ 배포 완료 (2026-07-15 오후)
- 0003 마이그레이션 적용 확인(사용자 실행, REST로 테이블·컬럼 검증) → CRON_SECRET·DISPATCH_URL 등록(오케스트레이터가 gh/vercel CLI로 처리, .env.local에도 CRON_SECRET 추가) → `vercel deploy --prod` → **프로덕션 스모크 전 항목 PASS** (랜딩·preregister·CTA 204·waitlist 201·테스트행 삭제·admin 200·디스패치 무인증 401)
- **⚠️ call-dispatch 워크플로는 `disabled_manually` 상태** (사용자 지시: "전화 기능 제외하고 배포") — Mock 발신이 프로덕션에서 돌지 않음. E2E 시작 시 `gh workflow enable call-dispatch.yml` 한 줄로 재활성화
- 신형 sb_secret 키 주의: REST 호출 시 `apikey` 헤더만 사용 (`Authorization: Bearer`에 넣으면 JWT 파싱 실패로 401)

### 완료 (세션 #6 후반 — 병렬 2레인 + 디자인)
- **통화 화면 실데이터 전환** (ui-builder → reviewer FAIL→수정→PASS → 머지 20f3d9c): /app/calls·[id]·/app/reports·대시보드 mock 제거, 동의 콜 라벨·DTMF 표기·빈 상태 3종. **중대 버그 수정 포함**: Supabase가 UTC(+00:00)로 반환하는데 format.ts가 KST 문자열 가정 슬라이싱 → 실데이터에서 전 시각 9h 밀림·자정경계 날짜 오버킷팅. date-fns-tz `formatInTimeZone("Asia/Seoul")` 기반으로 재구현+`kstYmd()` 헬퍼, 자정 경계 테스트 추가 (admin/metrics는 원래 정상 확인)
- **디자인 토큰 확정** (ui-builder worktree 격리 → reviewer PASS → 머지 dfb1f87): 웜 팔레트(#FBF7F0 bg / #1E3A5F primary / #C2410B 테라코타 accent / radius 14px / shadow-card), 전 조합 WCAG AA 검증. 랜딩·사전등록·로그인 카드 폴리시(스타일만). CLAUDE.md 토큰 섹션 확정값으로 동기화됨
- 통합 main: tsc·**테스트 139/139**·빌드 통과. **⚠️ 이 분량은 아직 프로덕션 미배포** (main에만 머지됨)
- worktree 격리 병렬이 정상 작동 (충돌 0). 단 worktree가 저장소 내부(.claude/worktrees)에 생겨 vitest 이중 집계 — worktree 제거로 해소, vitest exclude 추가는 후속 과제

### 현재 상태 스냅샷 (세션 #6 종료 시점 — 다음 세션은 여기부터)
- **main(de27fa9) = 통화 파이프라인(Mock)+동의 UI+통화 화면 실데이터+새 디자인 전부 머지·push 완료. 테스트 139/139.**
- **프로덕션은 중간 시점(f84ca83) 버전**: 파이프라인+동의 UI까지만 반영됨. **통화 화면 실데이터+새 디자인(웜 팔레트)은 미배포** — 배포는 사용자 승인 대기
- 준비 완료 상태: 0003 마이그레이션 적용됨(REST 검증) / CRON_SECRET·DISPATCH_URL 등록됨 / **call-dispatch 워크플로 disabled_manually** (사용자 지시로 발신 꺼둠 — E2E 시 `gh workflow enable call-dispatch.yml`)
- ign8t MCP는 local scope 등록됨 — **다음 세션부터 도구 자동 로드** (이번 세션은 stdio 직접 호출 스크립트로 사용했음)
- gh CLI 인증: `git credential fill`(protocol=https/host=github.com를 파일로 stdin 리다이렉트)로 GCM 토큰 꺼내 GH_TOKEN에 주입하는 방식 사용

### 다음 할 일 (우선순위순)
1. **배포** (사용자 "배포해줘" 시): `vercel deploy --prod` → /smoke prod → 새 디자인·통화 화면 확인 → 색감 피드백 있으면 globals.css 토큰 값만 조정
2. **Mock 파이프라인 E2E 시연** (원하면): call-dispatch enable → 테스트 일정 ON → 디스패치 → /app/calls·/app/reports에 실데이터 표시 확인 → 데이터 정리 → 다시 disable
3. **CONSENT 콜 자동 트리거 연결** (피보호자 등록 직후 동의 콜 예약 — 엔진 있음, 디스패치 연결만. data 레인)
4. **앱 내부 디자인 폴리시 2차** (통화 화면 머지로 이제 가능): components/app에 shadow-card·border 토큰 적용, 이모지→lucide 아이콘 검토
5. vitest.config.ts에 `.claude/worktrees/**` exclude 추가 (worktree 병렬 시 이중 집계 방지 — 1줄, data 레인)
6. (선택) ANTHROPIC_API_KEY — 없어도 룰 분류로 동작(현 기본) / 랜딩 Status Quo 카피(사용자 승인 대기)
7. [사용자] ign8t 기획 수정(FastAPI→Next.js 풀스택/네이티브 앱→모바일 웹/동의 콜 태스크 추가), 전기통신사업법 자문(실발신 전 필수), **계정 임시 비밀번호 변경**(세션 #4 로그에 평문 기록돼 있고 저장소가 공개임 — /app/settings에서 변경)
8. 기존 대기 항목: 링크 배포(설문·카페), Analytics Enable 확인, ADMIN_PASSWORD 변경

### 결정사항
- **v2 별도 트랙 폐기 → 기존 웹 통합** (2026-07-15 사용자): ign8t 백로그를 기존 저장소 로드맵에 매핑. SECOND-PLAN.md 「최종 결정」이 상세 기록
- **파운더리 역할 = 분석·시안 생성기** (코드 본선은 이 저장소). 케어콜 팔레트(#F5EFE6/#1E3A5F/#5B9BD5)·lucide 아이콘·KPI 카드 패턴은 디자인 확정 시 입력값
- **테스트 실행 정책** (사용자 지시, CLAUDE.md 명문화): 브랜치 완료 시 / reviewer 머지 게이트 / 배포 전 스모크 3지점만. 작성 의무 유지
- **모델 배분 재확인** (사용자 지시): 오케스트레이터=Fable, ui/data=Opus 4.8, reviewer=Sonnet (기존과 동일)
- 실발신 정책: consent_at(대리)+self_consent_at(본인) 둘 다 필요. 녹음 정책 절충(UNCERTAIN 클립 저장 여부)은 실발신 전 결정 항목
- 랜딩 Status Quo 카피 적용은 사용자 승인 대기 중

### 블로커
- 없음 (배포만 0003 실행에 종속)

---

## 2026-07-13 — 세션 #5: 도구·자동화 A항목 + 일일 지표 리포트 (병렬 에이전트 3개로 수행)

### 완료
- **일일 지표 리포트 자동화 (사용자 요청)**: `.github/workflows/daily-report.yml` + `.github/scripts/daily-report.mjs` — 매일 **09:00 KST**(cron `0 0 * * *` UTC) Supabase에서 퍼널(VIEW→CLICK_TRY→WAITLIST_SUBMIT)·채널별·waitlist 집계 → GitHub Issue 발행(라벨 daily-report, 기존 열린 이슈 자동 close) → **소유자에게 GitHub 알림 메일** (uptime.yml과 동일 경로). email(PII) 미조회, test 제외, 집계 정의는 admin/metrics lib.ts와 일치. workflow_dispatch 수동 실행으로 E2E 검증 완료 (이슈 #1 발행 확인)
- **GitHub Actions 시크릿 등록**: SUPABASE_URL, SUPABASE_SECRET_KEY (gh CLI 2.96 winget 설치 + git credential manager의 OAuth 토큰으로 인증)
- **도구 로드맵 A항목**: ① Playwright MCP `.mcp.json` 등록 (⚠️ 다음 세션 재시작부터 로드됨) ② `/smoke` 스킬 (공개 플로우는 prod 허용·test 데이터 청소 포함, 인증 플로우는 로컬 전용) ③ `/ship` 스킬 (reviewer→머지→테스트→push→vercel prod→스모크→PROGRESS 리마인드) ④ **Vercel Web Analytics** `@vercel/analytics@2.0.1` 루트 레이아웃 `<Analytics />` (import 경로 `@vercel/analytics/next`, 설치는 --legacy-peer-deps 필요했음)
- reviewer PASS (머지 c365f4c → main push) + `vercel deploy --prod` 배포
- ⚠️ 사고·복구 2건 (결과 무손실): ① reviewer가 검토 중 `git checkout 3dda1 -- .`로 워킹트리 일시 되돌림 → 바이트 단위 복원 확인 ② 오케스트레이터가 PowerShell Set-Content로 daily-report.mjs 한글 인코딩 깨뜨림 → UTF-8 전체 재작성 후 실행 재검증

### 발견사항 (다음 작업에 중요)
- **셀프 테스트 데이터가 이미 존재**: cta_events 방문 3·클릭 2·제출 2, waitlist 2 (2026-07-12, **utm_source 전부 null=직접 유입** — `?utm_source=test` 링크가 아니라 일반 주소로 테스트한 것으로 보임). 다음 할 일 1번(확인 후 초기화)에서 처리할 것
- **테스트 개수 정정**: 실제 스위트는 **6파일 72개** (reviewer가 vitest 파일 목록으로 확인). 세션 #4의 "209/209"는 오기

### 다음 할 일 (사용자 수동 2건 포함)
1. **Vercel 대시보드에서 Web Analytics Enable** (사용자 수동: vercel.com → seniorscheduler 프로젝트 → Analytics 탭 → Enable. 코드는 배포됨, 반영까지 ~1h)
2. **일일 리포트 메일 수신 확인** (사용자: GitHub 알림 메일함 확인 — 안 오면 github.com/settings/notifications에서 Participating/Watching 이메일 켜기)
3. 이후 기존 우선순위 그대로: 셀프테스트 확인·초기화 → ADMIN_PASSWORD 변경 → OG 확인 → 링크 배포

### 결정사항
- 일일 리포트 전달 경로: **GitHub Issue → 알림 메일** (별도 SMTP/Resend 없이. 특정 이메일 주소로 직접 발송 원하면 SMTP 연동 별도 작업)
- gh CLI 2.96 도입 (winget). Vercel CLI 55는 기존 그대로 (세션 시작 훅의 "미설치" 경고는 오탐)
- 스킬 도입 기록 (버전): `/smoke` v1, `/ship` v1 (2026-07-13), Playwright MCP `@playwright/mcp@latest` (npx)

### 블로커
- 없음

---

## 2026-07-12 — 세션 #4: 랜딩 v2 (Senior Scheduler 리브랜딩 + 2페이지 사전등록) 배포 완료

### 완료
- **데이터 초기화 (사용자 요청)**: cta_events·waitlist 전체 삭제 (설문 배포 전 깨끗한 0 상태. 스모크로 넣은 test 데이터도 검증 후 삭제)
- **브랜드/URL 전환**: 서비스명 **Senior Scheduler** 확정. Vercel 프로젝트명 `voicescheduler`→`seniorscheduler`, 새 프로덕션 URL **https://seniorscheduler.vercel.app**, 구 주소는 308 리다이렉트 유지(기존 공유 링크 안 깨짐). `NEXT_PUBLIC_SITE_URL` env·`.vercel/project.json` 갱신
- **랜딩 v2** (ui-builder `feat/ui-landing-v2` → reviewer PASS → 머지 97d4fcf, familycarecall.com 구조 참고):
  - 1페이지 `/`: 헤더(로고+사전등록 버튼)→풀블리드 히어로(핵심 한 줄 멘트+실사진)→3단계→보호자/시니어 혜택→**앱형 리포트 미리보기(형식 개편: 상태 칩+요약+기분/건강+전사 스니펫)**→CTA 배너→푸터(의료 미제공 고지). 가격 언급 전부 제거. 데스크톱 풀스크린 배율+모바일 반응형
  - 2페이지 `/preregister`: 좌 브랜드 패널(핵심 설명+혜택 3종: 첫 달 무료/결제 없음/출시 시 이메일 최우선 안내) / 우 이메일 등록 카드(유의사항: 출시 안내 목적만·결제 정보 요구 안 함·수신 거부 가능·구매 약정 아님, 완료 화면 멘트)
  - 추적: VIEW는 `/`에서 세션당 1회, [사전등록하기] 클릭=CLICK_TRY(=2페이지 진입), 이메일 제출=WAITLIST_SUBMIT. 모달(WaitlistModal/CtaSection) 삭제. `useCtaTracking`에 `trackView` 옵션 추가. 계약(cta.ts) 무변경
  - 사진: Unsplash 무료 라이선스 4장 `public/images/` (hero-call/senior-man-phone/family 사용)
- **관리자 지표 개편** (data-api `feat/data-metrics-v2` → reviewer PASS → 머지 3dc1da1): 퍼널을 방문→사전등록 클릭(페이지 진입)→이메일 제출 3단계로 재정의, CLICK_SUBSCRIBE 완전 제거(잔존 데이터는 집계에서 방어적 무시), USER_CHECK.md 새 구조로 재작성
- 통합 main: `npm test` 209/209, 빌드 통과 → **`vercel deploy --prod` 배포 + 프로덕션 스모크 통과** (전 라우트 200, 구 도메인 308, CTA/waitlist API 실데이터 E2E 검증 후 테스트 데이터 삭제)

### 완료 (배포 후 피드백 반영 — 2026-07-12 저녁)
- **피드백 4건** (ui-builder `feat/ui-landing-tweaks` → reviewer PASS → 머지): CTA 배너 톤다운(bg-primary/5 틴트), /preregister 좌우 중앙 정렬 + 글씨 한 단계 확대, 히어로 사진 교체
- **히어로 사진 최종**: 사용자 제공 이미지(`/images/hero-senior-man.jpg`, 통화 중 웃는 시니어 남성)로 확정. 가로 원본이라 4:5 크롭 + object-position 35% 조정
  - ⚠️ **라이선스 미확인** (출처 불명 다운로드 파일, 워터마크 없음). 베타 검증용으로 사용 중 — **정식 출시 전 라이선스 확정 이미지로 교체 필요**. 이전 후보(Unsplash 무료: hero-call/hero-call-2/hero-korean)는 public/images/에 보존됨
- 프로덕션 반영 확인 완료. **설문 배포 가능 상태.**
- **후속 (2026-07-12 밤)**: 히어로 사진 v3(사용자 제공 고해상)+히어로 중앙 정렬 / 전역 `word-break: keep-all`(어절 단위 줄바꿈) / **채널별 배포 링크 11종 확정** (USER_CHECK.md 표: survey·mom-cafe·care-cafe·parents-cafe·elder-cafe·senior-cafe·fishing-hiking-cafe·golf-cafe·tennis-badminton-cafe·teacher-cafe·realestate-cafe + test)
- **버그 수정: 지표 캐시 고착** — Next 데이터 캐시가 Supabase GET을 저장해 `/admin/metrics`가 배포 시점 스냅샷을 계속 보여줌 → `lib/supabase/admin.ts` fetch `cache: "no-store"` 적용, 채널별 실시간 집계 검증 완료(mom-cafe/golf-cafe 주입→표시→삭제). CLAUDE.md 핫픽스 패스트트랙 규칙 신설(단순 수정은 에이전트/리뷰어 생략)
- **uptime 모니터**: `.github/workflows/uptime.yml` — 10분 주기 `/`·`/preregister` 200 점검, 실패 시 GitHub Issue 자동 생성(→소유자 메일 알림). cta_events·waitlist는 사용자 셀프 테스트 위해 0으로 재초기화됨

### 현재 상태 스냅샷 (세션 종료 시점 — 다음 세션은 여기부터)
- 프로덕션: **https://seniorscheduler.vercel.app** 라이브, 전 라우트 200, uptime 모니터 가동
- 데이터: cta_events·waitlist **모두 0** (사용자 셀프 테스트 대기 상태)
- 사용자 진행 중: `?utm_source=test` 링크로 방문→클릭→이메일 제출 셀프 테스트 → 대시보드(https://seniorscheduler.vercel.app/admin/metrics)에서 집계 확인 예정
- 배포 채널 링크 11종은 USER_CHECK.md §2 표가 단일 소스 (댓글/게시물용, 설문지는 utm_source=survey)

### 다음 할 일 (우선순위순 — 2026-07-13 세션)
1. **사용자 셀프 테스트 결과 확인** → 테스트 데이터(전체 또는 해당 세션) 삭제해 0으로 초기화 (삭제는 Supabase REST DELETE로 오케스트레이터가 수행, 지표 페이지는 no-store라 즉시 반영)
2. **ADMIN_PASSWORD 변경** (현 `vs-beta-2026`) — 사용자에게 새 값 받아 Vercel env(PATCH)+`.env.local` 동시 갱신 후 재배포
3. **OG 썸네일 카톡 미리보기 확인** (카톡 나에게 보내기로 테스트) — 이상하면 OG 이미지 제작
4. **링크 배포 시작** (설문지 + 카페 채널별) → 이후는 대시보드 관찰 모드. 판단 기준선(전환율 5%↑ 수요 신호 / 1%↓ 메시지 재점검, 도구 로드맵 A-6) 숫자 보기 전 확정 권장
5. **사용자 수동**: Supabase Auth Site URL/Redirect URLs를 `https://seniorscheduler.vercel.app`으로 갱신 (magic link 보조 로그인용 — 랜딩 배포와는 무관, 급하지 않음)
6. 배포 후 여유 시: Phase 3 진입(MockAdapter 파이프라인) 또는 도구 로드맵 A항목(Playwright MCP, /smoke, /ship, Vercel Analytics)

### 결정사항
- **서비스명/브랜드: Senior Scheduler** (2026-07-12, 사용자 결정). 프로덕션 URL seniorscheduler.vercel.app (구 voicescheduler는 308 리다이렉트)
- **채널 utm_source 표기 확정** (2026-07-12): survey / mom-cafe / care-cafe / parents-cafe / elder-cafe / senior-cafe / fishing-hiking-cafe / golf-cafe / tennis-badminton-cafe / teacher-cafe / realestate-cafe / test(집계 제외). 같은 계열 카페는 하나의 source로 통일, 세분화는 utm_campaign으로
- **핫픽스 패스트트랙** (2026-07-12, CLAUDE.md 멀티 에이전트 규칙 5): 로직 없는 1~5줄 수정(이미지·문구·스타일)은 에이전트/reviewer 생략, 오케스트레이터 직접 처리 (5분 내 목표)
- 사전등록 혜택 문구: "정식 출시 시 첫 달 무료" (가격 티저 섹션은 랜딩에서 제거 — 지불 의향 측정은 설문 담당)
- 랜딩 사진: Unsplash 무료 라이선스 원칙, 단 현 히어로는 사용자 제공 이미지(라이선스 미확인 — 정식 출시 전 교체 필요)
- **서버 Supabase 조회는 `cache: "no-store"` 필수** (admin 클라이언트 적용됨) — Next 데이터 캐시가 GET을 고착시키는 것 확인됨. 새 서버 조회 코드 추가 시 동일 주의

### 블로커
- 없음

---

## 2026-07-10 — 세션 #3: 랜딩 보강 (설문 배포 준비)

### 완료
- **BRD/TRD/PRD 3종 검토** (Downloads의 상위 기획 문서): 현재 베타 스코프와의 차이 확인 — 백엔드(FastAPI vs Next.js 풀스택)·통화 방식(실시간 스트리밍 vs ARS+)은 **미확정 유지(사용자 결정)**, 문서의 "CLOVA AiCall 확정" 기술은 채택 안 함(CLAUDE.md 추상화 방침 유지)
- **랜딩 페이지 보강** (ui-builder `feat/ui-landing-enrich` → reviewer PASS → main 머지 26d29d4, 테스트 65/65·빌드 통과):
  - 차별점 섹션 신설: "앱이 아니라, 진짜 전화입니다" — 기존 돌봄 앱 vs 이 서비스 2열 대비 카드
  - 리포트 미리보기 섹션 신설: 목업 카드 2개("예시 화면입니다" 라벨), '확인이 필요해요' UNCERTAIN 정직성 포인트 포함
  - 가드레일 준수: 토큰 클래스만 사용, 베타 범위 밖 기능(장기 기억·긴급 알림·실시간 대화) 문구 없음, 의료 미제공 고지 유지
- 랜딩 활용 방향 합의: 설문지에는 utm 링크(`?utm_source=survey` 등, USER_CHECK.md 규칙)로 랜딩 연결 → 사전등록(waitlist) 전환으로 사용 의향 측정
- **CTA 단일화** (사용자 결정: 최소형. ui-builder `feat/ui-single-cta` → reviewer PASS → 머지 382b949): [구독하기]/[베타 사용해보기] 2버튼 → **[사전등록하기] 단일 버튼 + 이메일 모달**. 추적은 기존 `CLICK_TRY` 재사용(API/DB/enum/admin 무변경), `CLICK_SUBSCRIBE`는 더 이상 발생 안 함(기존 수집분 보존). 지불 의향 측정은 설문지가 담당
  - 후속 검토 항목: admin/metrics의 CLICK_SUBSCRIBE 컬럼·라벨 정리(0 고정될 예정), contracts enum의 죽은 값 정리 여부
- **Vercel 프로덕션 배포 2회** (`vercel --prod`): 랜딩 보강분 + CTA 단일화분. https://voicescheduler.vercel.app 공개 확인(외부 공유용). 친구 등 테스트 유입은 `?utm_source=test` 링크 안내
- **사용자 피드백 4건 반영** (ui-builder `feat/ui-landing-feedback` → reviewer PASS → 머지 7ffbf59): ① 히어로 설명 화살표+체크 불렛화 ② "기존 앱 vs 이 서비스" 비교 → 보호자/시니어 관점 병렬 카드로 재구성 ③ 리포트 목업 앱 UI화(상태 뱃지+통화 요약 블록) ④ '확인이 필요해요' 카드 → "대화 내용 그대로 확인"+채팅형 전사 스니펫
  - ⚠️ 사용자가 "대화를 직접 **들을 수** 있는 기능"을 요청했으나 **녹음 미저장 정책(전사만)** 충돌로 "그대로 읽어 볼 수 있어요"로 조정해 반영 — 음성 청취를 원하면 녹음 저장 정책 변경 결정 필요(사용자에게 고지함)
  - 메모: UNCERTAIN 정직성 카드("억지로 판정 안 함")는 사용자 요청으로 랜딩에서 제거됨 (제품 동작은 불변)

### 다음 할 일
1. ~~GitHub push + Vercel 프로덕션 배포~~ ✅ 완료 (피드백 4건 반영분까지 3회 배포)
2. 설문 배포 전: ADMIN_PASSWORD 변경, 설문용 utm 링크 확정
3. (선택) waitlist에 전화번호/관심 이유 필드 추가 여부 결정

---

## 도구·자동화 로드맵 (2026-07-10 확정 — 전화 기능 자체 관련은 보류)

> 배경: 설문·사전등록으로 시장 검증하면서 개발 속도를 올리기 위한 스킬/MCP/외부 연동 계획.
> **사용자 지시: 전화 기능 자체에 대한 것(통화 파이프라인·분류 프롬프트 평가 등)은 아직 넣지 않음.**
> 원칙: 도구는 데이터가 흐르는 길목에만. "있으면 좋은" 수준의 MCP는 추가하지 않음 (컨텍스트·보안 표면 증가).

### A. 지금 (설문 배포 전) — 우선순위 높음
1. **Playwright MCP 연결**: `claude mcp add playwright npx @playwright/mcp@latest` (프로젝트 `.mcp.json` 공유 가능). 브라우저 실조작으로 UI 확인·스모크 자동화의 기반. ⚠️ 로컬/프리뷰 대상만, 프로덕션 계정 자격증명 주지 말 것 (테스트 전용 계정 사용)
2. **`/smoke` 스킬** (`.claude/skills/smoke/SKILL.md`): Playwright MCP로 핵심 플로우(랜딩 CTA→사전등록 / 로그인→피보호자 등록→일정→토글→대시보드) 자동 검증. **몇 주째 수동으로 밀린 Phase 2 스모크를 이걸로 통과시키는 게 첫 사용처**
3. **`/ship` 스킬**: reviewer→머지→`npm test`→push→`vercel --prod`→프로덕션 스모크 (현재 오케스트레이터가 수동 반복 중인 루틴의 스킬화)
4. **Vercel Web Analytics 추가**: `npm i @vercel/analytics` → 대시보드 Analytics Enable → 루트 레이아웃에 `<Analytics />` (`@vercel/analytics/next`). 무료 플랜 가능, dev에선 미수집, 반영까지 ~1h. ⚠️ 커스텀 이벤트는 Pro 전용 → CTA 이벤트는 기존 자체 `cta_events`로 계속 (중복 아님: Analytics는 방문·이탈 보완용)
5. 설문 배포 정비(기존 항목): ADMIN_PASSWORD 변경, utm 링크 확정(`?utm_source=survey|kakao|...`), OG 썸네일 품질 확인(카톡 공유 미리보기)
6. **판단 기준선 사전 합의**: 예) 랜딩 방문→사전등록 5%↑ = 수요 신호, 1%↓ = 메시지 재점검 (숫자 보기 전에 정할 것)

### B. 설문 기간
1. **Supabase MCP (read-only 필수)**: `.mcp.json`에 HTTP 타입 `https://mcp.supabase.com/mcp?project_ref=hcygbbbbzfpgucqkmxav&read_only=true` + PAT 헤더. 프로젝트 스코프 고정. "이번 주 사전등록 몇 명?"을 대화로 조회
2. **`/metrics-report` 스킬**: cta_events·waitlist 집계 → 주간 퍼널 리포트(채널별 전환율·전주 대비)
3. **`/survey-analyze` 스킬**: 설문 CSV → 고정 분석 프레임(세그먼트×지불 의향×채널 교차, Artifact 리포트). ⚠️ 설문 원본에 PII 있으면 저장소 커밋 금지
4. (선택) **Google Sheets MCP**: Forms→Sheets 자동 연동이면 실시간 응답 분석 가능. CSV 수동으로도 충분하므로 응답이 계속 유입되는 기간에만 가치

### C. 설문 이후 (분석·의사결정)
1. **`/cost-model` 스킬** (사업 도구 — 전화 기능 구현 아님): 분당 통화료·STT/TTS·LLM 단가 입력 → 통화당 원가→구독료 대비 마진 시뮬레이터. 벤더 비교(CPaaS vs CLOVA)·가격 결정의 근거. 추후 `call_sessions.cost_krw` 실데이터와 대조
2. **`/interview-notes` 스킬**: 사전등록자 인터뷰 메모 → 고정 프레임(페인 강도·현재 대안·지불 의향·인용문) 구조화 누적
3. **analyst 에이전트** (`.claude/agents/analyst.md`, Sonnet, 읽기 전용): DB 집계·설문 분석·리포트 전담 (개발 에이전트와 병렬)
4. **`/competitor-watch` 스킬**: 위식스 등 경쟁사 가격·기능 변화 월 1회 조사→차이표 갱신
5. **`/handoff` 스킬**: PROGRESS.md 갱신→커밋 루틴 자동화 (저비용, 아무 때나)

### 보류 (전화 기능 착수 시 — 사용자 지시로 지금 안 함)
- `/prompt-eval`: LLM 복약 분류(DONE/NOT_DONE/UNCERTAIN) 회귀 평가 하네스 — Phase 3 착수와 동시 필수 (사투리·모호 응답 케이스셋)

### 스킬 작성 규칙 (공식 문서 요지)
- 위치 `.claude/skills/<name>/SKILL.md`, YAML frontmatter(name·description) + 본문. **description이 트리거 라우팅 규칙** — "언제 발동하는지"를 구체적으로
- 본문은 짧게(500줄 이하), 상세는 `references/` 분리. 스킬 하나 = 역할 하나. 결정적 작업(집계·파싱)은 스크립트로
- 도입/변경 시 이 파일 결정사항에 버전 기록 (CLAUDE.md 세션 운영 규칙 3)

### 붙이지 않기로 한 것 (검토 완료)
- GitHub MCP(→`gh` CLI로 충분) / Notion·Linear MCP(팀 문서 미사용) / Sentry MCP(베타 규모에선 Vercel logs로 충분) / 결제·알림톡 계열(베타 범위 밖)

### 블로커
- 없음

---

## 2026-07-10 — 세션 #2: 배포·환경 정비 (Confirm email OFF / GitHub / 알약 원인 확정 / Vercel 최신화)

### 완료
- **Supabase "Confirm email" OFF** — 사용자 대시보드 조작 + API로 `mailer_autoconfirm: true` 반영 검증. 가입 즉시 로그인 가능
- **GitHub 원격 신설·푸시**: https://github.com/spacetravr/SeniorScheduler (main, 히스토리 포함). 팀원은 Settings → Collaborators로 초대, clone 후 `.env.example` → `.env.local` 채워 실행
- **dev 서버 끊김(errno -4094) 원인 확정**: 알약(ALYac) 실시간 감시가 `.next` 파일 잠금 (Defender 비활성 확인). 사용자가 알약 검사 예외에 프로젝트 폴더 등록 → 이후 전 라우트 재현 테스트에서 재발 없음
- **Vercel 프로덕션 최신화** (`vercel --prod`, 커밋 40d915f): 비밀번호 로그인 + admin 대시보드 개편 반영. 라우트 스모크 통과(/ 200, /login 200, /app 307, /admin/metrics 200, 랜딩 0.22s). Vercel CLI 55 전역 설치·로그인(spacetravr) 완료
- 속도 저하 원인 진단: ① dev 첫 방문 컴파일(배포판 무관) ② **Supabase 리전이 ap-southeast-2(시드니)** — 한국에서 인증·쿼리 호출당 ~0.3s 실측

### 다음 할 일
1. **Phase 2 스모크 잔여** (실서버 https://voicescheduler.vercel.app/login 로 해도 됨): 피보호자 등록(동의) → 일정 등록 → 토글 ON → 대시보드 오늘 인스턴스 → 통과 시 Phase 2 완료 판정
2. **사용자 수동**: Supabase → Authentication → URL Configuration → Site URL을 `https://voicescheduler.vercel.app`으로 원복 (magic link 보조 로그인 메일용. 비밀번호 주 로그인은 무관)
3. 미들웨어 개선(data 경계 — data-api 경유): 현재 matcher가 랜딩 `/` 포함 전 경로에서 `getUser()` 원격 호출 → 보호 경로 위주로 축소해 랜딩·로그인 응답 개선 (시드니 유지 결정으로 체감 효과 더 큼)
4. Phase 3 진입 (MockAdapter 파이프라인 선개발 — 벤더 결정과 무관)

### 결정사항
- **Supabase 리전: 시드니(ap-southeast-2) 유지 — 서울 이사 안 함 (사용자 결정, 2026-07-10)**. 호출당 ~0.3s 레이턴시 감수. 추후 속도가 문제되면 재검토 (데이터 쌓일수록 이전 비용 증가함은 고지됨)
- Vercel CLI 55 전역 설치 (배포는 `vercel --prod`, 프로젝트 링크 `.vercel/project.json` 존재)

### 블로커
- 없음

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
- ⚠️ **Windows dev 서버 이슈 (원인 확정 — 2026-07-10)**: `.next` 캐시 파일 깨짐(errno -4094) 3회 재발 → **원인: 알약(ALYac) 실시간 감시가 `.next` 파일 잠금** (Defender는 비활성, SecurityCenter2로 확인). 조치: 알약 검사 예외에 프로젝트 폴더 등록(사용자). 임시 복구는 `.next` 삭제+재시작
- 이번에 클릭해보며 나온 개선 요청은 이 파일에 추가 기록할 것

### 다음 할 일
1. ~~Supabase "Confirm email" 토글 OFF~~ ✅ 완료 (2026-07-10, 사용자 수동 → API로 `mailer_autoconfirm: true` 반영 확인. 나중에 SMTP 연결 후 ON 전환 가능)
2. ~~Vercel 배포~~ ✅ 완료 (2026-07-10, `vercel --prod` → https://voicescheduler.vercel.app 최신화, 라우트 스모크 200/307 통과). ⚠️ 잔여: Supabase Site URL 아직 localhost — magic link 보조 로그인용으로 `https://voicescheduler.vercel.app` 원복 필요(사용자). GitHub 신규 원격: https://github.com/spacetravr/SeniorScheduler (main push 완료)
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
