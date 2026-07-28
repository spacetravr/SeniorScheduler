-- 0010_onboarding_notify_level.sql
-- ① 보호자 온보딩 프로필 5문항 + 완료 표식, ② 알림 레벨(notify_level) 도입.
--
-- 실행 방법: Supabase SQL Editor 에 이 파일 전체를 붙여넣어 실행한다.
--   - 0002(guardians), 0008(notify boolean 3종) 이후에 실행.
--   - 멱등(idempotent): add column if not exists / drop-create constraint 로 여러 번 실행해도 안전.
--
-- 스키마 소스:
--   - 온보딩 5문항: lib/contracts/onboarding.ts (onboardingProfileSchema) 와 1:1
--   - 알림 레벨:   lib/contracts/notify.ts (NOTIFY_LEVELS) 와 1:1, 설계 근거 docs/report-spec.md §3
--
-- RLS (가드레일 2 — 보호자 간 데이터 격리):
--   - guardians 는 0002 에서 RLS 활성 + guardians_select_own / guardians_update_own
--     (id = auth.uid()) 정책을 이미 갖는다. 컬럼 추가는 그 정책 범위에 그대로 포함되므로
--     **새 정책이 필요 없다**(정책은 행 단위). 기존 정책을 건드리지 않는다.
--   - 값 저장은 lib/actions/onboarding.ts / settings.ts 가 RLS 클라이언트로 자기 행만 갱신.
--
-- 시간대(CLAUDE.md): onboarded_at 은 timestamptz. 표시·비교는 코드에서 Asia/Seoul 명시.

-- ── ① 온보딩 프로필 (전부 nullable — 모든 문항이 선택 입력이고 건너뛰기 가능) ──
alter table public.guardians
  add column if not exists guardian_age_band   text;   -- 20s|30s|40s|50s|60s+
alter table public.guardians
  add column if not exists residence_distance  text;   -- TOGETHER|NEARBY|FAR|OVERSEAS
alter table public.guardians
  add column if not exists parent_age_band     text;   -- 60s|70s|80s|90s+
alter table public.guardians
  add column if not exists primary_concern     text;   -- MEDICATION|MEAL|LONELINESS|COGNITIVE|ETC
alter table public.guardians
  add column if not exists preferred_call_slot text;   -- MORNING|NOON|EVENING

-- 온보딩 통과 표식. null 이면 앱 첫 진입 시 온보딩으로 보낸다(건너뛰어도 값이 기록되므로 재노출 없음).
alter table public.guardians
  add column if not exists onboarded_at timestamptz;

alter table public.guardians
  add column if not exists onboarding_skipped boolean not null default false;

-- 값 도메인은 애플리케이션(zod)이 단일 소스이나, 잘못된 값이 조용히 쌓이지 않도록 DB 에서도 방어.
-- (enum 타입 대신 CHECK — 항목 추가 시 마이그레이션만으로 확장 가능.)
alter table public.guardians drop constraint if exists guardians_guardian_age_band_chk;
alter table public.guardians add constraint guardians_guardian_age_band_chk
  check (guardian_age_band is null or guardian_age_band in ('20s','30s','40s','50s','60s+'));

alter table public.guardians drop constraint if exists guardians_residence_distance_chk;
alter table public.guardians add constraint guardians_residence_distance_chk
  check (residence_distance is null or residence_distance in ('TOGETHER','NEARBY','FAR','OVERSEAS'));

alter table public.guardians drop constraint if exists guardians_parent_age_band_chk;
alter table public.guardians add constraint guardians_parent_age_band_chk
  check (parent_age_band is null or parent_age_band in ('60s','70s','80s','90s+'));

alter table public.guardians drop constraint if exists guardians_primary_concern_chk;
alter table public.guardians add constraint guardians_primary_concern_chk
  check (primary_concern is null or primary_concern in ('MEDICATION','MEAL','LONELINESS','COGNITIVE','ETC'));

alter table public.guardians drop constraint if exists guardians_preferred_call_slot_chk;
alter table public.guardians add constraint guardians_preferred_call_slot_chk
  check (preferred_call_slot is null or preferred_call_slot in ('MORNING','NOON','EVENING'));

-- ── ② 알림 레벨 (0008 boolean 3종을 덮는 상위 개념) ──
-- 1) nullable 로 먼저 추가한다. "값이 null 인 행 = 아직 백필되지 않은 행" 이라는 표식을 얻어야
--    재실행 시 사용자가 직접 고른 레벨을 덮어쓰지 않는다(멱등의 핵심).
alter table public.guardians
  add column if not exists notify_level text;

-- 2) 기존 보호자 백필 (docs/report-spec.md §3 매핑).
--    notify_call_result=true                        → ALL
--    notify_call_result=false, notify_missed=true   → EXCEPTION
--    둘 다 false                                     → WEEKLY_ONLY
update public.guardians
   set notify_level = case
         when notify_call_result is true then 'ALL'
         when notify_missed is true then 'EXCEPTION'
         else 'WEEKLY_ONLY'
       end
 where notify_level is null;

-- 3) 기본값 EXCEPTION + not null 고정.
--    신규 가입 행은 boolean 기본값과 무관하게 EXCEPTION 으로 시작한다 —
--    평소엔 조용히, 확인이 필요할 때만. 오경보 관리가 곧 제품(THIRD-PLAN P0-3).
alter table public.guardians alter column notify_level set default 'EXCEPTION';
update public.guardians set notify_level = 'EXCEPTION' where notify_level is null;
alter table public.guardians alter column notify_level set not null;

alter table public.guardians drop constraint if exists guardians_notify_level_chk;
alter table public.guardians add constraint guardians_notify_level_chk
  check (notify_level in ('ALL','EXCEPTION','WEEKLY_ONLY'));

-- 조회 편의: 주간 크론이 notify_weekly_summary 로 대상을 고르고, 예외 알림 훅이 notify_level 을 본다.
create index if not exists idx_guardians_notify_level on public.guardians (notify_level);
