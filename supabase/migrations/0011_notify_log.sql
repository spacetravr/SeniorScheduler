-- 0011_notify_log.sql
-- 알림 발송 이력(notify_log) — "보호자 × 종류 × 채널 × KST 날짜 하루 1회" 상한의 저장소.
--
-- 실행 방법: Supabase SQL Editor 에서 이 파일 전체를 그대로 붙여넣어 실행한다.
--   - 0002(guardians) 이후에 실행. 0010 과는 독립.
--   - 멱등(idempotent): create table/index if not exists + drop-create policy/constraint 로
--     여러 번 실행해도 안전.
--
-- 왜 필요한가 (docs/research/benchmark-ux.md · THIRD-PLAN P0-3):
--   불필요한 알림은 해지 1위 요인이다. 같은 날 이상 신호가 여러 번 생기면(통화 3건이 연달아
--   MISSED 등) 예외 알림이 여러 번 나가는데, 이는 정확히 "알림 피로" 그 자체다.
--   판정(shouldNotify)은 그대로 두고 **발송 상한**을 여기서 건다.
--
-- 시간대(CLAUDE.md 불변 규칙):
--   ymd 는 **KST(Asia/Seoul) 달력 날짜**다. 애플리케이션(lib/notify/dedupe.ts)이
--   date-fns-tz 로 Asia/Seoul 을 명시해 계산한 값만 넣는다.
--   DB 의 now()/current_date(UTC 세션) 로 이 값을 만들면 저녁 알림이 다음 날로 새어 나가므로
--   **DB 기본값을 두지 않는다**(default 없음 = 앱이 반드시 명시).
--   sent_at 은 timestamptz(절대시각) — 표시·비교는 코드에서 Asia/Seoul 명시.
--
-- RLS 설계 (가드레일 2 — 보호자 간 데이터 격리):
--   - write(insert/update/delete) 정책 **없음** → 서버 secret key(admin) 전용.
--     0003(call_sessions)·0009(credit_ledger) 와 동일 패턴.
--   - SELECT 는 보호자 본인 행만 허용한다(완전 차단이 아니라 select-own 을 택한 근거):
--     ① 이 테이블에 PII 가 없다 — 수신 주소·본문·요약을 저장하지 않고 메타(종류·채널·날짜)만 둔다.
--     ② 향후 설정 화면의 "최근 알림 발송 이력" 을 RLS 클라이언트로 바로 읽을 수 있어야 하고,
--        그때 admin 키를 쓰는 라우트를 새로 파는 것이 더 위험하다.
--     ③ 0009 credit_ledger 와 같은 모양이라 정책 심사 표면이 늘지 않는다.
--   - 기존 테이블 정책은 건드리지 않는다.
--
-- 보존: 상한 판정은 "오늘" 만 보므로 오래된 행은 언제든 삭제 가능(후속 과제 — 90일 정리 잡).

-- ── notify_log ────────────────────────────────────────────────────────────────
create table if not exists public.notify_log (
  id          uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references public.guardians (id) on delete cascade,
  -- lib/contracts/notify.ts NOTIFY_KINDS 와 1:1
  kind        text not null,
  -- lib/contracts/notify.ts NOTIFY_CHANNELS 와 1:1
  channel     text not null,
  -- KST 달력 날짜 (앱이 Asia/Seoul 명시로 계산해 넣는다 — 위 시간대 주석 참조)
  ymd         date not null,
  -- 발송 당시 리포트 톤(CALM|ATTENTION|ALERT). 진단용이며 상한 키에는 포함하지 않는다.
  tone        text,
  sent_at     timestamptz not null default now()
);

-- 값 도메인 고정 — 애플리케이션(zod)이 단일 소스이나 잘못된 값이 조용히 쌓이지 않게 DB 에서도 방어.
-- (enum 타입 대신 CHECK — 종류·채널 추가 시 마이그레이션만으로 확장.)
alter table public.notify_log drop constraint if exists notify_log_kind_chk;
alter table public.notify_log add constraint notify_log_kind_chk
  check (kind in ('EXCEPTION_ALERT', 'WEEKLY_DIGEST'));

alter table public.notify_log drop constraint if exists notify_log_channel_chk;
alter table public.notify_log add constraint notify_log_channel_chk
  check (channel in ('EMAIL', 'ALIMTALK'));

alter table public.notify_log drop constraint if exists notify_log_tone_chk;
alter table public.notify_log add constraint notify_log_tone_chk
  check (tone is null or tone in ('CALM', 'ATTENTION', 'ALERT'));

-- ── 하루 1회 상한 (중복 방지 키) ───────────────────────────────────────────────
-- 0009 는 reason 컬럼으로 행 종류가 섞이기 때문에 **부분** unique(where reason=...)가 필요했다.
-- 여기서는 모든 행이 "성공 발송 1건" 이고 종류·채널이 이미 키에 들어가므로 부분 술어가 필요 없다
-- (where true 는 계획에 아무 영향이 없고 의미만 흐린다). 전체 unique 로 같은 보장을 얻는다.
--
-- 이 인덱스가 경쟁 조건 방어의 핵심이다: 크론이 겹쳐 돌아도 두 번째 insert 는 23505 로 튕기고,
-- 앱은 그것을 "이미 보냄" 으로 해석한다(lib/notify/dedupe.ts).
create unique index if not exists notify_log_daily_uk
  on public.notify_log (guardian_id, kind, channel, ymd);

-- 이력 조회(최근순) 보조.
create index if not exists notify_log_guardian_sent_idx
  on public.notify_log (guardian_id, sent_at desc);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- write 정책 없음(서버 secret key 전용). SELECT 만 보호자 소유권 격리로 허용.
alter table public.notify_log enable row level security;

drop policy if exists notify_log_select_own on public.notify_log;
create policy notify_log_select_own on public.notify_log
  for select using (guardian_id = auth.uid());
