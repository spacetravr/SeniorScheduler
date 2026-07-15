# SECOND-PLAN.md — ign8t 기반 신규 트랙 (2호 플랜)

> 작성일: 2026-07-15
> 기존 PLAN.md(랜딩 + 보호자 웹)와 **별개의 트랙**. 기존 웹은 그대로 유지하고, 새 작업은 별도 경로에 격리해서 진행한다.

## ⚡ 최종 결정 (2026-07-15 — 이 문서의 결론)
> 사용자 확정 3건. 이후 섹션들은 결정 과정의 기록으로 보존.
1. **v2 별도 트랙 폐기 → 기존 웹으로 통합.** ign8t 백로그 11개 중 UI 계열(앱 셸·대시보드·프로필/복약 CRUD)은 기존 보호자 웹이 이미 커버 → ign8t에서 완료 처리. 나머지 통화 계열 7개 = 기존 PLAN의 Phase 3으로 진행. 별도 경로(app/(v2)) 만들지 않음.
2. **디자인: 현 placeholder 토큰 유지.** 파운더리 케어콜의 웜 팔레트(#F5EFE6/#1E3A5F/#5B9BD5)·lucide 아이콘·KPI 카드/빈 상태 패턴은 **디자인 시안으로 보존** (확정 디자인 작업 시 참고 입력값). 케어콜 코드 자체는 이식 안 함 (Next15/Prisma/자체JWT — 스택 충돌, 동의·UNCERTAIN·원가 부재).
3. **Phase 3 (ARS+ 통화 파이프라인, Mock 발신) 즉시 착수.** LLM은 룰 분류+스텁으로 먼저, ANTHROPIC_API_KEY 오면 연결. 파운더리 보고서 반영: 동의 콜(CONSENT_CALL) 상태 기계 포함(전기통신사업법 대응), 부모님 측 KPI(수락률·완료율) 측정 가능한 스키마.

### ign8t 이어갈 작업
- [Claude] 완료된 UI 태스크 상태 동기화 (update_task_status)
- [Claude] 통화 태스크 구현 시 해당 task_spec 참조, 완료 시 상태 갱신
- [사용자] ign8t 기획 수정: FastAPI→Next.js 풀스택 / 네이티브 앱→모바일 웹 / **동의 콜 태스크 추가** / 녹음 정책(전사만 vs UNCERTAIN 클립) 반영
- [사용자] 전기통신사업법 자문 (파운더리 보고서 P0 — 학교 법률클리닉/무료 스타트업 상담 활용 가능)

## 1. 배경 / 결정사항
- 기존에 만들던 웹(랜딩 `app/(marketing)`, 보호자 웹 `app/(app)`)은 **건드리지 않고 유지**한다.
- 새로운 것은 **다른 경로(별도 라우트 그룹)** 에 만든다. (예: `app/(v2)/**` — 실제 경로명은 Spec 확인 후 확정)
- 기획 도구로 **ign8t** (https://www.ign8t.com) 를 사용한다. ign8t에서 발급받는 **API key로 MCP 연동**하여, Claude Code가 ign8t의 Spec 문서를 직접 읽으며 개발한다.

## 2. ign8t란
- 비즈니스 아이디어 → 가이드 질문 → 기획 블루프린트(비즈니스 기준 / 프로덕트 플로우 / 기술 가드레일) → **개발용 Spec** 생성 도구.
- 산출물: `master-spec.md`, `task-spec.md`, `done-criteria.md`
- 산출된 Spec은 **MCP(Model Context Protocol) 서버**로 노출되어 Claude Code / Cursor / Codex가 동일한 Spec·완료 기준을 읽고 개발할 수 있다.

## 3. 연동 계획 (MCP)
1. ign8t 대시보드에서 프로젝트 생성 + 기획 진행 → Spec 산출
2. ign8t에서 **API key** 및 **MCP 연결 정보**(연결 명령어 또는 서버 URL) 확보 ← **현재 대기 중 (사용자 액션)**
3. Claude Code에 MCP 서버 등록 (`claude mcp add ...` 또는 `.mcp.json`)
   - API key는 채팅에 노출하지 않고 환경변수/로컬 설정으로 관리. `.env.example`에 키 이름만 동기화.
4. 연결 확인: MCP 도구로 `master-spec.md` / `task-spec.md` / `done-criteria.md` 읽기 테스트

## 4. 개발 원칙 (기존 규칙 승계)
- 새 트랙도 CLAUDE.md의 가드레일을 따른다: 파일 소유권 경계, 브랜치 작업(main 직접 커밋 금지), reviewer 검토 후 머지, 디자인 토큰 CSS 변수 참조.
- 기존 랜딩/보호자 웹 파일과 **겹치지 않는 경로**에서만 작업한다. 공유 파일(`types/`, `lib/contracts/`)을 건드려야 하면 contract-first로 처리.
- 무엇을 만들지는 **ign8t Spec이 단일 소스**. Spec 확인 전에 임의로 화면/기능을 만들지 않는다.

## 5. 다음 할 일
- [x] (사용자) ign8t에서 프로젝트/Spec 준비, API key + MCP 연결 정보 전달 (2026-07-15)
- [x] (Claude) MCP 서버 등록 및 연결 테스트 (2026-07-15) — `claude mcp add --scope local ign8t -- npx -y @ign8t/mcp@latest --api-key ...`
  - **local scope** (`~/.claude.json`)에 등록 — API key가 git에 커밋되는 `.mcp.json`에 들어가지 않음. 팀원은 각자 키 발급 후 동일 명령으로 등록
  - `claude mcp list`로 Connected 확인. ⚠️ 도구는 **세션 재시작 후 로드됨**
- [ ] (Claude) 세션 재시작 후 MCP 도구로 master-spec / task-spec / done-criteria 읽기 테스트
- [ ] (Claude) master-spec 읽고 이 문서의 「무엇을 만드는가」 섹션 채우기 + 경로명 확정
- [ ] (Claude) 별도 브랜치(`feat/v2-*`)에서 구현 시작

## 6. 무엇을 만드는가 (2026-07-15 — ign8t Spec 확인 완료)

> ign8t 프로젝트: **"시니어 일정관리 보이스콜"** (id `6a739875-6b1e-4725-94ad-b32fd7fd56d7`, 기획 완성도 100%, ready)
> 산출 문서: master_spec / BRD / PRD / TRD (v1.0, 2026-07-09 생성) + 태스크별 Feature Spec 11개

### 제품 정의 (master_spec 요지)
PSTN 기반 AI 컴패니언 + 일정관리. 시니어 부모는 일반 전화 수신만, 자녀(보호자)는 모바일 앱에서 일정 등록·AI 안심 리포트 확인. 기존 베타(랜딩+보호자 웹)와 같은 사업이지만 **"정식 제품" 스코프의 풀 기획**임.

### 백로그 (11개 태스크, 전부 todo — 다음 추천: "앱 셸과 네비게이션 구조")
- **보호자 앱**: 앱 셸/하단 탭 네비게이션(모바일 웹, max-w 640px, SeniorContext) → 메인 대시보드 → 부모님 프로필·복약 스케줄 CRUD
- **통화 파이프라인**: 예약 발신(PSTN) / 통화 상태 기계 / 미수신 재다이얼(3회·5분 간격)
- **AI 음성**: TTS 음량·주파수 최적화 / SAD 임계값 1.5~2.0초 / STT 신뢰도 판정·예외 처리(Human-in-the-loop)
- **장기 기억**: 이전 통화 맥락 Vector DB 저장 / 개인화 안부 발화 생성

### ⚠️ 기존 CLAUDE.md 가드레일과의 충돌 (구현 전 결정 필요)
| ign8t Spec | 기존 베타 규칙 |
|---|---|
| CLOVA AiCall 확정, 실시간 STT-LLM-TTS (지연 1.5초) | 벤더 미확정(추상화), 실시간 스트리밍 **OUT** |
| FastAPI 백엔드 + Vector DB + Redis | Next.js 단일 풀스택 (스택 변경 시 먼저 질문) |
| 녹음 파일 S3 저장 + Presigned URL | **녹음 원본 미저장(전사만)** |
| 네이티브 앱(iOS/Android) + FCM/APNs 푸시 | 네이티브 앱 **OUT**, 모바일 웹 |
| 월 19,900~29,900원 가격 가정 | 가격 티저 제거(설문으로 측정 중) |
| 라우트 `/`, `/schedules`, `/reports`, `/settings` | `/`는 기존 랜딩과 충돌 → v2 경로 프리픽스 필요 |

→ 세션 #3에서 동일 상위 문서(BRD/TRD) 검토 시 "미확정 유지(사용자 결정)"로 남긴 항목들과 같은 계열. **v2 트랙에서 Spec을 어디까지 따를지(특히 스택·녹음·실시간) 사용자 결정 후 착수.**

### 방향 결정 (2026-07-15 합의)
- **스택: Next.js/TypeScript 단일 유지. FastAPI 서버 분리는 지금 안 함** — 분리가 필요한 유일한 근거(실시간 양방향 1.5초 지연+상시 가동)가 ARS+ 단계엔 없음. 대화 두뇌를 `lib/telephony/`·`lib/ai/`에 격리해 두면 추후 "통화 루프만" 상시 서버로 분리 가능(그때도 언어는 재결정 — Node로도 가능, Python 필연 아님)
- **통화 방식: ARS+ 먼저 (2~4주) → 수요 검증 후 양방향(6~10주) 업그레이드.** ARS+의 뼈대(스케줄러·상태 기계·리포트·원가 로깅)는 양방향에서 전부 재사용 — 버리는 작업 아님
- **Vector DB·Redis: 지금 안 삼. 필요 시 Supabase pgvector로 시작**
- **파운더리(MVP 빌더) 역할 분담**: 파운더리 = 화면·UX 시제품(코드 이식 안 함, 화면 기획서로 수확) / 이 저장소 = 데이터 수집+최종 제품. v2 화면(앱 셸) 착수는 파운더리 결과 확인 후
- ⚠️ 이 결정은 ign8t Spec(FastAPI 확정 기술)과 어긋남 — **ign8t 기획에 "MVP는 Next.js 풀스택, 분리는 실시간 전환 시점 결정"으로 반영 필요 (사용자 액션)**

### 로컬 캐시
Spec 원문은 세션 scratchpad에 저장돼 있음(휘발). 필요 시 MCP `get_documents`/`get_task_context`로 재조회.
