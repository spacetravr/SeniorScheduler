# PLAN.md — 베타 구현 플랜 v2

> 원칙: **UI 먼저(mock 데이터로 화면 완성) → 기능은 점진 결합.** 단, CTA 추적만은 Day 1부터 실데이터.
> 전화 벤더(국내 CPaaS vs CLOVA AiCall)는 미확정 → MockAdapter로 개발 병행, 벤더 확정 시 어댑터만 교체.

---

## Phase 0 — 랜딩 UI + CTA 추적 (최우선, 설문 배포 블로커)
1. 프로젝트 셋업: Next.js + TS + Tailwind + Supabase 연결, 디자인 토큰 CSS 변수 골격(CLAUDE.md 참조)
2. `cta_events`, `waitlist` 테이블 + anon insert RLS
3. 랜딩 `/`: 히어로("앱 설치 없이 전화 한 통으로") → 문제 공감 → 작동 3단계 → 가격 티저(상수 분리) → CTA 2개 [구독하기][베타 사용해보기] → 클릭 기록 → 대기자 모달(이메일) → 저장 → 감사
4. utm 3종 파싱 → 세션 유지 → 전 이벤트 첨부, 진입 VIEW 1회(session_uuid 중복 제거)
5. `/admin/metrics`: ADMIN_PASSWORD 게이트, utm_source별 VIEW→CLICK→SUBMIT 퍼널 표
6. OG 태그, Vercel 배포
- 완료 기준: utm 다른 두 링크로 접속→클릭→제출이 채널별 분리 집계.

## Phase 1 — 보호자 웹 **UI 전체** (mock 데이터)
1. `/app` 대시보드, `/app/seniors`, `/app/schedules`(등록 폼: 유형/제목/안내문구 템플릿/발신시각/반복/ON-OFF), `/app/calls`(리스트+상세), `/app/reports`, `/app/settings` — **전 화면을 mock 데이터로 완성**
2. 상태 뱃지 체계: 예정/완료/미이행/연기/확인필요/불발
3. 피보호자 등록 폼에 **동의 체크박스**(통화 녹취·전사 저장 보호자 대리동의) UI 포함
4. 디자인 토큰 확정 시 이 Phase에서 일괄 반영 (변수 교체만으로)
- 완료 기준: 로그인 없이도 mock으로 전 화면 클릭 가능한 데모.

## Phase 2 — 데이터 결합 (auth + CRUD 실동작)
1. Supabase Auth(magic link), `/app/*` 가드
2. `guardians`/`seniors`/`schedules` 테이블 + RLS, mock → 실데이터 교체
3. RRULE 반복 → 다음 발신 시각 계산 (Asia/Seoul 고정, 유닛 테스트)
4. seniors.consent_at 저장 (동의 없으면 일정 활성화 불가)
- 완료 기준: 일정 등록 → 대시보드에 오늘 인스턴스 정확 표시.

## Phase 3 — 보이스콜 파이프라인 (MockAdapter → 실벤더)
0. **[선행 결정] 발신 벤더 확정**: 국내 CPaaS vs CLOVA AiCall 비교(국내 발신번호, 최소 계약, 베타 비용, API 유무) → CLAUDE.md 전화 섹션 갱신
1. `call_sessions`/`call_turns` + 상태 기계, cron dispatch(중복 방지 unique), **cost_krw 기록**
2. MockAdapter로 전체 파이프라인 완성: 발신→상태 전이→분류(`lib/classify.ts`, 사투리 케이스 유닛 테스트)→재시도(1분/10분)→MISSED
3. 실벤더 어댑터 구현·교체, 첫 통화 도입부 녹음 안내 멘트 포함
4. `/app/calls` mock → 실데이터
- 완료 기준: 실번호 발신→응답→대시보드 반영, 무응답 재시도 2회 후 MISSED, 통화당 원가 기록됨.

## Phase 4 — LLM 후처리 리포트
1. `call_reports`: 통화 후 비동기 1회 호출 → {재검증, 3줄 요약, mood_flag, health_keywords} (의료조언 금지 프롬프트, prompt_version)
2. 대시보드 리포트 표시, 3연속 MISSED 경고 배너, 주간 이행률 차트
- 완료 기준: 실통화 1건에 요약+플래그 자동 노출.

## Phase 5+ (기록만): 실시간 양방향, 알림톡, 결제, 긴급 에스컬레이션 액션, FastAPI 분리

---

## 멀티 에이전트 운영 가이드 (터미널 병렬 작업)

### 추천 구성 (총 3역할 — 이 이상 쪼개지 말 것)
| 역할 | 담당 | 소유 경로 |
|---|---|---|
| **오케스트레이터** = 네가 띄우는 **메인 Claude Code 세션** | 작업 분배, 경계 조정, 머지 결정 | 전체 (조정만) |
| **ui** 에이전트/세션 | 화면·컴포넌트·mock | `app/(marketing|app)/**`, `components/**` |
| **data** 에이전트/세션 | DB·API·lib·텔레포니 | `supabase/**`, `app/api/**`, `lib/**` |
| **reviewer** 서브에이전트 | 머지 전 검증(경계 위반·타입·테스트·가드레일) | 읽기 전용 |

- 별도 "지휘관 에이전트"는 만들지 않는다 — **메인 세션이 곧 지휘관**이고, 지휘 계층을 늘리면 전달 손실만 커짐.
- "연결(통합) 에이전트"도 불필요 — 통합은 contract-first(타입/zod 스키마 선커밋)와 reviewer 검증으로 해결.
- 병렬 실행 방법: `git worktree add ../beta-ui feat/ui-x` 식으로 워크트리 분리 후 터미널 2개, 또는 메인 세션에서 서브에이전트 병렬 위임.

### 운영 절차
1. 메인 세션에서 Phase 태스크를 ui/data로 쪼개 지시 (경계 명시)
2. 각 세션은 자기 브랜치에서 작업, 완료 시 reviewer 서브에이전트 호출
3. reviewer PASS → 메인 세션이 머지. FAIL → 해당 세션에 피드백 반환
4. 공유 타입 변경은 반드시 메인 세션 승인 후 `lib/contracts/` 선커밋

## Claude Code 시작 프롬프트 (메인 세션에 붙여넣기)
```
CLAUDE.md와 PLAN.md를 정독해. 너는 오케스트레이터다.
PLAN.md Phase 0부터 시작한다. UI 우선 원칙과 파일 소유권 경계를 지켜라.
.claude/agents/의 ui-builder, data-api, reviewer 서브에이전트를 활용해 병렬로 작업을 위임하고,
각 작업은 reviewer 검증 통과 후에만 머지한다.
전화 벤더는 미정이므로 lib/telephony/는 MockAdapter로만 구현한다.
Phase 완료마다 동작 확인 방법을 요약하고 내 승인 후 다음으로 넘어가.
```

## 마스터 직접 준비 목록
1. 국내 발신 벤더 비교·확정 (CPaaS vs CLOVA AiCall) — Phase 3 전까지
2. Supabase/Vercel 계정, 가격 티저 문구
3. Claude Design으로 랜딩 방향 2~3안 → 확정 토큰을 CLAUDE.md 디자인 토큰 섹션에 반영
