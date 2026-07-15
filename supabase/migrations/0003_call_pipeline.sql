-- 0003_call_pipeline.sql
-- Phase 3: ARS+ 통화 파이프라인 — call_sessions / call_turns / call_reports + RLS.
--          seniors.self_consent_at(본인 동의) 컬럼 추가.
--
-- 실행 방법: Supabase SQL Editor에서 이 파일 전체를 그대로 붙여넣어 실행한다.
--   - 0001/0002 이후에 실행(seniors, guardians 테이블 의존).
--   - 멱등(idempotent): create ... if not exists / add column if not exists /
--     create or replace / drop ... if exists 로 여러 번 실행해도 안전.
--
-- 시간대 규칙(CLAUDE.md): 모든 시각 컬럼은 timestamptz. 앱은 항상 Asia/Seoul 명시로 처리.
--
-- 스키마 소스: lib/contracts/domain.ts 의 callSessionSchema / callTurnSchema /
--   callReportSchema 와 1:1. 필드/enum 을 그대로 반영한다.
--
-- RLS 설계(가드레일 2 — 보호자 간 데이터 격리):
--   - 통화 데이터는 서버(secret key)만 write 한다(0001 deny-all 쓰기 패턴).
--     클라이언트 INSERT/UPDATE/DELETE 정책은 만들지 않는다.
--   - 보호자는 자기 senior 에 딸린 세션/턴/리포트만 SELECT 가능
--     (senior.guardian_id = auth.uid() 경유).

-- ── seniors: 본인 동의 시각 추가 ──────────────────────────────────────────────
-- 동의 콜(CONSENT 세션)에서 부모 본인이 음성/DTMF 로 동의한 시각.
-- 실발신 정책(가드레일 5): SCHEDULE 콜은 consent_at(대리) && self_consent_at(본인) 둘 다 필요.
alter table public.seniors
  add column if not exists self_consent_at timestamptz;

-- ── call_sessions (상태 기계) ─────────────────────────────────────────────────
-- domain.ts callSessionSchema 와 필드 일치.
--   purpose: SCHEDULE(일정 확인) | CONSENT(본인 동의). CONSENT 는 schedule_id 없음.
--   status:  SCHEDULED→DIALING→IN_PROGRESS→COMPLETED / 무응답 재시도 소진 시 MISSED.
--   attempt: 1..3 (원본 + 1분/10분 재시도).
--   cost_krw: 통화당 실원가(회선+STT+LLM+TTS 합산, 벤더 무관 필수).
create table if not exists public.call_sessions (
  id           uuid primary key default gen_random_uuid(),
  purpose      text not null check (purpose in ('SCHEDULE', 'CONSENT')),
  -- CONSENT 콜은 일정 없이 발신 → nullable. schedule 삭제 시 세션 이력은 남기고 링크만 끊음.
  schedule_id  uuid references public.schedules (id) on delete set null,
  senior_id    uuid not null references public.seniors (id) on delete cascade,
  status       text not null check (status in
                 ('SCHEDULED', 'DIALING', 'IN_PROGRESS', 'COMPLETED', 'MISSED')),
  attempt      int  not null default 1 check (attempt between 1 and 3),
  scheduled_at timestamptz not null,
  started_at   timestamptz,
  ended_at     timestamptz,
  cost_krw     numeric(10, 2) check (cost_krw is null or cost_krw >= 0),
  created_at   timestamptz not null default now(),
  -- SCHEDULE 콜은 반드시 schedule_id 를 갖고, CONSENT 콜은 갖지 않는다(무결성).
  constraint call_sessions_purpose_schedule_ck check (
    (purpose = 'SCHEDULE' and schedule_id is not null) or
    (purpose = 'CONSENT'  and schedule_id is null)
  )
);

-- due 스케줄 조회(senior 별 발신 시각 윈도우) + 중복 발신 방지 조회용.
create index if not exists call_sessions_senior_scheduled_idx
  on public.call_sessions (senior_id, scheduled_at);
-- 같은 schedule + 윈도우 내 기존 세션 스킵 조회용.
create index if not exists call_sessions_schedule_scheduled_idx
  on public.call_sessions (schedule_id, scheduled_at);

-- ── call_turns (전사) ─────────────────────────────────────────────────────────
-- domain.ts callTurnSchema 와 필드 일치. 녹음 원본 미저장 — 전사 텍스트만.
--   role: SYSTEM(안내 멘트) | SENIOR(응답).
--   input_kind: VOICE | DTMF (SYSTEM 턴은 VOICE 고정). 분류는 DTMF 우선.
create table if not exists public.call_turns (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.call_sessions (id) on delete cascade,
  role       text not null check (role in ('SYSTEM', 'SENIOR')),
  input_kind text not null check (input_kind in ('VOICE', 'DTMF')),
  text       text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists call_turns_session_idx on public.call_turns (session_id);

-- ── call_reports (통화 리포트) ────────────────────────────────────────────────
-- domain.ts callReportSchema 와 필드 일치. 세션당 1개(unique).
--   adherence_status: DONE|NOT_DONE|POSTPONED|UNCERTAIN|MISSED (억지 판정 금지 — 불확실=UNCERTAIN).
--   MEDICAL_DISCLAIMER 는 UI 렌더 몫이므로 저장하지 않는다(가드레일 1).
create table if not exists public.call_reports (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null unique references public.call_sessions (id) on delete cascade,
  adherence_status text not null check (adherence_status in
                     ('DONE', 'NOT_DONE', 'POSTPONED', 'UNCERTAIN', 'MISSED')),
  summary          text not null default '' check (char_length(summary) <= 500),
  mood_flag        boolean not null default false,
  health_flag      boolean not null default false,
  prompt_version   text not null,
  created_at       timestamptz not null default now()
);

-- session_id unique 제약이 인덱스를 겸하지만, 명시 인덱스도 요구되어 추가(멱등).
create unique index if not exists call_reports_session_idx
  on public.call_reports (session_id);

-- ── RLS: 세 테이블 모두 활성화 ────────────────────────────────────────────────
-- write 정책 없음(서버 secret key 전용). SELECT 만 보호자 소유권 격리로 허용.
alter table public.call_sessions enable row level security;
alter table public.call_turns    enable row level security;
alter table public.call_reports  enable row level security;

-- call_sessions: 자기 senior 의 세션만 SELECT.
drop policy if exists call_sessions_select_own on public.call_sessions;
create policy call_sessions_select_own on public.call_sessions
  for select using (
    exists (
      select 1 from public.seniors s
       where s.id = call_sessions.senior_id
         and s.guardian_id = auth.uid()
    )
  );

-- call_turns: 세션 → senior → guardian 경유로 SELECT.
drop policy if exists call_turns_select_own on public.call_turns;
create policy call_turns_select_own on public.call_turns
  for select using (
    exists (
      select 1
        from public.call_sessions cs
        join public.seniors s on s.id = cs.senior_id
       where cs.id = call_turns.session_id
         and s.guardian_id = auth.uid()
    )
  );

-- call_reports: 세션 → senior → guardian 경유로 SELECT.
drop policy if exists call_reports_select_own on public.call_reports;
create policy call_reports_select_own on public.call_reports
  for select using (
    exists (
      select 1
        from public.call_sessions cs
        join public.seniors s on s.id = cs.senior_id
       where cs.id = call_reports.session_id
         and s.guardian_id = auth.uid()
    )
  );
