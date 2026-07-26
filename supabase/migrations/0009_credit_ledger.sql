-- 0009_credit_ledger.sql
-- 크레딧 원장(credit_ledger) — 가입 보너스 적립 + 통화 차감 이력.
--
-- 실행 방법: Supabase SQL Editor에서 이 파일 전체를 그대로 붙여넣어 실행한다.
--   - 0002(guardians)·0003(call_sessions) 이후에 실행.
--   - 멱등(idempotent): create ... if not exists / create unique index if not exists /
--     drop policy if exists 로 여러 번 실행해도 안전.
--
-- 베타 정책(오케스트레이터 확정): 크레딧은 **표시용**. 잔액 0 이하여도 발신 차단 안 함.
--   - 가입 보너스 120(SIGNUP_GRANT, guardian 당 1회), COMPLETED 된 SCHEDULE 콜 1건당 -1
--     (CALL_DEDUCT). CONSENT·MISSED 무차감. 잔액 = delta 합산(lib/contracts/credits.ts).
--
-- 시간대 규칙(CLAUDE.md): created_at 은 timestamptz. 앱은 항상 Asia/Seoul 명시로 처리.
--
-- RLS 설계(가드레일 2 — 보호자 간 데이터 격리):
--   - write(insert/update/delete) 정책 없음 → 서버 secret key(admin) 전용
--     (call_sessions 0003 과 동일 패턴). 클라이언트는 SELECT 만.
--   - 보호자는 자기 guardian_id 행만 SELECT.

-- ── credit_ledger ─────────────────────────────────────────────────────────────
create table if not exists public.credit_ledger (
  id              uuid primary key default gen_random_uuid(),
  guardian_id     uuid not null references public.guardians (id) on delete cascade,
  -- 가감분: 양수=적립, 음수=차감. SIGNUP_GRANT=+120, CALL_DEDUCT=-1.
  delta           integer not null,
  reason          text not null check (reason in ('SIGNUP_GRANT', 'CALL_DEDUCT', 'ADJUST')),
  -- CALL_DEDUCT 만 채운다(멱등 키). schedule/세션 삭제 시 이력은 남기고 링크만 끊음.
  call_session_id uuid references public.call_sessions (id) on delete set null,
  created_at      timestamptz not null default now()
);

-- 잔액 합산(guardian 별 delta) 조회용.
create index if not exists credit_ledger_guardian_idx
  on public.credit_ledger (guardian_id);

-- 멱등 1: 세션당 CALL_DEDUCT 1건만 — 중복 차감 방지(콜백 재전송/재시도 경합).
create unique index if not exists credit_ledger_call_deduct_uk
  on public.credit_ledger (call_session_id)
  where reason = 'CALL_DEDUCT';

-- 멱등 2: guardian 당 SIGNUP_GRANT 1건만 — 가입 보너스 이중 적립 방지.
create unique index if not exists credit_ledger_signup_grant_uk
  on public.credit_ledger (guardian_id)
  where reason = 'SIGNUP_GRANT';

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- write 정책 없음(서버 secret key 전용). SELECT 만 보호자 소유권 격리로 허용.
alter table public.credit_ledger enable row level security;

drop policy if exists credit_ledger_select_own on public.credit_ledger;
create policy credit_ledger_select_own on public.credit_ledger
  for select using (guardian_id = auth.uid());
