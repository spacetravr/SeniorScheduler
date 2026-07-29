-- 0012_weekly_summary_default_on.sql
--
-- 주간 요약 메일 수신(guardians.notify_weekly_summary) 기본값을 OFF → ON 으로 뒤집는다.
--
-- 배경: 0008 에서 기본 false 로 만든 뒤, 세션 #13 에서 설정 화면이 알림 레벨 3지선다로
-- 개편되며 이 값을 켤 수 있는 UI 가 사라졌다. 그 결과 어떤 보호자도 true 가 되지 못해
-- /api/cron/weekly-report 의 발송 대상이 항상 0명이었다(주간 메일 전면 미발송).
-- docs/report-spec.md §3 과 components/app/notifyLevel.ts 는 "상위 레벨도 주간 요약을
-- 포함한다"고 명시하므로, 스펙 쪽에 맞춘다.
--
-- 이 마이그레이션 이후:
--   - 신규 가입 보호자는 기본 수신(ON)
--   - 기존 보호자는 백필로 ON
--   - 끄고 싶으면 설정 화면의 "주간 요약 메일" 토글로 언제든 OFF (updateWeeklySummary)
--
-- 멱등: 재실행해도 안전(default 재설정 + 백필은 false 인 행만 갱신).

alter table public.guardians
  alter column notify_weekly_summary set default true;

-- 기존 행 백필. 명시적으로 끈 사람과 구분할 방법이 없는 시점이므로(끄는 UI 자체가 없었음)
-- false 는 전부 "설정한 적 없음"으로 간주해 ON 으로 올린다.
update public.guardians
   set notify_weekly_summary = true
 where notify_weekly_summary = false;
