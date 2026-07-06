# PROGRESS.md — 세션 인수인계 로그

> **규칙**: 컨텍스트 compact 임박 또는 큰 작업 단위 완료 시 이 파일을 갱신하고 `/clear`.
> 새 세션은 CLAUDE.md → PLAN.md → 이 파일 순으로 읽고 재개.
> 최신 항목이 **위**. 형식: 완료 / 진행 중 / 다음 할 일 / 결정사항 / 블로커.

---

## 2026-07-06 — 세션 #1: 프로젝트 초기화 + Phase 0 착수

### 완료
- `.claude/agents/` 3역할(ui-builder=opus, data-api=opus, reviewer=sonnet) 모델 배분 확정 (frontmatter)
- CLAUDE.md에 `## 세션 운영 규칙` 섹션 추가 (모델 배분·PROGRESS.md 인수인계·버전 고정)
- Next.js 스캐폴딩 (아래 결정사항 참조)

### 진행 중
- Phase 0: 랜딩 UI + CTA 추적 (PLAN.md 참조)

### 다음 할 일
1. npm install 완료 확인 → `npm run dev` 동작 확인
2. ui-builder에 랜딩 페이지(`app/(marketing)/page.tsx`) 위임, data-api에 `cta_events`/`waitlist` 마이그레이션 + `/api/cta` 위임 (병렬)
3. reviewer 검증 → 머지
4. Supabase 마이그레이션 적용 (사용자에게 anon key 받은 후)
5. `/admin/metrics` 퍼널 페이지, OG 태그, Vercel 배포

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
