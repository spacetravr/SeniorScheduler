-- 0005_telephony_async_retry.sql
-- 실벤더(비동기) 콜백 모델의 재시도 스케줄링 지원.
--
-- 실행 방법: Supabase SQL Editor에서 이 파일 전체를 그대로 붙여넣어 실행한다.
--   - 0003/0004 이후에 실행(call_sessions 테이블 의존).
--   - 멱등(idempotent): add column if not exists / create index if not exists.
--
-- 배경(CLAUDE.md `## 전화 발신` — 재시도 1분/10분 각 1회, 실패 시 MISSED):
--   mock 모드는 한 통화를 디스패치 라우트가 동기로 완주하므로 재시도를 인라인으로 소진한다.
--   실벤더(clova) 모드는 비동기다: 발신 트리거 → 벤더가 통화 → 결과 콜백.
--   무응답/실패 콜백이 오면 "다음 디스패치 tick 이 재시도 due 세션을 집어가는" 방식으로
--   재시도한다. 이때 재시도 예정 시각을 별도 컬럼(next_attempt_at)에 둔다.
--
-- 왜 scheduled_at 을 재사용하지 않는가:
--   SCHEDULE 콜의 중복 발신 방지 dedup 은 (schedule_id, scheduled_at=발생 instant) 로
--   이뤄진다. 재시도 때 scheduled_at 을 바꾸면 같은 발생분에 대해 중복 세션이 생길 수 있다.
--   → scheduled_at 은 원래 발생 instant 로 고정 유지하고, 재시도 due 판정은 next_attempt_at 로만 한다.
--
-- 시간대 규칙(CLAUDE.md): timestamptz. 앱은 항상 Asia/Seoul 명시로 처리(절대 시각 비교).

-- 다음 발신(재시도) 예정 instant. null = 재시도 대기 아님(초기/발신중/종결).
alter table public.call_sessions
  add column if not exists next_attempt_at timestamptz;

-- 실벤더 재시도 스캔용: status=SCHEDULED 이면서 next_attempt_at 이 도래한 세션 조회.
create index if not exists call_sessions_retry_due_idx
  on public.call_sessions (status, next_attempt_at)
  where next_attempt_at is not null;
