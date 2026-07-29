# PROGRESS.md — 세션 인수인계 로그

> **규칙**: 컨텍스트 compact 임박 또는 큰 작업 단위 완료 시 이 파일을 갱신하고 `/clear`.
> 새 세션은 CLAUDE.md → PLAN.md → 이 파일 순으로 읽고 재개.
> 최신 항목이 **위**. 형식: 완료 / 진행 중 / 다음 할 일 / 결정사항 / 블로커.

---

## 세션 #14 (2026-07-29) — 프로덕션 배포(누적 3개층 해소) + 전체 점검

### 현재 상태 한 줄 (세션 종료 시점 — main 5d71f68 이후 문서 커밋 포함)
**프로덕션 최신 배포 완료(주간 요약 토글 포함) · 0012 적용 완료 · 테스트 476/476. 다음 세션은 아래 "다음 할 일" 0번(공개 저장소 비밀번호 노출 교체)부터 시작할 것.**

### 배포 시점 상태 한 줄
**main(bf7581f) 프로덕션 배포 완료 — 세션 #11+#13 누적 미배포 전부 해소. 테스트 476/476·tsc·build 통과, prod 스모크 PASS. Resend 키 등록 완료. ⚠️ 최대 발견: GitHub Actions `call-dispatch` 워크플로가 `disabled_manually` 상태 → 7/17 이후 통화 세션 0건.**

### 완료
- **프로덕션 배포 3회**: ① 누적 분량 배포 ② RESEND_API_KEY 등록 후 반영 ③ 전화번호 표시 핫픽스 반영. 최종 dpl = `seniorscheduler-qiunno4v7`
- **[사용자] Resend 가입·키 발급 완료** → Vercel Production env `RESEND_API_KEY` 등록(Sensitive). 키 종류는 **sending-only 제한 키**(관리 API 401 = 정상, 최소 권한). ⚠️ 키가 채팅에 평문 노출됐으므로 추후 rotate 권장. `RESEND_FROM` 미설정 → 기본 `onboarding@resend.dev`(도메인 미인증 상태에선 **가입 이메일 본인에게만** 발송 가능)
- **prod 스모크 PASS**: 공개 8경로 200 / `/app` 307 / 구도메인 308 / CTA 204 / waitlist 201 / 테스트 행 삭제 검증(잔여 0) / admin 200
- **보안 점검 PASS**: 크론 2종 POST-only(GET 405, 잘못된 시크릿 거부) / 텔레포니 콜백은 세션 식별 실패 시 404, 통과해도 HMAC 토큰 검증 후에야 처리 / Supabase REST에서 PII 컬럼 조회는 로컬 정책이 차단
- **앱 기능 점검(로컬 dev + 프로덕션 DB, Playwright)**: 로그인 → 대시보드(안심 요약·오늘 일정 6건·이행률 "기록 없음") → 리포트 3계층(일별 5일치, **집계 합계 전부 일치 확인**: 7/14 5=2+1+1+1, 7/15 6=4+1+1, 7/16 6=3+3) → 통화기록 기간 필터(최근 3일 0건 + "이전 기록 50건" 안내) → 일정 6건 토글 ON 표시 → 피보호자 2명 "동의 완료" → 설정(알림 레벨 EXCEPTION 저장 상태 유지·온보딩 재작성 링크). **콘솔 에러 0**
- **핫픽스(패스트트랙)**: `fmtPhone` 신설 — 피보호자 목록에서 `01039034652` / `010-3903-4652` 가 나란히 보이던 표시 불일치 해소(표시 전용, 저장값 무변경, 테스트 6개 → 470→476)
- 홈 히어로 "빈 박스"는 풀페이지 스크린샷 로딩 타이밍 artifact — 실제로는 정상 렌더(원본 6.4MB → `/_next/image` 최적화 27KB, 0.12s)

### 세션 #14 후반 — 메일 파이프라인 점검 + 주간 요약 미발송 버그 수정 (main c7d9a11, 배포 완료)
- **버그 발견·수정**: 세션 #13 알림 레벨 3지선다 개편 때 `notify_weekly_summary` 를 켤 UI 가 사라짐 + 컬럼 기본값 false(0008) → **주간 메일 발송 대상이 영구 0명**이었음(크론은 `notify_weekly_summary=true` 만 조회). 스펙(report-spec §3·notifyLevel.ts)은 "상위 레벨도 주간 요약 포함"이라 스펙 쪽으로 정렬:
  - `0012_weekly_summary_default_on.sql` — 기본값 true + 기존 행 백필(멱등). **⚠️ 사용자 SQL Editor 실행 대기**
  - `getWeeklySummary`/`updateWeeklySummary` 서버 액션 + `WeeklySummaryToggle`(설정 알림 섹션, 낙관적 갱신)
  - 레벨은 통화 직후 알림만 관장. WEEKLY_ONLY 선택 시에만 주간 수신 강제 ON. `DEFAULT_NOTIFY_SETTINGS` 재동기화
  - 로컬 UI 실조작 검증: 토글 ON → DB `notify_weekly_summary=true` 반영 → 새로고침 유지 확인
- **Resend 실발송 스모크 PASS**: 더미 리포트 3건 → `buildDigest("WEEK")` → `renderReportEmail` → `ResendAdapter` 실호출 → `{ok:true}`. 제목 `[주간 리포트] 7월 22일 ~ 7월 28일 · 이상 신호 2건`, HTML 3,640바이트. **가입 이메일(spacetr17@khu.ac.kr) 수신 확인 필요**. 임시 테스트 파일은 검증 후 삭제
- **메일 경로는 2개뿐**: ① 예외 알림(통화 리포트 직후 `notifyExceptionForSession` → 오늘 KST 다이제스트 톤 판정 → `shouldNotify` → Resend) ② 주간 요약(화 09:00 KST 크론). 둘 다 `notify_log` 하루 1회 상한, 어떤 경로도 throw 금지
- **Resend 제약 정리**: 무료 플랜 월 3,000통·일 100통, **검증 도메인 1개 포함 — 결제 불필요**. 현재 발신자 `onboarding@resend.dev` 는 가입자 본인에게만 발송 가능 → 외부 보호자 발송하려면 도메인 소유 + DNS 인증 + `RESEND_FROM` 교체 필요

### 발견 — 조치 필요 (사용자 결정)
1. **`call-dispatch` 워크플로 `disabled_manually`** (실행 이력 0건). 이것이 7/17 이후 통화 세션 0건의 단일 원인. 피보호자 2명 모두 `consent_at`+`self_consent_at` 완료 상태이고 활성 일정 6건이 켜져 있으므로, **워크플로를 켜는 즉시 실제 번호(010-3903-4652)로 진짜 전화가 발신됨**. ClawOps TTS 품질 이슈가 미해결이므로 켜기 전 사용자 승인 필수
2. **GitHub Actions 스케줄 지연**: uptime(`*/10`)이 실제로는 1~1.5시간 간격으로 실행됨(GitHub best-effort). 발신 정밀도가 필요해지면 벤더 스케줄러/Vercel Cron 이전 검토
3. weekly-report 실행 이력 1건(7/27 화, success) — 당시 Resend 키가 없어 skip. **다음 발송: 8/4(화) 09:00 KST 부터 실제 메일 발송 시작**

### 세션 #14 종료 시점 상태 (2026-07-29 마감)
- ✅ **[사용자] 0012 마이그레이션 실행 완료** — guardians 2행 모두 `notify_weekly_summary=true` 확인. 주간 발송 대상 2명
- ⚠️ 단, **8/4(화) 크론도 메일을 보내지 않는다**: 크론은 "지난 7일 리포트 0건이면 빈 메일 미발송"인데 통화가 7/17 이후 0건이라 수집 결과가 비어 있음. **통화가 살아나야 주간 메일도 실제로 나간다**
- 사용자 지시로 **여기서 세션 종료**. 아래 목록을 다음 세션이 그대로 이어받을 것

### 다음 할 일 (우선순위 — 다음 세션은 여기부터)

> **0번은 오늘 발견된 열려 있는 보안 구멍이다. 다른 어떤 작업보다 먼저 처리할 것.**

0. 🔴 **공개 저장소에 평문 자격증명 노출 — 즉시 교체 필요**
   - `github.com/spacetravr/SeniorScheduler` 는 **public**(`"private": false` API 확인). 그런데 이 파일 `PROGRESS.md` 에 아래가 커밋돼 있음:
     - 앱 로그인 비밀번호 `ansim-beta-0707` (spacetr17@khu.ac.kr) — **세션 #14 에서 실제 로그인 성공 = 지금도 유효**
     - `ADMIN_PASSWORD` = `vs-beta-2026` (`/admin/metrics` 게이트)
   - 영향: 누구나 저장소를 읽고 로그인해 **피보호자 2명의 실명·생년·전화번호 열람 가능**
   - 조치: ① 앱 비밀번호 교체(사용자가 설정 화면에서 또는 admin API) ② `ADMIN_PASSWORD` 교체 + Vercel env 갱신 + 재배포 ③ 저장소 private 전환 검토
   - **주의: git 히스토리에 옛 값이 남으므로 문서에서 지우는 것만으로는 무효. 값 자체를 교체해야 함**
1. **[사용자 결정] 통화 파이프라인 재개 방식** — 세션 #14 에서 4안 제시했으나 사용자가 선택 보류:
   - (a) `TELEPHONY_PROVIDER=mock` + call-dispatch ON → 실전화 없이 리포트·알림·주간메일 전 경로 실데이터 검증 (오케스트레이터 권장)
   - (b) ClawOps 그대로 실발신 1회 → TTS 품질 직접 확인. 켜는 즉시 활성 일정 6건이 모두 발신 대상이 되므로 일정 정리 선행 필수
   - (c) CLOVA AiCall 트랙 재개 (벤더 결정 필요)
   - (d) 통화는 두고 도메인 인증·베타 위생 항목 먼저
2. **동의 콜(CONSENT) 경로 실행 검증 — 법적 리스크 최상위**
   - `call_sessions.purpose=CONSENT` **0건**. 전기통신사업법 대응 경로인데 유닛 테스트 17개만 있고 실행 이력이 없음. 현재 두 피보호자의 `self_consent_at` 은 테스트 중 수동으로 채운 값
   - 실사용자가 피보호자를 등록하면 **가장 먼저 타는 경로**이므로 베타 오픈 전 반드시 1회 검증
3. **운영 관측 강화** — `call-dispatch` 12일 침묵을 아무도 몰랐던 게 근거. `daily-report` 는 CTA 퍼널·대기자 등 **마케팅 지표만** 담고, `call-dispatch.yml` 은 "발신 실패 시 이슈 생성하지 않음"이 명시. "어제 발신 0건 / 알림 발송 실패 / 크론 침묵"을 일일 리포트에 추가하면 동일 사고를 다음 날 잡음
4. **프로덕션 DB 테스트 데이터 정리** — `call_sessions` 160건·`call_reports` 160건이 전부 테스트 산출물인데 `cost_krw` 까지 실데이터처럼 기록됨. 실사용자 유입 시 이행률·원가·주간 리포트 오염. 삭제하거나 테스트 구분 플래그 도입
5. **원가·가격 검증(가능해짐)** — `cost_krw` 통화당 60원 실측 존재. 하루 1회 × 30일 = 월 1,800원 원가 vs 티저가 월 9,900원. 마진·손익분기 계산으로 사전등록 페이지 가격에 근거 부여
6. **[사용자] Resend 도메인 인증** — 무료 플랜에 검증 도메인 1개 포함(결제 불필요). 현재 `onboarding@resend.dev` 는 가입자 본인에게만 발송 가능하므로, 외부 보호자에게 보내려면 도메인 소유 + DNS 인증 + `RESEND_FROM` 교체 필요
7. CLOVA AiCall 트랙 재개(통화 품질 — 여전히 최대 리스크)
8. 세션 #13 논블로킹 후속 목록(그대로 유효)

### 마케팅 (2026-07-29 사용자 지시)
- **마케팅 실행은 사용자가 직접 담당한다.** 에이전트는 자산만 만들어 두고 게시·배포·채널 운영은 하지 않는다
- 사용 가능한 자산: `marketing-assets/cardnews/`(Set01·Set02, 1080×1080 PNG 12장), `marketing-assets/sns-kit.md`(캡션·해시태그·utm 규칙·2주 캘린더)

---

## 세션 #13 (2026-07-28) — 리포트 재설계 · 사이트 IA 3분리 · 온보딩 · 카드뉴스 (contract-first 4레인 병렬)

### 현재 상태 한 줄
**main(06ed7d3) = FOURTH-PLAN 4레인 + 후속 3레인 전부 머지, 테스트 470/470·tsc·build 통과. 0010·0011 마이그레이션 적용 완료. 로컬 실조작 스모크 PASS. ⚠️ 프로덕션 미배포(세션 #11+#13 누적) — 사용자 승인 대기. 남은 사용자 액션은 Resend 키뿐.**

### 사용자 지시 (세션 시작)
①리포트를 자녀가 보기 간단·핵심·가독성 좋게 + 이메일/카톡 수신 ②홈페이지를 랜딩(사전등록)과 분리해 기업형으로 ③카드뉴스 가독성↑·"AI틱함" 제거 ④앱 첫 진입 시 간단한 신상 조사 후 대시보드 ⑤리서치 기반 수정·추가 ⑥확장성 설계 ⑦agent별 역할 분담 후 실행

### 결정사항 (오케스트레이터 — 사용자 미응답으로 권장안 채택)
- **카톡 = 공유 버튼 먼저 + 알림톡 어댑터 스텁**. 채널 심사(7~10일) 없이 즉시 가동, 심사 후 env만 채우면 활성(코드 변경 0)
- **사이트 = `/` 홈 · `/service` 서비스 상세 · `/preregister` 사전등록 랜딩** 3분리. `/` 는 계속 200(외부 링크 무파손)
- **온보딩 = 2스텝 5문항 · 건너뛰기 허용**, 재노출 없음
- **알림 기본값 = EXCEPTION(이상 신호만)**

### 완료 — Lane 0 계약 (오케스트레이터, bfbe379)
- `lib/contracts/report-view.ts`(ReportDigest 3계층·톤·집계+`EMERGENCY_DISCLAIMER`) / `notify.ts`(NotifyAdapter·레벨 3종) / `onboarding.ts`(5문항 enum)
- `lib/reports/digest.ts` — `buildDigest`(집계·판정 **단일 소스**) + `renderShareText`(카톡 공유) + 테스트 14
- `docs/report-spec.md`(리포트 설계 본문), `docs/site-structure.md`(사이트 IA), `FOURTH-PLAN.md`

### 완료 — 4레인 (전부 reviewer PASS 후 머지)
- **Lane B 사이트 IA** (feat/ui-site-ia → 12f8904): `/service` 신설 + `/` 기업형 홈 재작성 + `/preregister` 정리 / `TrustBadges` 신규(본인동의·녹음미저장·AI자기고지·언제든해지) / **"대신" 프레이밍 전면 제거**(마케팅 경로 grep 0건 — inTouch 역풍 근거) / AI 자기고지 FAQ 신설 / 푸터 119 고지 / ReportPreviewCard variant 2종(완료·확인필요) + "억지로 판단하지 않습니다" 전면화. **CTA 추적 4파일 무변경 확인**
- **Lane D 카드뉴스** (feat/assets-cardnews-v2 → ffb5970, 패스트트랙): Set01 리뉴얼 + **Set02 신규(리포트 소개 — 정직한 판정 전면화)**, PNG 12장 1080×1080, 캡션 2종, README(재생산 절차). AI틱함 제거 = 이모지·불릿·도트 인디케이터 삭제, 레이아웃 5종 분화, 영문 워드마크→한글 Pretendard, 헤드라인 78~96px
- **Lane A 백엔드** (feat/data-report-notify → b5891e1): 0010 마이그레이션(온보딩 5컬럼+`notify_level`, 멱등 백필·CHECK, 기존 RLS 커버) / `lib/notify/`(어댑터+레벨 라우터, **throw 금지**·PII 무로그) / 이메일 카드 렌더러(600px 인라인·이스케이프·고지 2종·수신거부) / 주간 크론 **화요일 09:00 KST**(`0 0 * * 2`) / 예외 알림 훅(콜백·디스패치 2지점, 이중 try/catch로 통화 파이프라인 무영향) / 온보딩 서버액션
- **Lane C 앱 화면** (feat/ui-report-onboarding → b5891e1): 리포트 3계층(L0 톤 카드+스파크라인 / L1 예외 우선 / L2 예외만 기본 펼침) / 공유 3버튼(메일·카톡·복사, `renderShareText` 사용, Web Share→클립보드 폴백) / 대시보드 "오늘의 안심 요약"(ALERT 시 `tel:` 원버튼, 3연속 MISSED 배너 흡수) / `/app/onboarding` 2스텝 / 알림 레벨 3지선다(NotifySettingsForm·NotifyToggle 삭제)

### 사고·교훈
- **A↔C 시그니처 불일치 tsc 4건** — Lane C 지시문엔 서버액션 시그니처를 명시했으나 Lane A엔 반환형까지 주지 않아 발생. 오케스트레이터가 조정(82e352e). **교훈: 레인 간 접점 함수는 계약 파일에 시그니처까지 박아야 한다**(이번엔 프롬프트로만 전달)
- **잠재 사고 1건 차단**: 원설계대로면 0010 미적용 시 조회 실패 → 전 사용자가 온보딩에 갇힘. `available:false` 구분해 **fail-open** 으로 수정
- `git add -A` 가 워크트리 4개를 임베드 저장소로 커밋 → 되돌리고 `.claude/worktrees/` gitignore 추가(반복 문제 근절)

### 세션 #13 후반 — 로컬 스모크 + 후속 3레인 (E·F·G) + /metrics-report 스킬

- ✅ **[사용자] 0010·0011 마이그레이션 실행 완료** (REST 200 검증)
- **로컬 실조작 스모크 PASS** (Playwright, 프로덕션 DB 대상 로컬 dev): 로그인→온보딩 게이트 이동→5문항 저장(DB 반영 확인)→대시보드 안심 요약→리포트 3계층→공유 모달→알림 레벨 EXCEPTION 저장(DB 반영 확인). 마케팅 5경로 200
- **스모크에서만 잡힌 버그 2건 수정** (3f714fe — 테스트·빌드는 통과했으나 실화면에서만 드러남):
  ① `digest` subline 에 **미이행(NOT_DONE) 누락** → headline "N건"과 내역 합 불일치(리포트 신뢰 직결). 종류별 전수 표기 + 합계 일치 테스트 추가
  ② 대시보드 "이번 주 이행률 0% (0/0건)" → "이번 주 기록 없음", 분모에서 MISSED 제외해 buildDigest 규칙과 통일
- **Lane E** (feat/ui-onboarding-usage): 온보딩 답변 → 일정 폼 프리필(`schedulePrefill.ts`+테스트 14, 시각은 `callSlotDefaultTime` 계약 참조 / 걱정거리는 MEDICATION·MEAL 만 매핑, 나머지 억지 매핑 금지) / **온보딩을 `app/(onboarding)/` 라우트 그룹으로 분리**(URL·미들웨어 불변, 앱 레이아웃 무수정 — 스모크에서 발견한 "사이드바로 설문 우회" 차단) / 리포트 배지 "확인 필요 N건"→**"살펴볼 일 N건"**(UNCERTAIN 라벨과 혼동 제거)
- **Lane F** (feat/ui-about-revamp): `/about` 전면 재작성 — 왜 만들었나 / **지키는 원칙 7**(억지 판정 금지·본인 동의·녹음 미저장·AI 자기고지·불필요 알림 금지·의료 조언 금지·119 대체 금지) / 하지 않는 것 4 / 베타 현황. `/service` 와 문장 단위 중복 0. **팀·법인 정보는 확인 불가라 기재하지 않고 그 사실을 페이지에 명시**
- **Lane G** (feat/data-notify-dedupe): `0011_notify_log.sql` + 하루 1회 상한. **지시(조회→발송→기록)를 에이전트가 뒤집어 선점(insert)→발송→실패 시 해제(release)로 구현** — 조회-후-기록은 크론 겹침 시 둘 다 발송한 뒤 한쪽만 튕기므로 메일이 이미 두 통 나감. unique 인덱스가 발송 **전에** 판정하게 만든 판단이 옳아 그대로 채택. fail-open(0011 미적용=42P01 → 상한 없이 발송), KST 경계 테스트, 채널별 독립
- **오케스트레이터**: 신뢰 배지에 **"억지 판정 없음" 추가(4→5, 첫 배지)** — THIRD-PLAN §0-1 의 유일한 차별축이 정작 배지에 없었음. 나머지 4개는 경쟁사도 말할 수 있는 위생 요소
- **`/metrics-report` 스킬 신설** (864e126): `.github/scripts/weekly-metrics.mjs`(최근 7일 vs 직전 7일 채널별 퍼널, KST·오늘 제외, daily-report 와 집계 정의 일치, 읽기 전용·PII 미조회) + SKILL.md(해석 가이드·"이번 주 액션 1개" 도출·실데이터만/판정 보류 규칙). **첫 실행 결과: 최근 7일 방문 1·제출 0 (직전 7일 방문 12·제출 2 = 방문→제출 17%, 표본 12라 판정 보류). 유입이 멈춘 상태 = 배포·게시 지연 때문**
- reviewer PASS 2회(F 단독 / E+F+G 통합). 최종 main **06ed7d3**, 테스트 **470/470**·tsc·build 통과

### 다음 할 일
1. **배포** (세션 #11+#13 누적 3개 층 — 사용자 승인 대기). 배포 후 SNS 게시·설문 재배포 가동 → 유입 재개
2. **[사용자] Resend 키** — 남은 유일한 사용자 액션. 없으면 주간 메일 조용히 skip. 발송 요일 월→화 변경됨
3. **[사용자] CLOVA AiCall 트랙 재개** — 통화 품질이 현재 최대 리스크(ClawOps TTS 어색 판정 후 세션 #8 상태로 정지). 웹·리포트·마케팅만 앞서가는 중
4. 후속(논블로킹): `notify_log` 90일 정리 잡 / release 실패 시 채널 하루 잠김 — 카운터 관측 / `NotifyLevelForm` 초깃값을 `getNotifyLevel()` 직접 사용 / `composeWeeklyDigest` 데드코드 제거 / 연속 MISSED 승격을 `buildDigest`로 하향 / 문의 이메일이 `/`·`/about` 중복 하드코딩 / `preferred_call_slot` 을 피보호자 등록 직후 첫 일정 추천에도 연결
5. **알림톡 도입 시 선행**: `guardians.phone` 컬럼 없음 — 수신자 필드 추가 마이그레이션 필요(어댑터·렌더러·상한은 준비 완료)

---

## 세션 #12 (2026-07-27) — 레퍼런스 리서치 4종 + 고도화 재계획 (THIRD-PLAN·MARKETING-PLAN)

### 현재 상태 한 줄
**리서치·계획 세션(코드 무변경). docs/research/ 벤치마크 4건 + THIRD-PLAN.md + MARKETING-PLAN.md 신설. ⚠️ 세션 #11 분량 프로덕션 미배포 상태 그대로 — 여전히 최우선.**

### 완료
- **웹 리서치 4건 병렬 수행 → docs/research/에 보존**: benchmark-domestic(국내 경쟁사— 직접 경쟁은 위식스 월 4,950원 사실상 유일, B2G는 리포트가 공무원에게 가는 구조적 공백), benchmark-global(해외 — iamfine 15년 생존, PSTN·DTMF·UNCERTAIN 전부 업계 검증 정답, "일정 이행 확인" 1차 가치는 글로벌에도 없음), benchmark-ux(Life360·케어닥·똑닥·Medisafe — 예외 기반 알림, 스트릭 금지, 알림톡 열람 90%+, 리버스 트라이얼), benchmark-gtm(채널 — 케어네이션식 데이터 PR, 체험 콜, B2G 리드타임표)
- **THIRD-PLAN.md 신설**: P0(알림 3단 레벨·MISSED 패턴 에스컬레이션+tel: 버튼·안심 요약 대시보드·주간 카드화(화요일)·119 대체 아님 고지·통화 종료 룰) / P1(알림톡⚠️·자녀 녹음 인트로⚠️·히트맵·PDF·일시정지) / P2(리버스 트라이얼·가족 열람·Care Circle) + 에이전트 사업 운영(주간 케이던스, 스킬 9종 우선순위) + 사용자 결정 필요 5건 표
- **MARKETING-PLAN.md 신설**: Phase 0(무예산 — 설문 세그먼트 2문항 추가·릴스 전환·미니 데이터 PR·카피 뱅크)→Phase 1(메타/카카오모먼트/당근, CPA 5천~1.5만 밴드)→제휴 트랙(복지관 파일럿 1~3개월 최단). 금지 채널 명시(맘카페 침투 바이럴 등)

### 다음 할 일
1. **배포** (세션 #11 분량 — 변동 없이 최우선, 사용자 승인 대기)
2. THIRD-PLAN §5 사용자 결정 5건: 알림톡 IN/OUT, 자녀 녹음 인트로, 주간 메일 화요일 변경, 체험 콜, (기존) Resend 키
3. 결정되면 P0 묶음(0-3~0-8)을 ui/data 2레인 착수 + CLOVA 시나리오 트랙 재개
4. /metrics-report·/content 스킬 구축 → MARKETING-PLAN Phase 0 가동

---

## 세션 #11 (2026-07-26) — 통화 외 4트랙 일괄 (랜딩·이메일·UX·크레딧, 2웨이브 5레인 병렬) + 홈페이지·SNS 자산

### 현재 상태 한 줄
**main(d98516f) = 앱 4트랙+홈페이지 4페이지+SNS 자산 전부 머지·push, 테스트 362/362, 0008·0009 적용 확인. ⚠️ 프로덕션 미배포(사용자 승인 대기) — SNS 게시·설문 재배포 전에 반드시 먼저 배포할 것(새 FAQ/약관/소개 페이지·앱 개선이 아직 프로덕션에 없음). Resend 키 미등록(주간 메일은 배포+키 등록 후 활성).**

### 완료 (전부 reviewer PASS 후 main 머지, 최종 테스트 **362/362**. ⚠️ 프로덕션 미배포 — 사용자 승인 대기)
- **랜딩 개선** (feat/ui-landing-faq-seo → 4da7a28): FAQ 7문답 아코디언(components/marketing/FaqSection.tsx+faqData.ts 단일 소스, FAQPage JSON-LD) / 루트·preregister metadata 보강(키워드·OG·twitter·canonical) / app/sitemap.ts·robots.ts 신설(/app·/admin disallow) / 히어로 서브카피 Status Quo 프레이밍("매일 전화로 '약 드셨어요?' 확인하기, 언제까지…"). CTA 추적 무변경
- **리포트 이메일 자동 발송 백엔드** (feat/data-email-settings → bb757f2): lib/email/(EmailAdapter+ResendAdapter fetch 직접·의존성 0, 키 없으면 skip 폴백) / 0008 마이그레이션(guardians notify 3컬럼) / lib/contracts/settings.ts+lib/actions/settings.ts / reportSummary 순수 함수 lib/reports/summary.ts 이관(components에 1줄 재수출 심 — 승인된 경계 예외) / lib/reports/weekly.ts(KST 완전 7일 반개구간) / app/api/cron/weekly-report(Bearer CRON_SECRET, PII 무로그, 의료 고지 부착) / weekly-report.yml(월 09:00 KST=UTC `0 0 * * 1`, 기존 CRON_SECRET 시크릿 재사용)
- **앱 UX 묶음** (feat/ui-ux-polish → bfa4113): 요약 보내기 모달 클립보드 실패 시 role=alert 안내+수동 복사 강조(성공 경로·mailto 무변경) / components/app/Skeleton.tsx+앱 8개 라우트 loading.tsx 스켈레톤(시드니 DB 지연 체감 개선)
- **설정·차트·배너** (feat/ui-settings-chart-banner → baf61a1): 알림 토글 3종 실저장(NotifySettingsForm 낙관적+실패 롤백, "저장 안 됨" 문구 제거, 주간 요약 토글=이메일 발송 대상 연결) / 리포트 주별 뷰 요일별 이행률 순수 CSS 막대(aria-label) / 대시보드 3연속 MISSED 경고 배너(missedStreak.ts 순수 함수+테스트 6, SCHEDULE만·최신 3건)
- **크레딧 실데이터화** (feat/data-credits → 80471c2 + feat/ui-credits-live → 머지): 0009 credit_ledger(부분 unique 2종=차감·가입보너스 멱등, RLS select만·write 서버 전용) / 가입 120(CREDIT_SIGNUP_GRANT, 첫 조회 시 지연 적립) / SCHEDULE+COMPLETED당 -1(CONSENT·MISSED 무차감, 실패 throw 금지) / 차감 hook 2지점(dispatch mock 경로·콜백 COMPLETE) / **발신 차단 없음(베타 무료 정책)** / UI: MOCK_CREDITS 제거, layout 1회 getMyCredits()→배지·billing 실잔액(실패 시 "-")

### 결정사항
- 이메일 벤더 = **Resend, fetch 직접 호출(신규 npm 의존성 0)**. 키 없으면 조용히 skip이라 머지·배포 무해. 발신자 기본 onboarding@resend.dev(테스트용) — 실서비스는 도메인 인증 후 RESEND_FROM 교체
- 크레딧 정책 = 표시용(가입 120, 완료 콜당 1). 잔액 차단·실결제 없음, 가격 숫자 미표기 유지
- ui 에이전트 커밋 누락 사고 1건(feat/ui-settings-chart-banner) → 오케스트레이터가 reviewer 검증본 그대로 커밋해 수습. **교훈: ui/data 에이전트 지시문에 "git commit까지 완료+해시 보고" 명시할 것** (이후 태스크부터 반영됨)

### 세션 #11 후반 (2026-07-26) — 홈페이지·SNS 홍보 자산
- ✅ 0008·0009 마이그레이션 **적용 확인** (사용자 실행, REST 200 검증). GitHub Actions 정상 가동 확인(daily-report 이슈 #14 생성 중) — 사용자 미수신 원인은 GitHub 알림 메일 설정 쪽(github.com/settings/notifications 확인 필요)
- **홈페이지 멀티 페이지 확장** (feat/ui-site-pages → reviewer PASS(랜딩 추적·시각 회귀 0) → 머지 095e02e): /about(3단계 상세·상태 뱃지 의미·안심 설계)·/faq(신규 3문답 추가: 집전화/통화 길이/해지)·/terms(베타 v0.9)·/privacy + SiteHeader/SiteFooter/PageShell 공용화(랜딩 인라인 추출, PreregisterButton 추적 유지·신규 페이지는 비추적 PreregisterLink) + sitemap 4경로
- **SNS 카드뉴스 Set01** (marketing-assets/cardnews/, 커밋 edb219d): 1080×1080 PNG 6장(커버→공감→소개→3단계→안심→CTA), 브랜드 토큰·Pretendard. set01.html 템플릿 수정→로컬 서버(8787)→Playwright 요소 캡처로 재생산 가능 (file:// 차단이라 HTTP 서버 필요)
- **SNS 운영 키트** (marketing-assets/sns-kit.md): 인스타 프로필 문구·첫 게시물 캡션+해시태그·utm 규칙(instagram/social/campaign별)·2주 캘린더·운영 수칙(미구현 기능·의료 효능 언급 금지)
- 사용자에게 로그인 계정 전달됨(spacetr17@khu.ac.kr / 임시pw는 이 파일 세션 #4 로그) — **비밀번호 변경 재권고 상태**

### 다음 할 일 / 사용자 액션
1. ~~[사용자] 0008+0009 마이그레이션 실행~~ ✅ 완료 (2026-07-26, REST 검증)
2. **[사용자] Resend**: 가입 → API 키 → Vercel env `RESEND_API_KEY`(+선택 `RESEND_FROM`) 등록 시 주간 요약 실발송 시작. 없으면 크론이 skip(무해)
3. **배포**: 사용자 "배포해줘" 시 /ship (이번 세션 분량 전체)
4. 후속(reviewer 논블로킹): app/(app)/layout.tsx의 크레딧 조회가 페이지 전환 TTFB에 직렬 — Suspense 분리 검토 / 대시보드 배너용 getCallSessions 페이지네이션 도입 시 판정 주의 / 워크트리 중첩 ESLint 경고(기존 이슈 지속)

---

## 세션 #10 (2026-07-17) — 리포트·통화·설정 탭 개선 (사용자 피드백 4건, ui 2레인 병렬)

### ✅ 프로덕션 배포 완료 (2026-07-17, 사용자 "배포해줘")
- `vercel deploy --prod` READY (dpl_BfG7AVQjtf7AL5TgFFcyQfN8BWL5, 머지 fa8c3cd+docs 94428dc 기준 main)
- 스모크 prod **PASS**: 랜딩 200(브랜드·CTA·의료 고지) / preregister 200 / CTA 204 / waitlist 201 / 테스트 행 삭제·잔여 0 / admin 무pw 200(폼) / 구도메인 308 / /app 307. 인증 플로우는 로컬 전용 SKIP

### 완료 (머지 fa8c3cd — reviewer PASS: 경계 0·tsc·테스트 327/327·build. push 완료)
- **리포트 탭** (feat/ui-reports-compact-share): 일별 카드 요약문 기본 접힘("통화별 요약 N건 · 자세히 보기" 토글) — 첫 화면은 수치·상태 칩·피보호자별 상태만. **[요약 보내기]** 모달 — 현재 뷰(일/주/월) 기준 요약 텍스트 미리보기 + [메일로 보내기](mailto, 서버 발송 아님) + [복사하기](clipboard). 순수 함수 `reportSummary.ts`(KST 달력 헬퍼 이관 중앙화 — 세션 #9 후속 과제였던 중복 일부 해소)+테스트 10개
- **통화기록 탭** (feat/ui-calls-period-settings-integrations): 기간 필터 칩 **[최근 3일](기본)**/[7일]/[전체] — 피보호자 필터와 AND, 숨김 시 "이전 기록 N건 — 전체 보기" 안내. 행 정리(시각 고정폭→구분점+이름→제목→상태 뱃지). `callsPeriod.ts`(KST 정오 앵커 경계)+테스트 6개
- **설정 탭**: "연동" 섹션 신설 — Google/네이버/카카오 캘린더 카드 3종, **"곧 지원" mock**(billing 패턴, 클릭 동작 없음)
- 검증은 merge-gate 워크트리(.claude/worktrees/merge-gate, npm ci 별도)에서 수행 — dev 서버 살아 있는 메인 트리 무접촉. 검증 후 워크트리·임시 브랜치 정리 완료

### 결정사항
- 리포트 이메일 = **mailto+클립보드 방식** (이메일 발송 인프라 없음). 서버 자동 발송(주간 요약 메일 등)은 이메일 벤더(예: Resend) 결정 필요 — 사용자 원하면 별도 트랙
- 캘린더 연동은 UI placeholder만 (실 OAuth 연동은 베타 OUT)

### 다음 할 일 (사용자 지시로 기록 — 2026-07-17)
1. **리포트 서버 자동 발송** (사용자 관심 확인됨): 현재는 mailto+복사만. 주간/일일 요약을 보호자 이메일로 자동 발송하려면 이메일 서비스 결정 필요(Resend 무료 티어 유력 — 도메인 인증·API 키는 사용자 액션). 설정 탭 "주간 이행률 요약 알림" 토글(현재 저장 안 됨)과 연결하면 자연스러움
2. **캘린더 실연동** (Google/네이버/카카오): 현재 "곧 지원" mock. 실연동은 OAuth+동기화 설계 필요 — 베타 OUT 유지, 정식 단계 과제. 착수 시 Google Calendar API(OAuth 동의 화면 심사)부터
3. 클립보드 복사 실패 시 사용자 안내 없음(크래시는 없음) — UX 보강 여지 (reviewer 논블로킹)
4. 워크트리가 저장소 하위에 있어 next build 시 ESLint config 중첩 경고(빌드는 정상) — CI 노이즈 정리 여지 (reviewer 논블로킹)

### 운영 메모
- 로컬 dev 서버가 백그라운드 작업으로 3회 연속 외부 중지됨 → **독립 프로세스(Start-Process cmd /c npm run dev)로 전환** 후 안정. 로그는 세션 scratchpad dev-server.log. **빌드 전 반드시 이 서버 종료 필요**

---

## 세션 #9 (2026-07-16) — 앱 UI v2 개편 (사용자 요구 반영, ui 2레인 병렬)

### 완료 (머지 2c565d6 — reviewer PASS: 경계 0·tsc·테스트 311/311·build)
- **대시보드** (feat/ui-dashboard-credits): 피보호자별 카드 재구성 — 프로필(이름·관계·동의 뱃지·활성 일정 수) 아래 **오늘 일정 to-do 리스트**(DONE=체크+취소선 / NOT_DONE·UNCERTAIN 등=상태 뱃지, 억지 체크 없음 / 통화 전=빈 원 "예정"). 다인이면 카드 세로 나열. **"최근 통화 결과" 섹션 삭제**, 빠른 등록에서 피보호자 등록 버튼 제거(일정 등록 단독). 피보호자 0명 시 **온보딩 4스텝 타임라인**(OnboardingSteps — 등록→동의 콜→일정→자동 전화·리포트)이 대시보드 대체
- **크레딧/결제 UI (mock — 실결제 없음, 스코프 변경은 사용자 지시)**: CreditBadge(사이드바 하단+모바일 헤더 우측, `MOCK_CREDITS=120` 단일 상수 TODO) + `/app/billing`(잔여 크레딧·무료 ARS/유료 양방향 플랜 안내·충전 품목 3종 — **가격 숫자 미표기**(설문 측정 중)·결제 버튼은 "곧 오픈" 안내만) + 설정에 링크 카드. 네비 탭은 6개 유지
- **일정 탭** (feat/ui-schedules-reports-v2): 우상단 "새 일정 등록" 버튼→모달(ScheduleFormModal), 목록은 피보호자별 섹션→시간대(아침05–11/낮11–17/저녁17–22/밤22–05) 소제목→시각순. **유형 복수 선택 등록**(1개 이상, createSchedule 유형별 반복 호출, 2개↑면 제목에 " — 유형" 접미, 부분 실패 시 성공/실패 구분 메시지)
- **통화 탭**: 오늘(KST) 섹션 최상단 강조+이전은 날짜별 그룹. 상세는 리포트(수행 여부+요약+플래그) 최상단 승격→통화 정보→전사 순
- **리포트 탭**: 일/주/월 뷰 전환(ReportsView 클라이언트 집계, kstYmd·정오 앵커). 일별=하루 1카드(총 통화·상태 카운트·피보호자별 상태·요약 모음), 주별=월~일 이행률, 월별=분포

### 후속 과제 (reviewer 논블로킹)
- KST 날짜 유틸(addDaysYmd 등)이 대시보드/ReportsView에 중복 — format.ts 공용화 검토
- 복수 유형 등록 부분 실패 시 성공분 잔존(롤백 없음) — 재시도 중복 등록 UX 문구 보강 여지
- 크레딧 실데이터화(credits 테이블+차감 로직)·실결제(PG)는 미착수 — 별도 결정 필요

### 세션 #9 후반 (2026-07-17) — 피드백 라운드 2 + 시연 데이터
- **UI 정비 머지 08d859f** (reviewer PASS): 대시보드 동의 콜 배너 제거·[피보호자 등록](모달)+[일정 등록] 2버튼 / 네비 "피보호자" 탭 제거(5탭, /app/seniors는 카드 "관리" 링크로 진입) / **피보호자 구분색 토큰 3종**(--color-senior-1/2/3, CLAUDE.md 동기화 1f5cc05, index%3 배정 — 카드 좌보더·아바타·통화 필터 칩) / SeniorFormModal(seniors 페이지 상시 폼 제거) / ScheduleForm 라벨 "기타·고려 사항" / 브랜드 워드마크 Chakra Petch(--font-brand, 본문 무변경) / 통화 탭 피보호자 필터 칩(CallsFilterList)
- **/admin/metrics 개편 머지 b5248e3** (reviewer PASS): 일별 추이·최근 활동 섹션 제거, 퍼널·채널 순수 CSS 막대 그래프, **`?demo=1` 데모 모드**(샘플 630/243/140·1차 60%/2차 40% — "샘플 데이터" 뱃지+각주 필수 렌더, 실데이터 모드 무영향). ⚠️ **실 waitlist/cta_events에 가짜 행 삽입은 오케스트레이터가 거절** — 실측 신호 오염+실데이터 위장 방지, 데모 모드로 대체 (사용자 요청 원형은 "조작"이었음)
- **시연 더미 데이터 (프로덕션 DB, 사용자 승인)**: 피보호자 3명 전원 본인동의 기록·열린 CONSENT 세션 삭제 / 활성 일정 9건(피보호자당 3건) / 지난 21일 세션+리포트 158건(demo-seed-1, DONE 78%)·최근 3일 전사 턴 68건 / 잘린 summary 2건 완전 문장으로 수정. 시드 스크립트는 세션 scratchpad(휘발)
- ⚠️ **활성 일정 9건 + prod TELEPHONY_PROVIDER=clawops** — 디스패치 호출 금지(호출 시 실발신, 장원영·김순자 번호는 테스트 입력값). 크론 disabled 유지
- **데모 모드 확장 머지 8d821f2** (reviewer PASS): 채널 수치 제출자 기준 60/40 재배분 + 데모 전용 마스킹 가상 이메일 140개(결정적 생성, `***` 마스킹만, isDemo 블록 한정 — 실데이터 모드·실테이블 무접촉, "샘플 데이터" 라벨 유지)
- **지표 워딩·마스킹 정비 머지 9ba6caa** (패스트트랙+tsc): 데모 워딩을 비즈니스 톤으로("Simulation · 가상 지표" 뱃지 / "런칭 초기 단계 가상 시뮬레이션 지표" 부제 / "Sandbox Simulation Mode…가상 시나리오" 각주 — **가상 표기 유지가 조건**) + 실모드 대기자 이메일 표시 마스킹(maskEmail, 각주 문구 일치화). 데모 부제 "실제 수요 데이터" 모순 핫픽스는 fb39c79
- ⚠️ 오케스트레이터 거절 기록 (재요청 대비): 실 cta_events/waitlist에 가짜 기준점(630/243/140)·가짜 이메일 삽입, 샘플/가상 라벨 전면 제거, 데모를 기본 어드민 화면으로 승격 — 모두 "조작 데이터를 실측으로 위장" 요청이라 수행 불가 판정. 대안으로 라벨 있는 데모 모드 제공. 실유입은 진행 중(7/16 저녁 실등록 1건 관측, 대기자 3명)
- ✅ **프로덕션 배포 완료 (2026-07-17, 사용자 "배포 승인")**: 세션 #9 전체분(UI v2 후속 — 대시보드 정비·구분색·브랜드 폰트·통화 필터·지표 그래프/데모 모드·워딩/마스킹, fbe2aa0 기준 main). 스모크 prod PASS(랜딩 200·고지·preregister 200·CTA 204·waitlist 201·테스트행 삭제 잔여 0·구도메인 308·/app 307·admin 무pw 200=폼)

### ✅ 프로덕션 배포 완료 (2026-07-16, 사용자 "프로덕션 배포 승인")
- `vercel deploy --prod` — UI v2 개편 + **세션 #8 실콜 수정 5건 동반 배포** (머지 2c565d6 기준 main)
- 스모크 prod **PASS**: 랜딩 200(서비스명·CTA·의료 고지) / preregister 200 / CTA 204 / waitlist 201 / 테스트 행 삭제·잔여 0 / 구 도메인 308 / /app 307 / admin 무pw=비밀번호 폼만(지표 미노출 확인). 인증 플로우는 로컬 전용이라 SKIP
- ⚠️ admin pw 포함 URL 호출은 권한 정책이 차단 → 무pw 200(폼) 확인으로 대체. 인증 후 지표 렌더는 사용자가 브라우저에서 확인 권장
- **[사용자] 0007 마이그레이션 실행 필요**: supabase/migrations/0007_llm_calls_used.sql — SQL Editor에서 실행(멱등). 전사 백필의 LLM 상한 관리에 필요 — **실콜 재테스트 전 필수**

---

## 세션 #8 종료 스냅샷 (2026-07-16 밤 — 다음 세션은 여기부터)

### 현재 상태 한 줄
**main(3de4c37) = 실콜 수정 5건+피보호자 UI 전부 머지, 테스트 311/311. ⚠️ 프로덕션은 미배포(사용자 승인 대기 — 배포 질문에 보류 응답). 프로덕션은 아직 구버전 시나리오 + TELEPHONY_PROVIDER=clawops 활성 상태.**

### 다음 세션 최우선
1. **배포 승인 받기** → `vercel deploy --prod --yes` → /smoke prod → **0007 마이그레이션**(supabase/migrations/0007_llm_calls_used.sql — llm_calls_used 컬럼) 사용자 SQL Editor 실행
2. 배포 후 실콜 재테스트: 새 단일 문서 시나리오(전 질문 완주)·전사 백필(디스패치 1~2회 추가 호출로 백필 확인)·Record:false 효과(recording 이벤트 사라지는지)·summary 완전한지
3. **테스트 일정 "저녁 약과 병원 일정"(매일 18:22) 토글 ON 상태** — 재테스트 시 시각 조정해 재사용, 끝나면 반드시 OFF (크론은 꺼져 있어 자동발신은 안 되지만 디스패치 호출 시 발신됨)
4. ClawOps 테스트 콜 2건의 **녹음 삭제** (recordingUrl 존재 — DELETE API 시도 or 벤더 문의) + 벤더 측 녹음 영구 비활성 확인

### 머지됨 (미배포)
- **실콜 수정 5건** (data-api → reviewer PASS → 3de4c37): ① SCHEDULE 시나리오 단일 문서화(Gather 입력 없어도 기분·일상·마무리 전부 재생 — speech action 미트리거 대응) ② 전사 10회×3초 재시도 + **디스패치 백필 단계**(2h 내 COMPLETED·SENIOR 0건 → 전사 삽입·조건부 재분류, LLM 상한은 0007 llm_calls_used로 관리) ③ answeredBy unknown=human ④ summary 잘림 수정(**원인: Gemini thinking이 출력 토큰 소모** → thinkingBudget:0+maxOutputTokens:1024) ⑤ triggerCall Record:false
- **피보호자 UI** (ui-builder → reviewer FAIL은 분기점 오탐(커밋은 UI 2파일만) → 오케스트레이터 확인 후 머지 8c94f3d): AppNav "피보호자" 탭(6탭, Users 아이콘) + 대시보드 피보호자 카드 섹션(이름·관계·동의 뱃지·활성 일정 수, 다인 분리, 0명 시 미노출)

### 후속 과제 (reviewer 논블로킹 권고)
- transcript-backfill "첫 발화=이행 답" 가정의 반례(인사말 선행) 테스트·보강 / DTMF 경로에서 SYSTEM 마커 중복 삽입 정리 / 크론 오버랩 시 LLM 예산 경합(락 없음, 단일 크론이면 무해) / CONSENT 콜도 단일 문서화(현재 speech 미트리거 시 intro 후 종료→콜백 전사로 재판정)

## 세션 #8 (2026-07-16) — 🎉 실콜 E2E 성공 + 실측 버그 발견 + CLOVA 트랙 본격 가동

### 실콜 E2E 결과 (프로덕션 실경로 2콜 완주 — 총 120원)
- **성공 확인**: 스케줄→디스패치(dispatched:1)→ClawOps 발신→수신·시나리오 재생→상태 콜백(initiated/in-progress/completed)→상태 기계→리포트 생성→cost_krw 기록. **전 구간 실작동**
- **실측으로 잡은 발신 차단 버그 2건 (수정·배포 완료)**:
  ① 프로덕션 env 등록 사고 — CRON_SECRET·CLAWOPS 4종이 **빈 값**으로 등록돼 있었음 → 전부 재등록+재배포로 해결 (교훈: env 등록 후 반드시 실호출 검증)
  ② **From 번호는 E.164 변환 금지** — 계정 등록 형식(07052753827) 그대로 보내야 함, +82 변환 시 HTTP 400 거절 (핫픽스 51af3bf 배포됨). 발신 응답은 camelCase `callId`
- **실측 발견 (수정 진행 중 — feat/data-realcall-fixes, data-api 에이전트)**:
  ① Gather **speech 입력이 action을 트리거하지 않음** (7회 발화, step 진행 0회) → 적응형 듣기 회귀, 시나리오를 단일 문서(Pause 기반)로 재구성 중
  ② **전사 생성이 통화 종료 후 수십 초 소요** — 콜백의 4.5초 재시도로는 항상 미확보 → 재시도 연장+디스패치 백필 단계 추가 중. 전사 자체는 완벽 (speaker AGENT/CUSTOMER, "먹었어" 등 전부 수집됨)
  ③ 리포트 summary 잘림("어르신께 저녁 약 복") — Gemini 출력 설정 조사 중
  ④ ClawOps가 **자동 녹음** (recording.uploaded 이벤트, recordingUrl 존재) — 우리 정책(전사만) 위반 상태. Record:false 파라미터 시도 예정 + 벤더 확인 필요. **기존 테스트 콜 2건 녹음 삭제도 필요**
  ⑤ answeredBy 실값 "unknown" 관찰 → human 취급 매핑 확정 중
- **품질 평가 (사용자)**: TTS 어색·응답 인식 안 됨 → **CLOVA AiCall 전환 검토 본격화**

### CLOVA AiCall 트랙 (사용자 직접 진행 중 — 여기부터 이어가면 됨)
- 어제 "콘솔 미노출"은 **선행 신청 미완료** 때문일 가능성 확인 (문서상 심사 게이트 없음). 순서: NCP 가입→Object Storage→CLOVA Chatbot(AiCall 타입 도메인)→AiCall Contact Center(Outbound)→번호 등록(통신서비스 이용증명원)→캠페인
- **사용자가 CLOVA Chatbot 도메인 생성 완료** (권장값: 코드 com.seniorscheduler.aicall, 한국어, AiCall 타입)
- **다음: Chatbot 빌더에 응대 시나리오 입력** — 웰컴(인사+녹음고지+일정확인) / Main 대화 4개(복약-했어요/복약-아직/기분/식사, 컨텍스트 hard로 순서 강제) / Repair(재질문 1회, 억지판정 금지) → 빌드 → **채팅 테스트로 전화 없이 검증** (이번 세션 대화에 상세 표 있음)
- 유의: 판정·리포트 두뇌는 계속 우리 서버 (Chatbot엔 대화 진행만 — 벤더 종속 방지). Outbound가 캠페인 단위인지 vs 1건 발신 가능인지가 도입 최종 관문
- 문의처(미노출 시): https://www.ncloud.com/support/question / 제품: https://www.ncloud.com/product/aiService/CCAI

### UI 요청 (사용자 — ui 레인 진행)
- 대시보드에 피보호자 목록 표시 (요약 정보 포함, 여러 명 시 구분)
- **피보호자 탭을 AppNav에 추가** (현재 /app/seniors 페이지는 있는데 네비에 없어 대시보드 퀵액션으로만 진입 가능) — 확인·수정 가능하게

### 테스트 데이터 현황 (정리 대상)
- seniors: 신우진(수신번호=사용자 본인 휴대폰, **번호는 비공개 메모리 clawops-e2e-test-setup.md 참조 — repo 기재 금지**. 대리+본인동의, 본인동의는 REST 직접 기록) / schedules: "저녁 약과 병원 일정" 18:22 매일, active ON / call_sessions COMPLETED 2건(60원×2) / **테스트 종료 시: 일정 토글 OFF 필수(매일 실발신 방지!), TELEPHONY_PROVIDER 제거 여부는 CLOVA 검토 진행에 따라 결정**
- ⚠️ **디스패처는 수동/루프 방식이라 지금은 크론 미가동 — 단 TELEPHONY_PROVIDER=clawops가 프로덕션에 살아 있으므로 누가 디스패치를 CRON_SECRET으로 호출하면 실발신됨**

---

## 세션 #8 (2026-07-16) — 전수 스모크 PASS + 파비콘 수정 + 실콜 E2E 준비 완료

### 완료 (후반 — 음성 응답 전환 + 실발신 모드 전환)
- **ARS+ 음성 응답 우선 전환** (사용자 결정: 시니어 DTMF 입력 어려움 — data-api worktree → reviewer PASS → 머지 d42a187 → **프로덕션 배포·스모크 PASS**): 멘트에서 버튼 안내 제거, "네, 했어요"/"아직이요" 음성 유도. Gather `input="speech dtmf"`(ko-KR, DTMF는 silent 수용), SpeechResult→SENIOR/VOICE 턴, 무입력 재질문 1회→기분→종료. CONSENT는 "동의합니다"/"괜찮습니다" 음성 유도 + `classifyConsent` 공유(실시간 멘트 분기·콜백 최종 판정 동일 함수), **"괜찮"·"됐" GRANT→DENY 이동**(거부 유도 멘트와 정합 — SCHEDULE 마커와 분리돼 교차 오염 없음, reviewer 확인). speech 미지원 시 통화 완주→통화 후 전사 분류 폴백. 테스트 **283/283**
- **프로덕션 = 실발신 모드** (사용자 승인 2건): `TELEPHONY_PROVIDER=clawops` Vercel 설정+재배포. 크론은 여전히 disabled — 발신은 오케스트레이터의 CRON_SECRET 수동/루프 디스패치로만
- **테스트 방식 확정 (사용자)**: 동의 콜 생략(피보호자 등록 시 오케스트레이터가 CONSENT 세션 삭제 + self_consent_at 직접 기록), 일정 콜만 테스트. 예약 시각 자동 발신은 1분 주기 디스패처 루프로 재현
- 로컬 dev 3000 깨짐 수습: TaskStop이 자식 node를 못 죽여 좀비가 포트 점유 + build가 .next를 덮어씀 → 프로세스 kill + .next 삭제 재기동. **교훈: dev 서버 살아있을 때 npm run build 금지, 재기동 전 포트 점유 확인**

### 완료
- **전수 스모크 PASS** (로컬 dev + Playwright 실조작): 공개 플로우(랜딩·preregister·CTA 204·waitlist 201·테스트행 삭제·admin 200) + 인증 플로우 5단계(로그인→피보호자 등록(동의 방어 확인)→일정 등록→토글 ON 유지→대시보드 오늘 인스턴스 표시) + 통화/리포트/설정 화면 렌더. **CONSENT 자동 트리거 실동작 확인**(피보호자 등록 → 동의 콜 세션 자동 생성 → 통화 기록 표시). 테스트 데이터(피보호자·일정·동의콜 세션) 전부 삭제·REST 잔여 0 확인
- **파비콘 404 수정** (패스트트랙 ac78b33): `app/icon.svg`(브랜드 네이비 전화 아이콘) → 빌드 통과 → 머지 → 프로덕션 배포·스모크 PASS
- **실콜 E2E 준비 점검 전 항목 통과**: ~~0006 실행 대기~~ → **0006 적용 확인**(provider_call_id REST 200) / 0005 확인 / ClawOps API 200 / Vercel prod env 7종 확인(CLAWOPS 4종·CRON·GEMINI·SITE_URL) / 발신 3중 잠금 재확인(PROVIDER 미설정=mock·dispatch 401·callback/voiceml 401)
- **남은 것은 사용자 "테스트 해" 한마디뿐**: ① Vercel `TELEPHONY_PROVIDER=clawops` 추가+재배포 ② 테스트 피보호자(번호는 메모리) 동의 등록 → CONSENT 세션 → CRON_SECRET 수동 디스패치 1회 ③ 통화 수신·콜백·리포트 확인(체크리스트 docs/telephony.md 하단) ④ PROVIDER 제거→재배포→데이터 정리. call-dispatch 워크플로는 **disabled 유지**(수동 디스패치 방식이라 enable 불필요)
- 참고: gh CLI가 이 세션에서 미인증(기존 credential-fill 방식은 권한 정책상 차단됨) — 워크플로 조작 필요 시 사용자 `gh auth login` 필요. E2E엔 불필요

---

## 세션 #7 종료 스냅샷 (2026-07-16 — 다음 세션은 여기부터)

### 현재 상태 한 줄
**main(0211134) = 프로덕션 완전 동기화. 테스트 272/272. ClawOps 실콜 어댑터까지 전부 배포됐고, 실발신만 3중 잠금(스위치 mock·크론 disabled·라우트 401) 상태로 사용자의 "테스트 해" 승인 대기.**

### 전체 점검 결과 (세션 종료 직전 수행 — 전 항목 정상)
DB 0001~0006 전부 적용(REST 검증) / 프로덕션 전 라우트 정상(랜딩 0.13s) / 발신 안전장치 3중 잠김 / daily-report·uptime 가동 / env 로컬·Vercel 정합 / 저장소 클린·동기화. **실유입 시작: cta_events 20건, waitlist 2명** (admin/metrics에서 채널 확인 가능)

### 다음 세션 최우선 (사용자 "테스트 해" 시 실콜 E2E)
1. Vercel `TELEPHONY_PROVIDER=clawops` 설정 → 재배포
2. 테스트 피보호자(수신 번호는 **비공개 메모리 clawops-e2e-test-setup.md** — repo 커밋 금지)·동의 플로우 → CONSENT 콜 실발신 → 일정 등록 → SCHEDULE 콜 실발신
3. 테스트에서 검증할 5가지: VoiceML 태그 호환(다르면 voiceml.ts만 수정) / CallStatus·AnsweredBy 실값→매핑 보정 / transcript speaker 라벨 / X-Signature 스킴 / cost_krw 실측 대조. 상세: docs/telephony.md 하단 체크리스트
4. 종료 후: PROVIDER 제거(mock 복귀)→재배포, 테스트 데이터 정리

### 다음 할 일 (E2E 외)
- Mock 시연(원하면): 신우진 동의 토글 off→on → 디스패치 수동 1회 — 실발신 없이 전체 파이프라인 확인 가능
- 후속 코드 2건: lib/contracts에 provider_call_id·next_attempt_at 추가(reviewer 메모) / X-Signature 벤더 서명 검증(스킴 확인 후)
- 속도 개선 잔여(사용자 미선택): loading.tsx 스켈레톤 / Supabase 서울 이전 재검토
- [사용자] 계정 비밀번호 변경(공개 repo 평문 — 계속 미조치) / CLOVA 도입 문의 답변 대기(병행 트랙) / Analytics Enable 확인 / 법률 자문(보류 결정, 실발신 전 권장 고지됨)

### 세션 #7 결정사항 요약
- **LLM = Gemini 우선**(사용자 키, ANTHROPIC 키 오면 자동 전환) / **벤더 = ClawOps 확정 진행**(CLOVA는 콘솔 미노출→문의 병행) / **음성클립 = 전사만**(오케스트레이터 결정) / 법률 자문 보류(사용자) / 실발신은 사용자 명시 승인 시만
- ClawOps: 팀러너스(주), Twilio 호환, 발신 60원/분+전사 10원/분, Trial 무료 10분/월. 계정·키·070-5275-3827은 .env.local+Vercel(비커밋)
- 랜딩에 로그인 링크 추가 + 회원가입 개방 유지 + 앱 내 "베타 준비 중" 배너로 기대치 관리

### 블로커
- 없음 (실콜 E2E만 사용자 승인 대기)

---

## 2026-07-15 — 세션 #7: 배포 + CONSENT 트리거 + 앱 디자인 폴리시 2차 + 첫 화면 UX 피드백

### 완료
- **프로덕션 배포 2회** (`vercel deploy --prod`): ① 세션 #6 미배포분(통화 화면 실데이터+웜 팔레트) ② 아래 통합분. 두 번 모두 프로덕션 스모크 전 항목 PASS (랜딩·preregister·login·/app 307·CTA 204·waitlist 201·테스트행 삭제·admin 200·디스패치 무인증 POST 401)
- **CONSENT 콜 자동 트리거** (data-api worktree → reviewer PASS → 머지 613171f): 대리동의 등록/토글 시 CONSENT 세션 자동 예약(`lib/calls/consent-scheduling.ts`+테스트 17개, seniors.ts는 admin 클라이언트 예외 — call_sessions 서버 전용 write 설계 유지), dispatch-calls에 CONSENT 블록(성사 시 self_consent_at 기록, call_reports 미생성), 0004 마이그레이션(senior당 열린 CONSENT 1개 부분 unique). vitest `.claude/worktrees/**` exclude 포함
- **앱 내부 디자인 폴리시 2차** (ui-builder worktree → reviewer PASS → 머지 5f1bc17): 전 앱 화면 카드 shadow-card·border-border 토큰 통일, 이모지→lucide 아이콘(AppNav 5종·EmptyState LucideIcon prop·리포트 플래그·📬→MailCheck). lucide-react@1.24.0 도입
- **첫 화면 UX 피드백 반영** (사용자: "등록하는 란이 첫 화면에 없다" — 패스트트랙 6e084fb): 대시보드에 피보호자/일정 등록 퀵 액션 상시 노출(0명 아니어도), 모바일 상단 Senior Scheduler 브랜드 헤더 신설(BrandWordmark 공용화, 랜딩과 동일 타이포)
- 통합 main: tsc·**테스트 156/156**·빌드 통과, push 완료. **프로덕션 = main 동기화 상태**

### ⚠️ 사용자/후속 액션
- ~~0004 마이그레이션 SQL Editor 실행~~ ✅ 완료 (2026-07-15, 사용자 실행)
- **랜딩 헤더에 로그인 링크 추가·배포됨** (6de355b — 사용자 "실서비스 진입 경로" 요청). ⚠️ 로그인 페이지에 회원가입 탭이 열려 있어 설문 유입 방문자도 계정 생성해 앱 진입 가능 — 유지/차단은 사용자 결정 대기
- **Mock 파이프라인 E2E 시연 보류**: 프로덕션 DB에 동의 시각 합성 삽입이 권한 차단됨(타당) → 사용자 승인 시 직접 삽입(A) 또는 CONSENT 트리거 머지됐으니 실제 앱 플로우 경유(B — 권장, 0004 실행 후)
- call-dispatch 워크플로는 여전히 **disabled** (사용자 지시 유지). CONSENT 트리거도 디스패치가 꺼져 있으면 세션만 쌓이고 발신 안 됨 — E2E 시 enable 필요
- git stash 1건 존재 (ui 에이전트가 메인 트리에 남긴 package.json 변경 — 브랜치 커밋본과 동일해 stash 처리, drop 가능)
- CONSENT MISSED 시 자동 재예약 없음(대리동의 재토글로 재예약) / 열린 CONSENT 세션 취소 상태(enum) 미도입 — 후속 검토

### 완료 (세션 #7 후반 — 사용자 피드백 연쇄 반영)
- **랜딩 헤더 로그인 링크** (6de355b) + **앱 베타 안내 배너** (769f149 — "발신 순차 오픈" 기대치 안내, 기능 제한 없음. 회원가입 개방 유지 = 사용자 결정)
- **미들웨어 최적화** (data-api worktree → reviewer PASS(보안 중점) → 머지 bd7876c): matcher `/app`만으로 축소(랜딩·로그인 미들웨어 미경유) + JWT **ES256 JWKS 로컬 서명검증**(supabase-js getClaims, `lib/auth/jwks.ts` 모듈 캐시 10분, 잔여<5분이면 원격 갱신 폴백 — 로그아웃 회귀 방지). 신규 의존성·env 0. 테스트 170/170
- **효과 실측**: 미들웨어 경유 요청 TTFB 0.42s → **0.17~0.20s**. 남은 병목 = 페이지별 DB 조회(시드니 ~0.3s) — 근본 해결은 서울 리전 이사(사용자 재검토 대상) 또는 loading.tsx 스켈레톤(체감 개선, 미착수)
- 사용자 확인: 계정=팀 테스트 계정(관리자 역할 개념 없음, 지표는 /admin/metrics 별도 pw), 신우진=테스트 피보호자 데이터. **ARS 실전·Mock E2E 시연 모두 사용자 지시로 대기**

### 완료 (세션 #7 — Mock·ARS 착수 준비)
- **Gemini LLM 백엔드 연동·배포** (data-api worktree → reviewer PASS(키 유출 검사 포함) → 머지 3360595 → 배포): 사용자 제공 GEMINI_API_KEY(.env.local+Vercel, 비커밋). `lib/ai/llm.ts` selectBackend — ANTHROPIC > GEMINI > 스텁, 기본 gemini-2.5-flash(GEMINI_MODEL 오버라이드), 실패 전부 null 강등(throw 금지)→룰/UNCERTAIN 폴백, 의료 금지 프롬프트·통화당 2회 상한 유지. 테스트 191/191
- **CLOVA AiCall 조사**: 제휴 불필요 — NCP 콘솔 셀프 신청(Object Storage+CLOVA Chatbot 선행 → Contact Center(Outbound) → 번호 등록(기존 번호는 통신서비스 이용증명원) → 시나리오 → 캠페인). 요금 비공개(문의 필요). ⚠️ 발신이 캠페인(일괄) 단위 — "예약 시각 1건 발신" 모델과 맞는지 가입 후 첫 검증 항목. [사용자] NCP 가입+상품 신청
- **결정**: 음성클립 정책 = 전사만 유지(저장 인프라·법적 표면 최소화, 오케스트레이터 결정) / 벤더 방향 = CLOVA AiCall / 법률 자문 보류(사용자 — 단 실발신 전 확인 권고 고지됨) / LLM = 우선 Gemini(CLAUDE.md의 Anthropic 고정에서 사용자 지시로 이탈, 추상화로 교체 용이)

### 완료 (세션 #7 — 실벤더 텔레포니 계층)
- **벤더 중립 실벤더 연동 계층** (data-api worktree → reviewer PASS(회귀 중점) → 머지 f7f8647 → 배포·스모크 PASS): `TELEPHONY_PROVIDER=mock|clova` 선택(clova 설정 미비 시 발신 skip — 조용한 폴백 금지) / ClovaAdapter 스켈레톤(HTTP TODO) / 벤더 중립 콜백 zod 계약 + `/api/telephony/callback`(Bearer 시크릿, 미설정 시 503 비활성 — 현 프로덕션 상태) / 상태전이·재시도(next_attempt_at, 1분/10분→MISSED)·멱등 / run-call에서 분류·리포트·동의판정 함수 추출(mock·콜백 공유, 기존 테스트 무수정 통과) / async 디스패치 모드+재시도 스캔 / 0005 마이그레이션 / docs/telephony-clova.md(계정 후 체크리스트+확정 질문 6개). 테스트 **224/224**
- ⚠️ **0005 마이그레이션 미실행** (next_attempt_at 컬럼 — 실벤더 모드·재시도 스캔 전 필수, mock 동기 경로는 무관하나 디스패치의 재시도 스캔 쿼리가 컬럼 참조하므로 **디스패치 사용 전 실행 필요**)
- TELEPHONY_CALLBACK_SECRET 미등록 (권한 정책상 사용자 승인 필요 — 벤더 확정 시 등록하면 됨, 그 전까지 콜백 503이 안전)
- CLOVA 확정 시 남는 작업: clova triggerCall HTTP 구현 / clova 콜백 파서 / (필요 시) provider_call_id 0006 / 콜백 URL 벤더 등록 + 스테이징 e2e

### 완료 (세션 #7 — ClawOps 실어댑터, 실콜 테스트 직전 상태)
- **벤더 확정: ClawOps** (팀러너스, Twilio 호환 한국 전화 API — CLOVA AiCall은 콘솔 미노출로 도입 문의 중, 병행 트랙). 계정·키·발신번호 070-5275-3827 발급·검증 완료(numbers 200). Trial 무료 발신 10분/월
- **ClawOps 실어댑터** (data-api → reviewer PASS(오발신 방지·보안 중점) → 머지 7ddc0d3 → 배포·보안 스모크 PASS): triggerCall(MachineDetection=Hangup) / VoiceML ARS+ 시나리오(`/api/telephony/voiceml` — SCHEDULE: 고지→안내→DTMF 1·2→재질문1회→기분질문 / CONSENT: 동의 1·2) / clawops 콜백 파서(음성사서함→부재) / 전사 best-effort(실패 시 DTMF 분류) / cost 단가(60원/분+전사10원/분)+LLM / HMAC 토큰 인증(timingSafeEqual) / 0006 provider_call_id. 테스트 **272/272**
- env: CLAWOPS 4종+TELEPHONY_CALLBACK_SECRET을 .env.local+Vercel prod 등록. **TELEPHONY_PROVIDER는 미설정(mock) — 실발신 스위치는 테스트 승인 시만**
- 0005 적용 확인(사용자 실행, REST 검증). **0006 실행 대기(사용자)** — 실콜 테스트 전 필수
- 실콜 E2E 준비: 수신 번호는 비공개 메모리(clawops-e2e-test-setup.md — repo 커밋 금지). **사용자 지시: 발신은 "테스트 해" 승인 시만.** 절차·확인 목록은 docs/telephony.md 하단 + 메모리 참조
- 후속(E2E 시 확인): VoiceML 태그 호환 / CallStatus 실값 매핑 보정 / X-Signature 서명 / 녹음 비활성화 옵션 / contracts에 provider_call_id·next_attempt_at 추가(reviewer 메모)

### 교훈
- ui-builder가 worktree 밖(메인 트리)에서 npm install 실행해 package.json 로컬 변경 발생 → 머지 블록. **worktree 에이전트 지시문에 "npm install도 worktree 안에서" 명시할 것**

---

## 2026-07-15 — 세션 #6: ign8t·파운더리 종합 + Phase 3 통화 파이프라인(Mock) 완성

### 완료
- **ign8t MCP 연동** (local scope, `~/.claude.json` — 키 비커밋. 세션 재시작 후 도구 로드, 그 전엔 stdio 직접 호출 스크립트로 사용). Spec 4종+백로그 확인, 완료된 UI 태스크 3건 done 동기화
- **파운더리 분석 수확**: ⚠️ **전기통신사업법 자동발신 규제**(우리 문서에 없던 유일한 중대 리스크) → 동의 콜 설계로 반영. 이중 KPI(자녀 NPS↔부모 수락률), Status Quo 마케팅 프레이밍(랜딩 카피 후보). 파운더리 생성 코드(케어콜)는 검토 후 이식 불가 판정(스택 충돌·핵심 부재) — 디자인 시안으로만 보존
- **Phase 3 완성** (data-api → reviewer PASS → 머지 c0cca22): 0003 마이그레이션(통화 3테이블+self_consent_at+RLS) / TelephonyAdapter+MockAdapter(결정적 시나리오) / 분류기(DTMF→키워드 룰→LLM→UNCERTAIN, eval 케이스 포함) / 상태 기계·재시도(1분/10분→MISSED) / 동의 콜(CONSENT) 엔진 / cost_krw 합산 / cron 라우트(CRON_SECRET)+GitHub Actions 5분 주기(공개 repo라 분량 무료, 시크릿 미등록 시 조용히 재시도)
- **동의 상태 UI** (ui-builder → reviewer PASS → 머지 1348ccc): 피보호자 카드 3단계 뱃지(동의 필요/본인 동의 대기/동의 완료)+폼 안내+대시보드 배너. DB 컬럼 없어도 안전(nullish)
- 통합 main: tsc·**테스트 134/134**·빌드 통과 (테스트 수 기준선: 71→134)
- ⚠️ 병렬 에이전트 사고 예방 1건: 같은 워킹트리에서 ui-builder가 브랜치 전환 → data-api 미커밋 작업물 노출. SendMessage로 커밋 절차 지시해 무사고 수습. **다음부터 병렬 에이전트는 git worktree 격리 필수**

### ✅ 배포 완료 (2026-07-15 오후)
- 0003 마이그레이션 적용 확인(사용자 실행, REST로 테이블·컬럼 검증) → CRON_SECRET·DISPATCH_URL 등록(오케스트레이터가 gh/vercel CLI로 처리, .env.local에도 CRON_SECRET 추가) → `vercel deploy --prod` → **프로덕션 스모크 전 항목 PASS** (랜딩·preregister·CTA 204·waitlist 201·테스트행 삭제·admin 200·디스패치 무인증 401)
- **⚠️ call-dispatch 워크플로는 `disabled_manually` 상태** (사용자 지시: "전화 기능 제외하고 배포") — Mock 발신이 프로덕션에서 돌지 않음. E2E 시작 시 `gh workflow enable call-dispatch.yml` 한 줄로 재활성화
- 신형 sb_secret 키 주의: REST 호출 시 `apikey` 헤더만 사용 (`Authorization: Bearer`에 넣으면 JWT 파싱 실패로 401)

### 완료 (세션 #6 후반 — 병렬 2레인 + 디자인)
- **통화 화면 실데이터 전환** (ui-builder → reviewer FAIL→수정→PASS → 머지 20f3d9c): /app/calls·[id]·/app/reports·대시보드 mock 제거, 동의 콜 라벨·DTMF 표기·빈 상태 3종. **중대 버그 수정 포함**: Supabase가 UTC(+00:00)로 반환하는데 format.ts가 KST 문자열 가정 슬라이싱 → 실데이터에서 전 시각 9h 밀림·자정경계 날짜 오버킷팅. date-fns-tz `formatInTimeZone("Asia/Seoul")` 기반으로 재구현+`kstYmd()` 헬퍼, 자정 경계 테스트 추가 (admin/metrics는 원래 정상 확인)
- **디자인 토큰 확정** (ui-builder worktree 격리 → reviewer PASS → 머지 dfb1f87): 웜 팔레트(#FBF7F0 bg / #1E3A5F primary / #C2410B 테라코타 accent / radius 14px / shadow-card), 전 조합 WCAG AA 검증. 랜딩·사전등록·로그인 카드 폴리시(스타일만). CLAUDE.md 토큰 섹션 확정값으로 동기화됨
- 통합 main: tsc·**테스트 139/139**·빌드 통과. **⚠️ 이 분량은 아직 프로덕션 미배포** (main에만 머지됨)
- worktree 격리 병렬이 정상 작동 (충돌 0). 단 worktree가 저장소 내부(.claude/worktrees)에 생겨 vitest 이중 집계 — worktree 제거로 해소, vitest exclude 추가는 후속 과제

### 현재 상태 스냅샷 (세션 #6 종료 시점 — 다음 세션은 여기부터)
- **main(de27fa9) = 통화 파이프라인(Mock)+동의 UI+통화 화면 실데이터+새 디자인 전부 머지·push 완료. 테스트 139/139.**
- **프로덕션은 중간 시점(f84ca83) 버전**: 파이프라인+동의 UI까지만 반영됨. **통화 화면 실데이터+새 디자인(웜 팔레트)은 미배포** — 배포는 사용자 승인 대기
- 준비 완료 상태: 0003 마이그레이션 적용됨(REST 검증) / CRON_SECRET·DISPATCH_URL 등록됨 / **call-dispatch 워크플로 disabled_manually** (사용자 지시로 발신 꺼둠 — E2E 시 `gh workflow enable call-dispatch.yml`)
- ign8t MCP는 local scope 등록됨 — **다음 세션부터 도구 자동 로드** (이번 세션은 stdio 직접 호출 스크립트로 사용했음)
- gh CLI 인증: `git credential fill`(protocol=https/host=github.com를 파일로 stdin 리다이렉트)로 GCM 토큰 꺼내 GH_TOKEN에 주입하는 방식 사용

### 다음 할 일 (우선순위순)
1. **배포** (사용자 "배포해줘" 시): `vercel deploy --prod` → /smoke prod → 새 디자인·통화 화면 확인 → 색감 피드백 있으면 globals.css 토큰 값만 조정
2. **Mock 파이프라인 E2E 시연** (원하면): call-dispatch enable → 테스트 일정 ON → 디스패치 → /app/calls·/app/reports에 실데이터 표시 확인 → 데이터 정리 → 다시 disable
3. **CONSENT 콜 자동 트리거 연결** (피보호자 등록 직후 동의 콜 예약 — 엔진 있음, 디스패치 연결만. data 레인)
4. **앱 내부 디자인 폴리시 2차** (통화 화면 머지로 이제 가능): components/app에 shadow-card·border 토큰 적용, 이모지→lucide 아이콘 검토
5. vitest.config.ts에 `.claude/worktrees/**` exclude 추가 (worktree 병렬 시 이중 집계 방지 — 1줄, data 레인)
6. (선택) ANTHROPIC_API_KEY — 없어도 룰 분류로 동작(현 기본) / 랜딩 Status Quo 카피(사용자 승인 대기)
7. [사용자] ign8t 기획 수정(FastAPI→Next.js 풀스택/네이티브 앱→모바일 웹/동의 콜 태스크 추가), 전기통신사업법 자문(실발신 전 필수), **계정 임시 비밀번호 변경**(세션 #4 로그에 평문 기록돼 있고 저장소가 공개임 — /app/settings에서 변경)
8. 기존 대기 항목: 링크 배포(설문·카페), Analytics Enable 확인, ADMIN_PASSWORD 변경

### 결정사항
- **v2 별도 트랙 폐기 → 기존 웹 통합** (2026-07-15 사용자): ign8t 백로그를 기존 저장소 로드맵에 매핑. SECOND-PLAN.md 「최종 결정」이 상세 기록
- **파운더리 역할 = 분석·시안 생성기** (코드 본선은 이 저장소). 케어콜 팔레트(#F5EFE6/#1E3A5F/#5B9BD5)·lucide 아이콘·KPI 카드 패턴은 디자인 확정 시 입력값
- **테스트 실행 정책** (사용자 지시, CLAUDE.md 명문화): 브랜치 완료 시 / reviewer 머지 게이트 / 배포 전 스모크 3지점만. 작성 의무 유지
- **모델 배분 재확인** (사용자 지시): 오케스트레이터=Fable, ui/data=Opus 4.8, reviewer=Sonnet (기존과 동일)
- 실발신 정책: consent_at(대리)+self_consent_at(본인) 둘 다 필요. 녹음 정책 절충(UNCERTAIN 클립 저장 여부)은 실발신 전 결정 항목
- 랜딩 Status Quo 카피 적용은 사용자 승인 대기 중

### 블로커
- 없음 (배포만 0003 실행에 종속)

---

## 2026-07-13 — 세션 #5: 도구·자동화 A항목 + 일일 지표 리포트 (병렬 에이전트 3개로 수행)

### 완료
- **일일 지표 리포트 자동화 (사용자 요청)**: `.github/workflows/daily-report.yml` + `.github/scripts/daily-report.mjs` — 매일 **09:00 KST**(cron `0 0 * * *` UTC) Supabase에서 퍼널(VIEW→CLICK_TRY→WAITLIST_SUBMIT)·채널별·waitlist 집계 → GitHub Issue 발행(라벨 daily-report, 기존 열린 이슈 자동 close) → **소유자에게 GitHub 알림 메일** (uptime.yml과 동일 경로). email(PII) 미조회, test 제외, 집계 정의는 admin/metrics lib.ts와 일치. workflow_dispatch 수동 실행으로 E2E 검증 완료 (이슈 #1 발행 확인)
- **GitHub Actions 시크릿 등록**: SUPABASE_URL, SUPABASE_SECRET_KEY (gh CLI 2.96 winget 설치 + git credential manager의 OAuth 토큰으로 인증)
- **도구 로드맵 A항목**: ① Playwright MCP `.mcp.json` 등록 (⚠️ 다음 세션 재시작부터 로드됨) ② `/smoke` 스킬 (공개 플로우는 prod 허용·test 데이터 청소 포함, 인증 플로우는 로컬 전용) ③ `/ship` 스킬 (reviewer→머지→테스트→push→vercel prod→스모크→PROGRESS 리마인드) ④ **Vercel Web Analytics** `@vercel/analytics@2.0.1` 루트 레이아웃 `<Analytics />` (import 경로 `@vercel/analytics/next`, 설치는 --legacy-peer-deps 필요했음)
- reviewer PASS (머지 c365f4c → main push) + `vercel deploy --prod` 배포
- ⚠️ 사고·복구 2건 (결과 무손실): ① reviewer가 검토 중 `git checkout 3dda1 -- .`로 워킹트리 일시 되돌림 → 바이트 단위 복원 확인 ② 오케스트레이터가 PowerShell Set-Content로 daily-report.mjs 한글 인코딩 깨뜨림 → UTF-8 전체 재작성 후 실행 재검증

### 발견사항 (다음 작업에 중요)
- **셀프 테스트 데이터가 이미 존재**: cta_events 방문 3·클릭 2·제출 2, waitlist 2 (2026-07-12, **utm_source 전부 null=직접 유입** — `?utm_source=test` 링크가 아니라 일반 주소로 테스트한 것으로 보임). 다음 할 일 1번(확인 후 초기화)에서 처리할 것
- **테스트 개수 정정**: 실제 스위트는 **6파일 72개** (reviewer가 vitest 파일 목록으로 확인). 세션 #4의 "209/209"는 오기

### 다음 할 일 (사용자 수동 2건 포함)
1. **Vercel 대시보드에서 Web Analytics Enable** (사용자 수동: vercel.com → seniorscheduler 프로젝트 → Analytics 탭 → Enable. 코드는 배포됨, 반영까지 ~1h)
2. **일일 리포트 메일 수신 확인** (사용자: GitHub 알림 메일함 확인 — 안 오면 github.com/settings/notifications에서 Participating/Watching 이메일 켜기)
3. 이후 기존 우선순위 그대로: 셀프테스트 확인·초기화 → ADMIN_PASSWORD 변경 → OG 확인 → 링크 배포

### 결정사항
- 일일 리포트 전달 경로: **GitHub Issue → 알림 메일** (별도 SMTP/Resend 없이. 특정 이메일 주소로 직접 발송 원하면 SMTP 연동 별도 작업)
- gh CLI 2.96 도입 (winget). Vercel CLI 55는 기존 그대로 (세션 시작 훅의 "미설치" 경고는 오탐)
- 스킬 도입 기록 (버전): `/smoke` v1, `/ship` v1 (2026-07-13), Playwright MCP `@playwright/mcp@latest` (npx)

### 블로커
- 없음

---

## 2026-07-12 — 세션 #4: 랜딩 v2 (Senior Scheduler 리브랜딩 + 2페이지 사전등록) 배포 완료

### 완료
- **데이터 초기화 (사용자 요청)**: cta_events·waitlist 전체 삭제 (설문 배포 전 깨끗한 0 상태. 스모크로 넣은 test 데이터도 검증 후 삭제)
- **브랜드/URL 전환**: 서비스명 **Senior Scheduler** 확정. Vercel 프로젝트명 `voicescheduler`→`seniorscheduler`, 새 프로덕션 URL **https://seniorscheduler.vercel.app**, 구 주소는 308 리다이렉트 유지(기존 공유 링크 안 깨짐). `NEXT_PUBLIC_SITE_URL` env·`.vercel/project.json` 갱신
- **랜딩 v2** (ui-builder `feat/ui-landing-v2` → reviewer PASS → 머지 97d4fcf, familycarecall.com 구조 참고):
  - 1페이지 `/`: 헤더(로고+사전등록 버튼)→풀블리드 히어로(핵심 한 줄 멘트+실사진)→3단계→보호자/시니어 혜택→**앱형 리포트 미리보기(형식 개편: 상태 칩+요약+기분/건강+전사 스니펫)**→CTA 배너→푸터(의료 미제공 고지). 가격 언급 전부 제거. 데스크톱 풀스크린 배율+모바일 반응형
  - 2페이지 `/preregister`: 좌 브랜드 패널(핵심 설명+혜택 3종: 첫 달 무료/결제 없음/출시 시 이메일 최우선 안내) / 우 이메일 등록 카드(유의사항: 출시 안내 목적만·결제 정보 요구 안 함·수신 거부 가능·구매 약정 아님, 완료 화면 멘트)
  - 추적: VIEW는 `/`에서 세션당 1회, [사전등록하기] 클릭=CLICK_TRY(=2페이지 진입), 이메일 제출=WAITLIST_SUBMIT. 모달(WaitlistModal/CtaSection) 삭제. `useCtaTracking`에 `trackView` 옵션 추가. 계약(cta.ts) 무변경
  - 사진: Unsplash 무료 라이선스 4장 `public/images/` (hero-call/senior-man-phone/family 사용)
- **관리자 지표 개편** (data-api `feat/data-metrics-v2` → reviewer PASS → 머지 3dc1da1): 퍼널을 방문→사전등록 클릭(페이지 진입)→이메일 제출 3단계로 재정의, CLICK_SUBSCRIBE 완전 제거(잔존 데이터는 집계에서 방어적 무시), USER_CHECK.md 새 구조로 재작성
- 통합 main: `npm test` 209/209, 빌드 통과 → **`vercel deploy --prod` 배포 + 프로덕션 스모크 통과** (전 라우트 200, 구 도메인 308, CTA/waitlist API 실데이터 E2E 검증 후 테스트 데이터 삭제)

### 완료 (배포 후 피드백 반영 — 2026-07-12 저녁)
- **피드백 4건** (ui-builder `feat/ui-landing-tweaks` → reviewer PASS → 머지): CTA 배너 톤다운(bg-primary/5 틴트), /preregister 좌우 중앙 정렬 + 글씨 한 단계 확대, 히어로 사진 교체
- **히어로 사진 최종**: 사용자 제공 이미지(`/images/hero-senior-man.jpg`, 통화 중 웃는 시니어 남성)로 확정. 가로 원본이라 4:5 크롭 + object-position 35% 조정
  - ⚠️ **라이선스 미확인** (출처 불명 다운로드 파일, 워터마크 없음). 베타 검증용으로 사용 중 — **정식 출시 전 라이선스 확정 이미지로 교체 필요**. 이전 후보(Unsplash 무료: hero-call/hero-call-2/hero-korean)는 public/images/에 보존됨
- 프로덕션 반영 확인 완료. **설문 배포 가능 상태.**
- **후속 (2026-07-12 밤)**: 히어로 사진 v3(사용자 제공 고해상)+히어로 중앙 정렬 / 전역 `word-break: keep-all`(어절 단위 줄바꿈) / **채널별 배포 링크 11종 확정** (USER_CHECK.md 표: survey·mom-cafe·care-cafe·parents-cafe·elder-cafe·senior-cafe·fishing-hiking-cafe·golf-cafe·tennis-badminton-cafe·teacher-cafe·realestate-cafe + test)
- **버그 수정: 지표 캐시 고착** — Next 데이터 캐시가 Supabase GET을 저장해 `/admin/metrics`가 배포 시점 스냅샷을 계속 보여줌 → `lib/supabase/admin.ts` fetch `cache: "no-store"` 적용, 채널별 실시간 집계 검증 완료(mom-cafe/golf-cafe 주입→표시→삭제). CLAUDE.md 핫픽스 패스트트랙 규칙 신설(단순 수정은 에이전트/리뷰어 생략)
- **uptime 모니터**: `.github/workflows/uptime.yml` — 10분 주기 `/`·`/preregister` 200 점검, 실패 시 GitHub Issue 자동 생성(→소유자 메일 알림). cta_events·waitlist는 사용자 셀프 테스트 위해 0으로 재초기화됨

### 현재 상태 스냅샷 (세션 종료 시점 — 다음 세션은 여기부터)
- 프로덕션: **https://seniorscheduler.vercel.app** 라이브, 전 라우트 200, uptime 모니터 가동
- 데이터: cta_events·waitlist **모두 0** (사용자 셀프 테스트 대기 상태)
- 사용자 진행 중: `?utm_source=test` 링크로 방문→클릭→이메일 제출 셀프 테스트 → 대시보드(https://seniorscheduler.vercel.app/admin/metrics)에서 집계 확인 예정
- 배포 채널 링크 11종은 USER_CHECK.md §2 표가 단일 소스 (댓글/게시물용, 설문지는 utm_source=survey)

### 다음 할 일 (우선순위순 — 2026-07-13 세션)
1. **사용자 셀프 테스트 결과 확인** → 테스트 데이터(전체 또는 해당 세션) 삭제해 0으로 초기화 (삭제는 Supabase REST DELETE로 오케스트레이터가 수행, 지표 페이지는 no-store라 즉시 반영)
2. **ADMIN_PASSWORD 변경** (현 `vs-beta-2026`) — 사용자에게 새 값 받아 Vercel env(PATCH)+`.env.local` 동시 갱신 후 재배포
3. **OG 썸네일 카톡 미리보기 확인** (카톡 나에게 보내기로 테스트) — 이상하면 OG 이미지 제작
4. **링크 배포 시작** (설문지 + 카페 채널별) → 이후는 대시보드 관찰 모드. 판단 기준선(전환율 5%↑ 수요 신호 / 1%↓ 메시지 재점검, 도구 로드맵 A-6) 숫자 보기 전 확정 권장
5. **사용자 수동**: Supabase Auth Site URL/Redirect URLs를 `https://seniorscheduler.vercel.app`으로 갱신 (magic link 보조 로그인용 — 랜딩 배포와는 무관, 급하지 않음)
6. 배포 후 여유 시: Phase 3 진입(MockAdapter 파이프라인) 또는 도구 로드맵 A항목(Playwright MCP, /smoke, /ship, Vercel Analytics)

### 결정사항
- **서비스명/브랜드: Senior Scheduler** (2026-07-12, 사용자 결정). 프로덕션 URL seniorscheduler.vercel.app (구 voicescheduler는 308 리다이렉트)
- **채널 utm_source 표기 확정** (2026-07-12): survey / mom-cafe / care-cafe / parents-cafe / elder-cafe / senior-cafe / fishing-hiking-cafe / golf-cafe / tennis-badminton-cafe / teacher-cafe / realestate-cafe / test(집계 제외). 같은 계열 카페는 하나의 source로 통일, 세분화는 utm_campaign으로
- **핫픽스 패스트트랙** (2026-07-12, CLAUDE.md 멀티 에이전트 규칙 5): 로직 없는 1~5줄 수정(이미지·문구·스타일)은 에이전트/reviewer 생략, 오케스트레이터 직접 처리 (5분 내 목표)
- 사전등록 혜택 문구: "정식 출시 시 첫 달 무료" (가격 티저 섹션은 랜딩에서 제거 — 지불 의향 측정은 설문 담당)
- 랜딩 사진: Unsplash 무료 라이선스 원칙, 단 현 히어로는 사용자 제공 이미지(라이선스 미확인 — 정식 출시 전 교체 필요)
- **서버 Supabase 조회는 `cache: "no-store"` 필수** (admin 클라이언트 적용됨) — Next 데이터 캐시가 GET을 고착시키는 것 확인됨. 새 서버 조회 코드 추가 시 동일 주의

### 블로커
- 없음

---

## 2026-07-10 — 세션 #3: 랜딩 보강 (설문 배포 준비)

### 완료
- **BRD/TRD/PRD 3종 검토** (Downloads의 상위 기획 문서): 현재 베타 스코프와의 차이 확인 — 백엔드(FastAPI vs Next.js 풀스택)·통화 방식(실시간 스트리밍 vs ARS+)은 **미확정 유지(사용자 결정)**, 문서의 "CLOVA AiCall 확정" 기술은 채택 안 함(CLAUDE.md 추상화 방침 유지)
- **랜딩 페이지 보강** (ui-builder `feat/ui-landing-enrich` → reviewer PASS → main 머지 26d29d4, 테스트 65/65·빌드 통과):
  - 차별점 섹션 신설: "앱이 아니라, 진짜 전화입니다" — 기존 돌봄 앱 vs 이 서비스 2열 대비 카드
  - 리포트 미리보기 섹션 신설: 목업 카드 2개("예시 화면입니다" 라벨), '확인이 필요해요' UNCERTAIN 정직성 포인트 포함
  - 가드레일 준수: 토큰 클래스만 사용, 베타 범위 밖 기능(장기 기억·긴급 알림·실시간 대화) 문구 없음, 의료 미제공 고지 유지
- 랜딩 활용 방향 합의: 설문지에는 utm 링크(`?utm_source=survey` 등, USER_CHECK.md 규칙)로 랜딩 연결 → 사전등록(waitlist) 전환으로 사용 의향 측정
- **CTA 단일화** (사용자 결정: 최소형. ui-builder `feat/ui-single-cta` → reviewer PASS → 머지 382b949): [구독하기]/[베타 사용해보기] 2버튼 → **[사전등록하기] 단일 버튼 + 이메일 모달**. 추적은 기존 `CLICK_TRY` 재사용(API/DB/enum/admin 무변경), `CLICK_SUBSCRIBE`는 더 이상 발생 안 함(기존 수집분 보존). 지불 의향 측정은 설문지가 담당
  - 후속 검토 항목: admin/metrics의 CLICK_SUBSCRIBE 컬럼·라벨 정리(0 고정될 예정), contracts enum의 죽은 값 정리 여부
- **Vercel 프로덕션 배포 2회** (`vercel --prod`): 랜딩 보강분 + CTA 단일화분. https://voicescheduler.vercel.app 공개 확인(외부 공유용). 친구 등 테스트 유입은 `?utm_source=test` 링크 안내
- **사용자 피드백 4건 반영** (ui-builder `feat/ui-landing-feedback` → reviewer PASS → 머지 7ffbf59): ① 히어로 설명 화살표+체크 불렛화 ② "기존 앱 vs 이 서비스" 비교 → 보호자/시니어 관점 병렬 카드로 재구성 ③ 리포트 목업 앱 UI화(상태 뱃지+통화 요약 블록) ④ '확인이 필요해요' 카드 → "대화 내용 그대로 확인"+채팅형 전사 스니펫
  - ⚠️ 사용자가 "대화를 직접 **들을 수** 있는 기능"을 요청했으나 **녹음 미저장 정책(전사만)** 충돌로 "그대로 읽어 볼 수 있어요"로 조정해 반영 — 음성 청취를 원하면 녹음 저장 정책 변경 결정 필요(사용자에게 고지함)
  - 메모: UNCERTAIN 정직성 카드("억지로 판정 안 함")는 사용자 요청으로 랜딩에서 제거됨 (제품 동작은 불변)

### 다음 할 일
1. ~~GitHub push + Vercel 프로덕션 배포~~ ✅ 완료 (피드백 4건 반영분까지 3회 배포)
2. 설문 배포 전: ADMIN_PASSWORD 변경, 설문용 utm 링크 확정
3. (선택) waitlist에 전화번호/관심 이유 필드 추가 여부 결정

---

## 도구·자동화 로드맵 (2026-07-10 확정 — 전화 기능 자체 관련은 보류)

> 배경: 설문·사전등록으로 시장 검증하면서 개발 속도를 올리기 위한 스킬/MCP/외부 연동 계획.
> **사용자 지시: 전화 기능 자체에 대한 것(통화 파이프라인·분류 프롬프트 평가 등)은 아직 넣지 않음.**
> 원칙: 도구는 데이터가 흐르는 길목에만. "있으면 좋은" 수준의 MCP는 추가하지 않음 (컨텍스트·보안 표면 증가).

### A. 지금 (설문 배포 전) — 우선순위 높음
1. **Playwright MCP 연결**: `claude mcp add playwright npx @playwright/mcp@latest` (프로젝트 `.mcp.json` 공유 가능). 브라우저 실조작으로 UI 확인·스모크 자동화의 기반. ⚠️ 로컬/프리뷰 대상만, 프로덕션 계정 자격증명 주지 말 것 (테스트 전용 계정 사용)
2. **`/smoke` 스킬** (`.claude/skills/smoke/SKILL.md`): Playwright MCP로 핵심 플로우(랜딩 CTA→사전등록 / 로그인→피보호자 등록→일정→토글→대시보드) 자동 검증. **몇 주째 수동으로 밀린 Phase 2 스모크를 이걸로 통과시키는 게 첫 사용처**
3. **`/ship` 스킬**: reviewer→머지→`npm test`→push→`vercel --prod`→프로덕션 스모크 (현재 오케스트레이터가 수동 반복 중인 루틴의 스킬화)
4. **Vercel Web Analytics 추가**: `npm i @vercel/analytics` → 대시보드 Analytics Enable → 루트 레이아웃에 `<Analytics />` (`@vercel/analytics/next`). 무료 플랜 가능, dev에선 미수집, 반영까지 ~1h. ⚠️ 커스텀 이벤트는 Pro 전용 → CTA 이벤트는 기존 자체 `cta_events`로 계속 (중복 아님: Analytics는 방문·이탈 보완용)
5. 설문 배포 정비(기존 항목): ADMIN_PASSWORD 변경, utm 링크 확정(`?utm_source=survey|kakao|...`), OG 썸네일 품질 확인(카톡 공유 미리보기)
6. **판단 기준선 사전 합의**: 예) 랜딩 방문→사전등록 5%↑ = 수요 신호, 1%↓ = 메시지 재점검 (숫자 보기 전에 정할 것)

### B. 설문 기간
1. **Supabase MCP (read-only 필수)**: `.mcp.json`에 HTTP 타입 `https://mcp.supabase.com/mcp?project_ref=hcygbbbbzfpgucqkmxav&read_only=true` + PAT 헤더. 프로젝트 스코프 고정. "이번 주 사전등록 몇 명?"을 대화로 조회
2. **`/metrics-report` 스킬**: cta_events·waitlist 집계 → 주간 퍼널 리포트(채널별 전환율·전주 대비)
3. **`/survey-analyze` 스킬**: 설문 CSV → 고정 분석 프레임(세그먼트×지불 의향×채널 교차, Artifact 리포트). ⚠️ 설문 원본에 PII 있으면 저장소 커밋 금지
4. (선택) **Google Sheets MCP**: Forms→Sheets 자동 연동이면 실시간 응답 분석 가능. CSV 수동으로도 충분하므로 응답이 계속 유입되는 기간에만 가치

### C. 설문 이후 (분석·의사결정)
1. **`/cost-model` 스킬** (사업 도구 — 전화 기능 구현 아님): 분당 통화료·STT/TTS·LLM 단가 입력 → 통화당 원가→구독료 대비 마진 시뮬레이터. 벤더 비교(CPaaS vs CLOVA)·가격 결정의 근거. 추후 `call_sessions.cost_krw` 실데이터와 대조
2. **`/interview-notes` 스킬**: 사전등록자 인터뷰 메모 → 고정 프레임(페인 강도·현재 대안·지불 의향·인용문) 구조화 누적
3. **analyst 에이전트** (`.claude/agents/analyst.md`, Sonnet, 읽기 전용): DB 집계·설문 분석·리포트 전담 (개발 에이전트와 병렬)
4. **`/competitor-watch` 스킬**: 위식스 등 경쟁사 가격·기능 변화 월 1회 조사→차이표 갱신
5. **`/handoff` 스킬**: PROGRESS.md 갱신→커밋 루틴 자동화 (저비용, 아무 때나)

### 보류 (전화 기능 착수 시 — 사용자 지시로 지금 안 함)
- `/prompt-eval`: LLM 복약 분류(DONE/NOT_DONE/UNCERTAIN) 회귀 평가 하네스 — Phase 3 착수와 동시 필수 (사투리·모호 응답 케이스셋)

### 스킬 작성 규칙 (공식 문서 요지)
- 위치 `.claude/skills/<name>/SKILL.md`, YAML frontmatter(name·description) + 본문. **description이 트리거 라우팅 규칙** — "언제 발동하는지"를 구체적으로
- 본문은 짧게(500줄 이하), 상세는 `references/` 분리. 스킬 하나 = 역할 하나. 결정적 작업(집계·파싱)은 스크립트로
- 도입/변경 시 이 파일 결정사항에 버전 기록 (CLAUDE.md 세션 운영 규칙 3)

### 붙이지 않기로 한 것 (검토 완료)
- GitHub MCP(→`gh` CLI로 충분) / Notion·Linear MCP(팀 문서 미사용) / Sentry MCP(베타 규모에선 Vercel logs로 충분) / 결제·알림톡 계열(베타 범위 밖)

### 블로커
- 없음

---

## 2026-07-10 — 세션 #2: 배포·환경 정비 (Confirm email OFF / GitHub / 알약 원인 확정 / Vercel 최신화)

### 완료
- **Supabase "Confirm email" OFF** — 사용자 대시보드 조작 + API로 `mailer_autoconfirm: true` 반영 검증. 가입 즉시 로그인 가능
- **GitHub 원격 신설·푸시**: https://github.com/spacetravr/SeniorScheduler (main, 히스토리 포함). 팀원은 Settings → Collaborators로 초대, clone 후 `.env.example` → `.env.local` 채워 실행
- **dev 서버 끊김(errno -4094) 원인 확정**: 알약(ALYac) 실시간 감시가 `.next` 파일 잠금 (Defender 비활성 확인). 사용자가 알약 검사 예외에 프로젝트 폴더 등록 → 이후 전 라우트 재현 테스트에서 재발 없음
- **Vercel 프로덕션 최신화** (`vercel --prod`, 커밋 40d915f): 비밀번호 로그인 + admin 대시보드 개편 반영. 라우트 스모크 통과(/ 200, /login 200, /app 307, /admin/metrics 200, 랜딩 0.22s). Vercel CLI 55 전역 설치·로그인(spacetravr) 완료
- 속도 저하 원인 진단: ① dev 첫 방문 컴파일(배포판 무관) ② **Supabase 리전이 ap-southeast-2(시드니)** — 한국에서 인증·쿼리 호출당 ~0.3s 실측

### 다음 할 일
1. **Phase 2 스모크 잔여** (실서버 https://voicescheduler.vercel.app/login 로 해도 됨): 피보호자 등록(동의) → 일정 등록 → 토글 ON → 대시보드 오늘 인스턴스 → 통과 시 Phase 2 완료 판정
2. **사용자 수동**: Supabase → Authentication → URL Configuration → Site URL을 `https://voicescheduler.vercel.app`으로 원복 (magic link 보조 로그인 메일용. 비밀번호 주 로그인은 무관)
3. 미들웨어 개선(data 경계 — data-api 경유): 현재 matcher가 랜딩 `/` 포함 전 경로에서 `getUser()` 원격 호출 → 보호 경로 위주로 축소해 랜딩·로그인 응답 개선 (시드니 유지 결정으로 체감 효과 더 큼)
4. Phase 3 진입 (MockAdapter 파이프라인 선개발 — 벤더 결정과 무관)

### 결정사항
- **Supabase 리전: 시드니(ap-southeast-2) 유지 — 서울 이사 안 함 (사용자 결정, 2026-07-10)**. 호출당 ~0.3s 레이턴시 감수. 추후 속도가 문제되면 재검토 (데이터 쌓일수록 이전 비용 증가함은 고지됨)
- Vercel CLI 55 전역 설치 (배포는 `vercel --prod`, 프로젝트 링크 `.vercel/project.json` 존재)

### 블로커
- 없음

---

## 2026-07-06 — 세션 #1: 프로젝트 초기화 + Phase 0 착수

### 완료
- `.claude/agents/` 3역할(ui-builder=opus, data-api=opus, reviewer=sonnet) 모델 배분 확정 (frontmatter)
- CLAUDE.md에 `## 세션 운영 규칙` 섹션 추가 (모델 배분·PROGRESS.md 인수인계·버전 고정)
- Next.js 스캐폴딩 + npm install + `npm run build` 통과
- **Phase 0 코드 완성** (ui-builder ∥ data-api 병렬 → reviewer FAIL 1건(tsconfig target 누락, 오케스트레이터가 ES2017 추가로 해결) → 빌드 PASS):
  - 랜딩 `/`: 히어로→문제공감→3단계→가격티저(PRICING 상수)→CTA 2개+대기자 모달, 의료조언 미제공 고지
  - CTA 추적: session_uuid(localStorage) + utm 3종(sessionStorage) → VIEW 1회 dedup/클릭/제출
  - `supabase/migrations/0001_cta_waitlist.sql` (RLS deny-all, 쓰기는 서버 secret key 경유 — 승인된 설계)
  - `/api/cta`(204, VIEW 중복 23505 흡수), `/api/waitlist`(201, 이메일 중복 성공 처리), PII 로그 미포함
  - `/admin/metrics`: ADMIN_PASSWORD 게이트(?pw= 또는 쿠키), utm_source별 VIEW→CLICK→SUBMIT 퍼널
- `.env.local` 세팅 완료 (신형 키: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY, ADMIN_PASSWORD=vs-beta-2026)

### 완료 (Phase 0 종료 — 2026-07-06)
- 마이그레이션 원격 적용 (사용자가 SQL Editor 실행) + 로컬 스모크 8/8 통과
- 채널별 퍼널 분리 집계 검증 (kakao vs naver) → **Phase 0 완료 기준 충족**
- OG/트위터 메타 태그 추가
- **Vercel 프로덕션 배포: https://voicescheduler.vercel.app** (프로젝트 voicescheduler, 팀 voice-scheduler)
  - env 5종 등록: SUPABASE URL/PUBLISHABLE/SECRET, ADMIN_PASSWORD, NEXT_PUBLIC_SITE_URL
  - ⚠️ `TZ`는 Vercel 예약 변수라 등록 불가 → 코드에서 항상 Asia/Seoul 명시(date-fns-tz)로 대응, Cron은 -9h 변환 (CLAUDE.md 규칙대로)
- 프로덕션 스모크 통과 (랜딩 200/CTA 204/waitlist 201/OG 렌더), 테스트 데이터 정리 완료 (테이블 0행)
- `lib/contracts/domain.ts` 선커밋: Senior/Schedule/CallSession/CallTurn/CallReport zod 스키마 + 상태 라벨 + MEDICAL_DISCLAIMER

### 완료 (Phase 2 코드 — 2026-07-06)
- **데이터 계층** (data-api, reviewer PASS, 머지 8d1dd1b):
  - `supabase/migrations/0002_guardians_seniors_schedules.sql`: guardians/seniors/schedules + RLS(guardian_id = auth.uid() 격리) + 동의 트리거(미동의 active 차단, 동의 철회 시 일정 자동 OFF) + auth.users→guardians 자동 생성(security definer, search_path 고정)
  - Auth: `@supabase/ssr` 서버/브라우저 클라이언트, `middleware.ts`(/app/* 가드→/login), magic link(`/api/auth/confirm` verifyOtp token_hash 방식), 로그아웃
  - CRUD server actions: `lib/actions/seniors.ts`·`schedules.ts` (zod 검증, RLS 클라이언트 경유, admin 미사용, 동의 이중 방어), 조회 `lib/db/queries.ts`
  - `lib/scheduling/occurrences.ts`: RRULE→다음 발신 시각, Asia/Seoul 명시(rrule UTC 함정 우회 — FREQ/BYDAY만 파싱 후 fromZonedTime), 유닛 테스트 18개
  - **지원 RRULE 범위: `FREQ=DAILY` / `FREQ=WEEKLY;BYDAY=...` 만** (그 외 InvalidRruleError — 폼도 이 두 형태만 생성)
- **UI 결합** (ui-builder, reviewer PASS, 머지됨):
  - `/login` 신규(magic link 폼), 대시보드 오늘 일정→`getTodayCallInstances()` 실데이터, seniors/schedules CRUD 폼·토글 실연결(낙관적 갱신+원복), 설정에 이메일+로그아웃, 빈 상태 UI
  - mock 잔존(Phase 3 범위, "예시 데이터" 라벨 부착): `/app/calls`(+상세), `/app/reports`, 대시보드 주간 이행률·최근 통화 결과
- 통합 main: `npm test` 27/27, 빌드 통과(Middleware 포함)
- ⚠️ **미검증**: 실제 Supabase 대상 동작 — 아래 수동 작업 완료 후 스모크 필요

### 다음 할 일
1. ~~0002 마이그레이션 실행~~ ✅ 완료 (사용자, SQL Editor)
2. ~~Auth URL 설정~~ ✅ 완료 (Site URL=localhost:3000(임시)·Redirect URLs 2종)
   - ⚠️ **이메일 템플릿 수정은 불가** — 2026-06부터 신규 무료 프로젝트는 기본 메일 제공자로 템플릿 편집 차단 → 콜백에 PKCE `?code=` 교환 경로 추가로 대응(0e98533, 기본 ConfirmationURL 템플릿 그대로 동작. token_hash 경로도 유지). PKCE 한계: 메일을 **요청한 브라우저에서** 링크를 열어야 함
3. 로컬 스모크: /app→/login redirect → 메일 로그인 → 피보호자 등록(동의) → 일정 등록 → 토글 ON → 대시보드 오늘 인스턴스 표시 확인 → **Phase 2 완료 판정**
4. 스모크 후: Site URL을 `https://voicescheduler.vercel.app`으로 원복 + Vercel 배포
5. **베타 공개 전 커스텀 SMTP 연결 필수** — 무료 기본 메일은 프로젝트 전체 시간당 2통 제한. SMTP 연결 시 30통/h + 템플릿 편집 재개방(도메인 없으면 Brevo 단일 발신자 인증 또는 Gmail 앱 비밀번호)
6. Phase 3 (벤더 비교 선행 결정 필요 — PLAN 3-0)

### 완료 (Phase 1 — 2026-07-06)
- 보호자 웹 전 화면 mock 완성 (ui-builder): `/app`(대시보드)·`/app/seniors`(동의 체크박스 폼)·`/app/schedules`(ON/OFF 토글+RRULE 폼)·`/app/calls`+`[id]`(전사 타임라인)·`/app/reports`(MEDICAL_DISCLAIMER 고정)·`/app/settings`
- 공통: `components/app/` StatusBadge(6종 뱃지)·AppNav(모바일 탭바+데스크톱 사이드)·format.ts(KST 문자열 포맷, Date 연산 없음)
- reviewer FAIL 1건(fmtRrule 유닛 테스트 누락) → ui-builder가 format.test.ts 추가(9 테스트, 요일 정렬 버그 발견·수정) → `npm test` exit 0, 빌드 21라우트 통과
- **Phase 1 완료 기준 충족: 로그인 없이 mock으로 전 화면 클릭 가능**

### 완료 (로그인 개선 1/2 — 2026-07-06 밤)
- **첫 실사용 피드백 2건 접수**: ① 대시보드에서 클릭 안 되는 요소들(오늘의 일정 카드 링크 없음 + mock 섹션이 고장처럼 보임) ② magic link 로그인 이상함 — dev 로그로 원인 확정: 첫 시도 `pkce_code_verifier_not_found` 실패했는데 `/login?error=expired_link` 파라미터를 로그인 페이지가 **읽지도 표시하지도 않음** (조용한 실패)
- **결정: 이메일+비밀번호를 주 로그인으로 전환** (사용자 선택). magic link는 "비밀번호 분실 시 메일 로그인" 보조로 유지 → 별도 재설정 플로우 불필요 (로그인 후 설정에서 비밀번호 변경)
- **데이터 계층 완료** (reviewer PASS, 머지됨): `lib/actions/auth.ts`에 `signUpWithPassword`/`signInWithPassword`/`updatePassword` 추가. zod 8~72자, 에러 한국어 매핑(`lib/actions/auth-validation.ts`, 21 유닛 테스트), PII 무로깅. guardians 자동 생성은 기존 DB 트리거가 signUp에도 적용됨(확인 완료). 총 테스트 61개.
- ui-builder가 쓸 시그니처: `signUpWithPassword(fd: email,password,password_confirm)` → `{ok:true;message;session:boolean}|{ok:false;error}` (session=true면 즉시 /app 이동, false면 "확인 메일" 안내) / `signInWithPassword(fd: email,password)` / `updatePassword(fd: password,password_confirm)` — 모두 `AuthActionResult` 반환

### 완료 (로그인 개선 2/2 — 2026-07-07, reviewer PASS·머지됨)
- ui-builder(`feat/ui-password-login`, 커밋 3개) → reviewer PASS → main 머지, 머지 후 `npm test` 65/65:
  - `/login` 개편: 이메일+비밀번호 로그인/회원가입 탭 전환 폼, signUp `session:true`→/app·false→확인 메일 안내, "비밀번호를 잊으셨나요? 메일로 로그인" 접힌 보조 폼(sendMagicLink), **`?error=expired_link|invalid_link|기타` 한국어 경고 배너**(`components/app/login-messages.ts` 순수 함수 + 테스트 4개, XSS 없음 — 고정 문자열만 렌더)
  - 대시보드: 오늘의 일정 카드→`/app/schedules` 링크화, mock 섹션(이행률·최근 통화) 비클릭 명확화+"실제 통화가 시작되면 채워집니다"
  - `/app/settings`: 비밀번호 변경/최초 설정 폼(`updatePassword`)
  - 접근성: role=alert/status, 탭 aria-selected, 제출 중 disabled
- reviewer non-blocking 메모: 이모지(📬)는 디자인 확정 시 아이콘으로 교체 검토 / login page searchParams 타입이 배열 케이스(`?error=a&error=b`) 미고려(실사용 영향 미미)

### 진행 중 (Phase 2 스모크 — 2026-07-07~08)
- **사용자 계정에 임시 비밀번호 설정 완료** (오케스트레이터가 admin API로): spacetr17@khu.ac.kr / `ansim-beta-0707` — API 로그인 검증 통과. 사용자는 로그인 후 설정에서 변경 권장
- 로컬 스모크 진행 중: 로그인→대시보드→일정 이동까지 확인됨. **피보호자 등록(동의)→일정 등록→토글 ON→대시보드 오늘 인스턴스 표시**는 사용자 확인 대기 → 완료 시 Phase 2 완료 판정
- ⚠️ **Windows dev 서버 이슈 (원인 확정 — 2026-07-10)**: `.next` 캐시 파일 깨짐(errno -4094) 3회 재발 → **원인: 알약(ALYac) 실시간 감시가 `.next` 파일 잠금** (Defender는 비활성, SecurityCenter2로 확인). 조치: 알약 검사 예외에 프로젝트 폴더 등록(사용자). 임시 복구는 `.next` 삭제+재시작
- 이번에 클릭해보며 나온 개선 요청은 이 파일에 추가 기록할 것

### 다음 할 일
1. ~~Supabase "Confirm email" 토글 OFF~~ ✅ 완료 (2026-07-10, 사용자 수동 → API로 `mailer_autoconfirm: true` 반영 확인. 나중에 SMTP 연결 후 ON 전환 가능)
2. ~~Vercel 배포~~ ✅ 완료 (2026-07-10, `vercel --prod` → https://voicescheduler.vercel.app 최신화, 라우트 스모크 200/307 통과). ⚠️ 잔여: Supabase Site URL 아직 localhost — magic link 보조 로그인용으로 `https://voicescheduler.vercel.app` 원복 필요(사용자). GitHub 신규 원격: https://github.com/spacetravr/SeniorScheduler (main push 완료)
3. **Phase 3 진입 (배포 후)**: 벤더 비교(국내 CPaaS vs CLOVA AiCall, PLAN 3-0 — 사용자 결정 필요)와 무관하게 MockAdapter로 파이프라인(발신 스케줄러→call_sessions 상태 기계→LLM 분류·리포트→calls/reports 화면 실연결) 선개발 가능
4. 디자인은 토큰 교체만으로 전체 반영되는 구조 확인 — 확정값 대기, 기능 개발 블로킹 아님
- **CTA 운영 정비 (2026-07-06 저녁, reviewer PASS·머지됨)**: `USER_CHECK.md` 신설(유포용 utm 링크 규칙·데이터 설명·열람 방법 — utm_source=test 규칙 포함) + `/admin/metrics` 한글 대시보드 전면 개편(요약 카드·퍼널 설명·채널 표·일별 추이·최근 활동·대기자 마스킹, test 유입 집계 제외, KST 명시, lib.test.ts 13케이스). 총 테스트 40개. **프로덕션 미배포 — Phase 2 스모크 후 함께 배포.**

### 기타 대기 항목
1. 디자인 토큰 확정값 오면 globals.css 교체 (Phase 1 항목 4)
2. ADMIN_PASSWORD(vs-beta-2026) 설문 배포 전 변경 권장

### 결정사항
- **스택 버전 (호환성 우선, 메이저 업그레이드는 오케스트레이터 승인 필요)**:
  - Next.js **14.2.x** + React **18.3** (App Router) — Supabase SSR·생태계와 가장 검증된 조합
  - Tailwind CSS **3.4** (v4는 설정 체계가 달라 보류) — 토큰은 CSS 변수 → `tailwind.config.ts`에서 참조
  - zod 3.x / date-fns 3.x + date-fns-tz 3.x / rrule 2.8 / @supabase/supabase-js 2.x + @supabase/ssr / vitest 2.x
- **Supabase**: project id `hcygbbbbzfpgucqkmxav` (URL: `https://hcygbbbbzfpgucqkmxav.supabase.co`) — 사용자 보유 확인
- **가격 티저 (잠정, 오케스트레이터 결정 — 상수 분리로 교체 용이)**:
  - 베타 기간: **무료**
  - 정식 출시 예상가: **월 9,900원** (1일 1회 안부·복약 전화 기준) — "베타 신청 시 정식 출시 후 첫 달 무료" 훅
  - 위치: `lib/contracts/pricing.ts` 상수로 분리 (UI는 import만)

### 블로커
- **Supabase anon key + service role key 필요** — 사용자가 대시보드(Settings → API)에서 복사해 `.env.local`에 넣어야 CTA 실데이터 저장 가능. 그 전까지 UI·스키마 파일은 로컬에서 완성 가능.
