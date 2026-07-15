-- 0006_provider_call_id.sql
-- 실벤더(ClawOps) 콜백·전사 상관키: call_sessions.provider_call_id 추가.
--
-- 실행 방법: Supabase SQL Editor에서 이 파일 전체를 그대로 붙여넣어 실행한다.
--   - 0005 이후에 실행(call_sessions 테이블 의존).
--   - 멱등(idempotent): add column if not exists / create index if not exists.
--
-- 배경(CLAUDE.md `## 전화 발신`, docs/telephony.md):
--   ClawOps 발신(POST calls)은 벤더 통화 식별자(CallId, "CA..." 형식)를 부여한다.
--   상태 웹훅(StatusCallback)과 전사 조회(GET .../calls/{callId}/transcript)는 이 CallId 로
--   통화를 지목한다. 우리 세션(call_sessions.id)과 벤더 CallId 를 잇는 상관키가 필요하다.
--
--   1차 상관 경로는 StatusCallback URL 쿼리에 우리 session_id 를 실어 echo 받는 것이지만
--   (URL 은 우리가 구성 — 벤더가 그대로 되부름), 전사 조회처럼 CallId 로만 통화를 지목하는
--   경로를 위해 CallId → session 역조회가 가능하도록 컬럼을 둔다.
--
-- 시간대 규칙(CLAUDE.md): 본 마이그레이션은 시각 컬럼을 추가하지 않는다(text 상관키만).

-- 벤더 통화 식별자(ClawOps CallId 등). null = 아직 발신 트리거 전 / mock 모드.
alter table public.call_sessions
  add column if not exists provider_call_id text;

-- 전사 조회 콜백 등 CallId 기반 역조회용. provider_call_id 존재분만 인덱싱(부분 인덱스).
create index if not exists call_sessions_provider_call_id_idx
  on public.call_sessions (provider_call_id)
  where provider_call_id is not null;

-- RLS: 신규 컬럼은 기존 정책(0003 call_sessions_select_own — 서버 write 전용, 보호자 소유권
--   SELECT 격리)에 그대로 포섭된다. 별도 정책 불필요.
