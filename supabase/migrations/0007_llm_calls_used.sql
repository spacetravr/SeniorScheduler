-- 0007_llm_calls_used.sql
-- 통화당 LLM 호출 수 기록: call_sessions.llm_calls_used 추가.
--
-- 실행 방법: Supabase SQL Editor에서 이 파일 전체를 그대로 붙여넣어 실행한다.
--   - 0006 이후에 실행(call_sessions 테이블 의존).
--   - 멱등(idempotent): add column if not exists.
--
-- 배경(CLAUDE.md `## 가드레일` 3: LLM 호출 통화당 최대 2회):
--   실벤더(ClawOps)는 전사 생성이 통화 종료 후 수십 초 걸려, 콜백 시점에 전사가 없으면
--   분류가 UNCERTAIN 으로 남는다. 디스패치 크론의 "전사 백필"이 뒤늦게 전사를 채워 재분류하는데,
--   재분류가 LLM 을 또 호출하면 통화당 2회 상한을 넘을 수 있다. 이를 막기 위해 세션이 지금까지
--   소비한 LLM 호출 수를 기록하고(콜백 COMPLETE 시), 백필 재분류는 남은 예산(2 - used) 안에서만
--   LLM 을 쓴다(0 이면 룰 분류만).
--
-- 시간대 규칙(CLAUDE.md): 본 마이그레이션은 시각 컬럼을 추가하지 않는다(정수 카운터만).

-- 이 세션이 소비한 LLM 호출 수(0~2). null 회피 위해 not null default 0.
alter table public.call_sessions
  add column if not exists llm_calls_used integer not null default 0;

-- RLS: 신규 컬럼은 기존 정책(0003 call_sessions_select_own — 서버 write 전용, 보호자 소유권
--   SELECT 격리)에 그대로 포섭된다. 별도 정책 불필요.
