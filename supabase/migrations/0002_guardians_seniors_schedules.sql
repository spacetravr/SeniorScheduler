-- 0002_guardians_seniors_schedules.sql
-- Phase 2: 보호자(guardians) / 피보호자(seniors) / 일정(schedules) 스키마 + RLS + 동의 가드레일.
--
-- 실행 방법: Supabase SQL Editor에서 이 파일 전체를 그대로 붙여넣어 실행한다.
--   - 0001(cta_events/waitlist)과 독립적이며 충돌하지 않는다.
--   - 멱등(idempotent): create ... if not exists / create or replace / drop ... if exists 로
--     여러 번 실행해도 안전하다.
--
-- 시간대 규칙(CLAUDE.md): 모든 시각 컬럼은 timestamptz. 앱은 항상 Asia/Seoul 명시로 처리.
--
-- RLS 설계(가드레일 2 — 보호자 간 데이터 격리):
--   - guardians: 로그인 사용자는 "자기 행"(id = auth.uid())만.
--   - seniors/schedules: guardian_id = auth.uid() 인 행만.
--     schedules 는 senior 를 매번 조인하지 않도록 guardian_id 를 **비정규화**해 RLS 를 단순화한다.
--     이 비정규화 컬럼은 아래 BEFORE 트리거가 senior 로부터 자동 채워 넣어 드리프트를 원천 차단한다.
--
-- 동의 가드레일(가드레일 5 — 동의 없으면 실발신/활성화 금지):
--   - active=true 인 schedule 은 해당 senior 의 consent_at 이 반드시 NOT NULL.
--     → schedules BEFORE INSERT/UPDATE 트리거로 DB 레벨에서 강제.
--   - senior.consent_at 이 NULL 로 되돌려지면(동의 철회) 해당 senior 의 활성 일정을 자동 비활성화.
--     → seniors AFTER UPDATE 트리거.

-- ── guardians ─────────────────────────────────────────────────────────────────
-- auth.users 와 1:1. 회원가입(첫 magic link 인증) 시 트리거로 자동 생성된다.
create table if not exists public.guardians (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

-- ── seniors (피보호자) ────────────────────────────────────────────────────────
-- lib/contracts/domain.ts seniorSchema 와 필드 일치.
create table if not exists public.seniors (
  id           uuid primary key default gen_random_uuid(),
  guardian_id  uuid not null references public.guardians (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 50),
  phone        text not null,
  -- domain.ts relationship enum: 모/부/조모/조부/기타
  relationship text not null check (relationship in ('모', '부', '조모', '조부', '기타')),
  birth_year   int check (birth_year is null or (birth_year between 1920 and 2000)),
  -- 통화 녹취·전사 저장 보호자 대리동의 시각. NULL 이면 실발신 금지(가드레일 5).
  consent_at   timestamptz,
  -- 대리동의한 보호자. 보호자 삭제 시 이력만 끊고 senior 는 유지(set null).
  consent_by   uuid references public.guardians (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists seniors_guardian_idx on public.seniors (guardian_id);

-- ── schedules (일정) ──────────────────────────────────────────────────────────
-- domain.ts scheduleSchema 와 필드 일치. guardian_id 는 RLS 단순화용 비정규화 컬럼.
--
-- call_time 타입 선택 근거:
--   contract(domain.ts)는 call_time 을 문자열 "HH:mm"(KST) 로 정의하고, UI 는 문자열
--   슬라이싱으로만 표시한다. Postgres `time` 은 타임존이 없어 왕복 시 문자열 재포맷/파싱이
--   필요하고 KST 의도를 흐린다. contract 와 1:1 로 맞추고 왕복 손실을 없애기 위해
--   text + 정규식 체크로 저장한다. 실제 발신 시각 계산은 lib/scheduling/occurrences.ts 가
--   이 "HH:mm" 를 Asia/Seoul 기준으로 해석한다.
create table if not exists public.schedules (
  id              uuid primary key default gen_random_uuid(),
  senior_id       uuid not null references public.seniors (id) on delete cascade,
  guardian_id     uuid not null references public.guardians (id) on delete cascade,
  type            text not null check (type in ('MEDICATION', 'HOSPITAL', 'MEAL', 'ETC')),
  title           text not null check (char_length(title) between 1 and 100),
  script_template text not null check (char_length(script_template) between 1 and 300),
  call_time       text not null check (call_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  rrule           text not null check (char_length(rrule) >= 1),
  active          boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists schedules_guardian_idx on public.schedules (guardian_id);
create index if not exists schedules_senior_idx on public.schedules (senior_id);

-- ── 트리거 1: 회원가입 시 guardians 자동 생성 ─────────────────────────────────
-- auth.users insert → public.guardians 행 생성. RLS 우회 위해 security definer.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.guardians (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 트리거 2: schedules 쓰기 시 guardian_id 자동 채움 + 동의 강제 ─────────────
-- senior 로부터 guardian_id 를 항상 파생(비정규화 드리프트 차단)하고,
-- active=true 인데 senior.consent_at 이 NULL 이면 거부(가드레일 5, DB 레벨 방어).
-- security definer 아님 → 호출자 RLS 적용: 남의 senior 는 조회되지 않아 NOT FOUND 로 거부됨.
create or replace function public.schedules_before_write()
returns trigger
language plpgsql
as $$
declare
  v_guardian uuid;
  v_consent  timestamptz;
begin
  select guardian_id, consent_at
    into v_guardian, v_consent
    from public.seniors
   where id = new.senior_id;

  if not found then
    raise exception '존재하지 않거나 접근 권한이 없는 피보호자입니다.'
      using errcode = 'foreign_key_violation';
  end if;

  -- 비정규화 컬럼을 senior 기준으로 강제(요청 값 무시).
  new.guardian_id := v_guardian;

  if new.active and v_consent is null then
    raise exception '동의(consent_at)가 없는 피보호자의 일정은 활성화할 수 없습니다.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists schedules_before_write_trg on public.schedules;
create trigger schedules_before_write_trg
  before insert or update on public.schedules
  for each row execute function public.schedules_before_write();

-- ── 트리거 3: 동의 철회 시 활성 일정 자동 비활성화 ─────────────────────────────
-- consent_at 이 (NOT NULL → NULL) 로 바뀌면 해당 senior 의 active 일정을 모두 끈다.
create or replace function public.deactivate_schedules_on_consent_revoke()
returns trigger
language plpgsql
as $$
begin
  if new.consent_at is null and old.consent_at is not null then
    update public.schedules
       set active = false
     where senior_id = new.id
       and active = true;
  end if;
  return new;
end;
$$;

drop trigger if exists seniors_consent_revoke_trg on public.seniors;
create trigger seniors_consent_revoke_trg
  after update of consent_at on public.seniors
  for each row execute function public.deactivate_schedules_on_consent_revoke();

-- ── RLS: 세 테이블 모두 활성화 + 명시적 정책 ──────────────────────────────────
alter table public.guardians enable row level security;
alter table public.seniors   enable row level security;
alter table public.schedules enable row level security;

-- guardians: 자기 행만. insert 는 트리거(security definer)가 담당하므로 정책 없음.
drop policy if exists guardians_select_own on public.guardians;
create policy guardians_select_own on public.guardians
  for select using (id = auth.uid());

drop policy if exists guardians_update_own on public.guardians;
create policy guardians_update_own on public.guardians
  for update using (id = auth.uid()) with check (id = auth.uid());

-- seniors: guardian_id = auth.uid() 인 행만 CRUD.
drop policy if exists seniors_select_own on public.seniors;
create policy seniors_select_own on public.seniors
  for select using (guardian_id = auth.uid());

drop policy if exists seniors_insert_own on public.seniors;
create policy seniors_insert_own on public.seniors
  for insert with check (guardian_id = auth.uid());

drop policy if exists seniors_update_own on public.seniors;
create policy seniors_update_own on public.seniors
  for update using (guardian_id = auth.uid()) with check (guardian_id = auth.uid());

drop policy if exists seniors_delete_own on public.seniors;
create policy seniors_delete_own on public.seniors
  for delete using (guardian_id = auth.uid());

-- schedules: guardian_id = auth.uid() 인 행만 CRUD.
-- (insert/update 시 guardian_id 는 트리거가 senior 기준으로 채우므로 WITH CHECK 와 일치)
drop policy if exists schedules_select_own on public.schedules;
create policy schedules_select_own on public.schedules
  for select using (guardian_id = auth.uid());

drop policy if exists schedules_insert_own on public.schedules;
create policy schedules_insert_own on public.schedules
  for insert with check (guardian_id = auth.uid());

drop policy if exists schedules_update_own on public.schedules;
create policy schedules_update_own on public.schedules
  for update using (guardian_id = auth.uid()) with check (guardian_id = auth.uid());

drop policy if exists schedules_delete_own on public.schedules;
create policy schedules_delete_own on public.schedules
  for delete using (guardian_id = auth.uid());
