-- 0001_cta_waitlist.sql
-- Phase 0-2 / 0-5: CTA 이벤트 + 대기자(waitlist) 수집 스키마.
--
-- RLS 정책 설계 근거 (오케스트레이터 승인된 구현 선택):
--   CLAUDE.md/PLAN.md의 "anon insert RLS" 문구의 *의도*는 "비로그인 방문자의
--   CTA 이벤트를 수집한다" 이다. 구현 방식으로 anon 키 직접 insert 대신,
--   신형 키 체계(sb_publishable_* / sb_secret_*)에서 서버 라우트가
--   SECRET KEY(구 service_role, RLS 우회)로만 쓰는 방식을 택한다.
--   이유:
--     1) 공개 anon insert를 열면 봇/스팸이 테이블에 직접 write 가능 → 오염.
--     2) 서버 경유 시 zod 검증·중복 처리·PII(email) 마스킹을 한 곳에서 강제.
--     3) 신형 publishable 키는 프론트에 노출되므로 write 권한을 주지 않는 편이 안전.
--   따라서 두 테이블 모두 RLS ENABLE + 공개 정책 없음(deny-all).
--   secret key로 접근하는 서버 라우트만 RLS를 우회해 insert/select 한다.

-- ── cta_events ────────────────────────────────────────────────────────────────
create table if not exists public.cta_events (
  id           uuid primary key default gen_random_uuid(),
  type         text not null check (type in ('VIEW', 'CLICK_SUBSCRIBE', 'CLICK_TRY', 'WAITLIST_SUBMIT')),
  session_uuid uuid not null,
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  created_at   timestamptz not null default now()
);

-- VIEW 이벤트는 세션당 1회만 (재방문/새로고침 중복 제거).
-- 서버 라우트는 이 unique 위반(23505)을 성공(204)으로 취급한다.
create unique index if not exists cta_events_view_once
  on public.cta_events (session_uuid)
  where type = 'VIEW';

-- 퍼널 집계(utm_source별 type 카운트)용 보조 인덱스.
create index if not exists cta_events_source_type_idx
  on public.cta_events (utm_source, type);

-- ── waitlist ──────────────────────────────────────────────────────────────────
create table if not exists public.waitlist (
  id           uuid primary key default gen_random_uuid(),
  email        text not null unique,
  session_uuid uuid,
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  created_at   timestamptz not null default now()
);

-- ── RLS: 두 테이블 모두 deny-all (공개 정책 없음) ─────────────────────────────
-- 정책을 하나도 만들지 않으면 anon/authenticated 롤은 전면 차단된다.
-- secret key(구 service_role)만 RLS를 우회하므로 서버 라우트 전용 write가 강제된다.
alter table public.cta_events enable row level security;
alter table public.waitlist   enable row level security;
