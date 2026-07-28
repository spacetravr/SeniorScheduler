# FOURTH-PLAN.md — 리포트 재설계 · 사이트 IA 분리 · 온보딩 · 마케팅 자산 (2026-07-28)

> 사용자 지시(세션 #13): ①리포트를 자녀가 보기 간단·핵심·가독성 좋게 + 이메일/카톡 수신 ②홈페이지를 랜딩(사전등록)과 분리해 기업형으로 ③SNS 카드뉴스 가독성↑·"AI틱함" 제거 ④앱 첫 진입 시 간단한 신상 조사 후 대시보드 ⑤리서치 기반 수정·추가 ⑥확장성 설계 포함
> 상세 설계: `docs/report-spec.md`, `docs/site-structure.md`. 상위 로드맵: THIRD-PLAN.md.

## 0. 확정된 방향 (오케스트레이터 결정 — 사용자 권장안 채택)

| 항목 | 결정 | 이유 |
|---|---|---|
| 카톡 수신 | **공유 버튼 먼저 + 알림톡 어댑터 추상화(스텁)** | 채널 심사(7~10일) 없이 즉시 가동. 심사 끝나면 env 만 채워 활성 — 코드 변경 0 |
| 사이트 구조 | **`/` 홈 · `/service` 서비스 상세 · `/preregister` 사전등록 랜딩** | 유입별 목적 분리. `/` 는 계속 200(외부 링크 무파손) |
| 온보딩 | **2스텝 5문항 · 건너뛰기 허용** | 개인화 + 세그먼트 확보. 조사가 이탈 지점이 되면 안 되므로 재노출 없음 |
| 알림 기본값 | **EXCEPTION(이상 신호만)** | 오경보 관리가 곧 제품(리서치 공통) |

## 1. Lane 0 — 공유 계약 (완료, 오케스트레이터)

- `lib/contracts/report-view.ts` — ReportDigest(3계층·톤·집계) + `EMERGENCY_DISCLAIMER`
- `lib/contracts/notify.ts` — NotifyAdapter·NotifyLevel(ALL/EXCEPTION/WEEKLY_ONLY)
- `lib/contracts/onboarding.ts` — 온보딩 5문항 enum·라벨·기본 시각 매핑
- `lib/reports/digest.ts` — `buildDigest`(집계·판정 단일 소스) + `renderShareText`(카톡/문자 공유) + 테스트 14
- `docs/report-spec.md`, `docs/site-structure.md`

**이후 모든 레인은 이 계약만 참조한다. 계약 변경이 필요하면 임의 수정 금지 — 오케스트레이터에 보고.**

## 2. 레인 분담 (병렬 4레인, git worktree 격리)

| 레인 | 에이전트 | 브랜치 | 소유 경로 |
|---|---|---|---|
| A. 리포트 백엔드·알림·온보딩 서버 | **data-api** | `feat/data-report-notify` | `supabase/**`, `app/api/**`, `lib/**` |
| B. 사이트 IA 3분리 + 리서치 카피 | **ui-builder #1** | `feat/ui-site-ia` | `app/(marketing)/**`, `components/marketing/**` |
| C. 앱 리포트 화면 + 온보딩 화면 | **ui-builder #2** | `feat/ui-report-onboarding` | `app/(app)/**`, `components/app/**` |
| D. 카드뉴스·SNS 자산 리뉴얼 | **general** | `feat/assets-cardnews-v2` | `marketing-assets/**` |

경로가 겹치지 않으므로 동시 진행 가능. 경계를 넘는 수정이 필요하면 **각자 하지 말고 오케스트레이터에 보고**(CLAUDE.md 멀티 에이전트 규칙 4).

### Lane A — data-api
1. `0010_onboarding_notify_level.sql` — guardians 에 온보딩 5컬럼 + `onboarded_at` + `notify_level`(기본 `EXCEPTION`). 기존 boolean 3종은 유지하고 매핑(report-spec §3). 멱등.
2. `lib/notify/` — NotifyAdapter 구현: `EmailAdapter`(기존 `lib/email` 래핑) + `AlimtalkAdapter`(스텁, env 없으면 `skipped`) + 레벨 라우터. **throw 금지, 전부 결과 객체로 강등.**
3. `lib/reports/render/email.ts` — ReportDigest → 600px 인라인 HTML 카드(제목은 안도 프레임). `render/alimtalk.ts` — 템플릿 변수 맵(스텁).
4. 주간 크론: **화요일 09:00 KST**(`0 0 * * 2` UTC)로 변경 + digest 기반 재작성 + 수신거부 링크.
5. 예외 알림 훅: 콜백에서 리포트 생성 직후 `buildDigest("DAY", …)` 로 tone 판정 → `ALERT` 이고 레벨이 `ALL`/`EXCEPTION` 이면 발송. **CALM/ATTENTION 은 보내지 않는다.**
6. `lib/actions/onboarding.ts` — zod 검증 저장 + 건너뛰기(`onboarded_at` 만 기록).
7. 테스트: 레벨 라우팅 매트릭스, 톤별 발송 여부, 이메일 렌더 스냅샷 최소 1, 온보딩 zod.

### Lane B — ui-builder #1
`docs/site-structure.md` 전체 구현. 특히 §4 카피 수정(“대신” 제거·AI 자기고지·119 고지·정직한 판정 전면화), §3 TrustBadges 신규, 리포트 미리보기 **2종**(완료 / 확인 필요), §5 회귀 금지(CTA 추적 무변경·VIEW 중복 금지) 준수.

### Lane C — ui-builder #2
1. `/app/reports` 를 3계층으로 재설계 — `buildDigest` 결과를 렌더. L0 헤드라인(톤 색)·추이 스파크라인, L1 예외 우선 한 줄, L2 접힘 상세(예외만 기본 펼침).
2. 공유 액션 — 기존 "요약 보내기" 모달을 **[메일로 보내기] / [카톡으로 공유] / [복사]** 3버튼으로. 카톡은 Web Share API 우선, 미지원 시 텍스트 복사 폴백. 본문은 `renderShareText` 사용(직접 문자열 조립 금지).
3. 대시보드 상단 **"오늘의 안심 요약"** — 톤 헤드라인 + `tel:` 원버튼(ALERT 일 때만). 기존 3연속 MISSED 배너를 이 안으로 흡수.
4. `/app/onboarding` 2스텝 + 게이트(미완료 && 미건너뜀이면 `/app` 진입 시 이동). 설정에서 재수정 가능.
5. 설정: 알림 토글 3종 → **알림 레벨 3지선다**(라벨·힌트는 `notify.ts` 상수 사용).
6. 리포트·대시보드 하단에 의료 고지 + `EMERGENCY_DISCLAIMER`.

### Lane D — 카드뉴스
Set02 제작 + Set01 리뉴얼. 지시: **"AI틱함" 제거** — 이모지 남발·기계적 대칭·그라데이션 남용·영문 혼용 금지. 큰 글자·여백·문장형 카피·손글씨 느낌의 강조 1점. 리서치 금지어(의료 효능·미구현 기능·"대신") 준수.

## 3. 순서

1. Lane 0 계약 머지 (완료 후 즉시)
2. A~D 병렬 → 각 레인 완료 시 **reviewer** 검토 → main 머지
3. 통합 tsc + 테스트 + build → `/ship` 프로덕션 배포 (세션 #11 미배포분까지 한 번에)
4. 배포 후: SNS 게시·설문 재배포 가동

## 4. 이번 범위에서 뺀 것

- 알림톡 실발송(채널 개설·템플릿 심사 = 사용자 액션 선행), 체험 콜, 리퍼럴 공유, PDF 내보내기, 가족 공동 열람, CLOVA 시나리오 — 전부 THIRD-PLAN 트랙에 남긴다.
