-- 0004_consent_dispatch.sql
-- CONSENT(본인 동의) 콜 자동 예약·디스패치 연결 지원.
--
-- 실행 방법: Supabase SQL Editor에서 이 파일 전체를 그대로 붙여넣어 실행한다.
--   - 0003 이후에 실행(call_sessions 테이블 의존).
--   - 멱등(idempotent): create ... if not exists 로 여러 번 실행해도 안전.
--
-- 배경(CLAUDE.md `## 데이터 모델`, 가드레일 5):
--   피보호자 등록 시 대리동의(consent_at)만 있고 본인동의(self_consent_at)가 없으면
--   서버(seniors Server Action)가 purpose=CONSENT / status=SCHEDULED 세션을 예약하고,
--   cron 디스패치가 due 인 CONSENT 세션을 동의 콜 엔진으로 실행한다.
--
-- write 정책은 기존 아키텍처(0001/0003)를 그대로 유지한다:
--   call_sessions 는 서버 secret key(RLS 우회) 전용 write. 클라이언트 write 정책 없음.
--   → CONSENT 세션 insert 도 서버(admin 클라이언트)에서만 일어난다.
--
-- 이 마이그레이션이 추가하는 것: **중복 예약 방지 DB 백스톱**.
--   앱 레벨(shouldScheduleConsentCall)에서도 막지만, 동시 요청(대리동의 토글 연타 등)
--   경합에서도 "senior 당 열린 CONSENT 세션은 최대 1개" 를 DB가 보장한다.
--   앱은 이 unique 위반(23505)을 "이미 예약됨"(정상)으로 취급한다.

create unique index if not exists call_sessions_one_open_consent_idx
  on public.call_sessions (senior_id)
  where purpose = 'CONSENT' and status in ('SCHEDULED', 'DIALING', 'IN_PROGRESS');
