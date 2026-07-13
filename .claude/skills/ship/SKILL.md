---
name: ship
description: 배포 루틴. 발동 조건 — 기능 브랜치 작업이 완료된 뒤 사용자가 "배포해줘"·"ship"·"프로덕션 반영해줘"·"머지하고 배포"라고 요청할 때. reviewer 검토→main 머지→테스트→빌드→push→vercel 프로덕션 배포→스모크→PROGRESS.md 갱신을 순서대로 수행한다.
---

# /ship — 배포 루틴

기능 브랜치 → 프로덕션까지의 표준 루틴. **각 단계 실패 시 즉시 중단하고 원인을 보고한다 — 다음 단계 진행 금지.**

## a. 브랜치 확인
- `git branch --show-current`로 현재 브랜치 확인.
- **main이면 중단**: "배포할 기능 브랜치에서 실행하세요. main 직접 커밋은 금지입니다(CLAUDE.md 멀티 에이전트 규칙 2)." 안내 후 종료.
- 커밋 안 된 변경이 있으면 먼저 커밋하도록 안내.

## b. reviewer 검토 (PASS 필수)
- reviewer 에이전트(`.claude/agents/reviewer.md`)로 브랜치 diff 검토 → **PASS 판정 필수**. FAIL이면 중단하고 지적 사항 보고.
- **생략 가능 예외**: CLAUDE.md 핫픽스 패스트트랙 해당 시(로직 변경 없는 이미지·문구·색상·정렬 등 1~5줄 스타일/에셋 교체). 로직·추적·계약·DB·인증에 닿으면 예외 불가.

## c. 머지 → 테스트 → 빌드
1. `git checkout main && git merge <feature-branch>` (충돌 시 중단·보고)
2. `npm test` — **전체 통과 필수** (실패 시 중단, main을 머지 전으로 되돌릴지 사용자에게 확인)
3. `npm run build` — 통과 필수

## d. push
- `git push origin main`

## e. 프로덕션 배포
- `vercel deploy --prod`
- `vercel` 명령이 PATH에 없으면 `npx vercel deploy --prod` 사용.
- 배포 URL(https://seniorscheduler.vercel.app) 출력 확인.

## f. 프로덕션 스모크
- `/smoke prod` 스킬 호출 (`.claude/skills/smoke/SKILL.md`).
- smoke 스킬을 쓸 수 없는 상황이면 최소 curl 라우트 점검으로 대체:
  - `GET https://seniorscheduler.vercel.app/` → 200
  - `GET https://seniorscheduler.vercel.app/preregister` → 200
  - `GET https://voicescheduler.vercel.app/` → **308** (구 도메인 리다이렉트 유지)
- 스모크 실패 시 배포 결과를 실패로 보고하고 롤백 여부를 사용자에게 확인.

## g. PROGRESS.md 갱신 리마인드
- 배포 내역(무엇을 배포했는지)·머지 커밋 해시·스모크 결과를 PROGRESS.md에 기록하도록 리마인드(또는 직접 갱신 제안). CLAUDE.md 세션 운영 규칙 2 준수.

## 보고 형식
각 단계 결과를 순서대로:
```
[a] 브랜치: feat/... OK
[b] reviewer: PASS (또는 패스트트랙 생략 — 사유)
[c] merge <해시> / npm test N/N / build OK
[d] push OK
[e] vercel deploy --prod OK → https://seniorscheduler.vercel.app
[f] smoke prod: PASS
[g] PROGRESS.md 갱신: 완료/리마인드
```
실패한 단계가 있으면 그 단계에서 멈춘 상태와 원인, 권장 조치를 명시한다.
