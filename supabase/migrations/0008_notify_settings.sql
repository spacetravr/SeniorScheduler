-- 0008_notify_settings.sql
-- 보호자(guardians) 알림 설정 3종 추가 — 리포트 이메일 자동 발송 파이프라인의 수신 토글.
--
-- 실행 방법: Supabase SQL Editor에서 이 파일 전체를 그대로 붙여넣어 실행한다.
--   - 0002(guardians) 이후에 실행. 멱등(idempotent): add column if not exists 로
--     여러 번 실행해도 안전하다.
--
-- 스키마 소스: lib/contracts/settings.ts notifySettingsSchema 와 1:1.
--
-- RLS(가드레일 2):
--   - guardians 는 0002 에서 이미 RLS 활성 + guardians_update_own(id = auth.uid()) 정책으로
--     "자기 행 update" 를 허용한다. 이 컬럼들은 그 정책 범위에 포함되므로 추가 정책이 필요 없다.
--   - 값 저장은 lib/actions/settings.ts 가 RLS 클라이언트(server.ts)로 자기 행만 갱신한다.

alter table public.guardians
  add column if not exists notify_call_result boolean not null default true;

alter table public.guardians
  add column if not exists notify_missed boolean not null default true;

-- 주간 요약 메일 수신(기본 OFF) — /api/cron/weekly-report 가 true 인 보호자만 발송 대상으로 조회.
alter table public.guardians
  add column if not exists notify_weekly_summary boolean not null default false;
