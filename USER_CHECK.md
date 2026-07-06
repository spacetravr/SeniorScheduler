# USER_CHECK.md — 페이크도어(랜딩 CTA) 검증 운영 가이드

> 대상: 서비스 운영자(마스터). 설문/링크를 배포하고 수요 데이터를 확인하는 방법을 담은 실전 가이드.
> 관련 코드: `components/marketing/useCtaTracking.ts`, `app/api/cta/`, `app/api/waitlist/`, `app/admin/metrics/`

---

## 1. 이게 뭘 검증하는 건가 (페이크도어 원리)

아직 실제 보이스콜 기능이 완성되지 않은 상태에서, **"사람들이 정말 이 서비스에 돈/시간을 쓸 의향이 있는가"** 를 먼저 측정한다.

- 랜딩 페이지는 완성된 서비스처럼 보이지만, [구독하기]/[베타 사용해보기] 버튼을 누르면 실제 가입 대신 **대기자 등록(이메일)** 으로 이어진다.
- 방문자가 어디까지 진행했는지(보기만 함 → 버튼 클릭 → 이메일까지 제출)가 전부 기록되므로, **관심의 깊이**를 단계별로 잴 수 있다.
- 버튼 클릭 = "가격/기능을 보고도 눌렀다"는 신호. 이메일 제출 = 가장 강한 수요 신호.

### 추적 동작 흐름

```
방문자가 링크 클릭 (utm 파라미터 포함)
  → 랜딩 도착: 브라우저에 익명 ID(session_uuid) 생성 + utm 3종 저장
  → [VIEW] 이벤트 1회 기록 (새로고침해도 중복 안 됨)
  → 버튼 클릭 시 [CLICK_SUBSCRIBE](구독하기) 또는 [CLICK_TRY](베타 사용해보기) 기록
  → 대기자 모달에서 이메일 제출 시 [WAITLIST_SUBMIT] 기록 + waitlist에 이메일 저장
```

- **개인정보 최소화**: 이메일을 제출하기 전까지는 이름·연락처 등 어떤 개인정보도 수집하지 않는다. session_uuid는 무작위 익명 값이다.
- **조작 불가**: 기록은 서버를 거쳐 저장되고, DB는 외부 접근이 전면 차단(RLS)되어 있어 방문자가 데이터를 읽거나 조작할 수 없다.
- **UX 무간섭**: 기록 전송이 실패해도 방문자 화면은 정상 동작한다.

---

## 2. 유포(배포) 방법 — 링크 만드는 법

**기본 주소**: `https://voicescheduler.vercel.app`

채널마다 **다른 utm 파라미터를 붙인 링크**를 만들어 뿌리면, 채널별로 성과가 자동 분리 집계된다.

| 파라미터 | 의미 | 예시 |
|---|---|---|
| `utm_source` | 어디에 뿌렸나 (채널) | `kakao`, `naver_cafe`, `instagram`, `survey` |
| `utm_medium` | 어떤 형태로 (매체) | `social`, `dm`, `qr`, `form` |
| `utm_campaign` | 어떤 회차/실험인가 | `beta1`, `survey_202607` |

### 바로 쓸 수 있는 링크 예시

```
카카오톡 단체방:
https://voicescheduler.vercel.app/?utm_source=kakao&utm_medium=social&utm_campaign=beta1

네이버 카페 글:
https://voicescheduler.vercel.app/?utm_source=naver_cafe&utm_medium=social&utm_campaign=beta1

설문지(구글폼 등) 마지막에 삽입:
https://voicescheduler.vercel.app/?utm_source=survey&utm_medium=form&utm_campaign=survey_202607

인스타그램 프로필/스토리:
https://voicescheduler.vercel.app/?utm_source=instagram&utm_medium=social&utm_campaign=beta1
```

### 유포 시 규칙

1. **utm 없는 맨 주소를 뿌리지 말 것** — 어디서 왔는지 알 수 없는 "(직접)" 유입으로 잡힌다.
2. `utm_source` 값은 **미리 정한 표기만** 사용 (kakao / naver_cafe / instagram / survey …). 같은 채널을 `Kakao`, `kakaotalk` 등으로 섞어 쓰면 집계가 쪼개진다.
3. 새 채널·새 회차를 시작할 때는 이 문서에 사용한 utm 값을 추가로 기록해 둘 것.
4. **본인/팀원이 테스트로 접속할 때는 반드시** `utm_source=test` **링크를 사용** — 실제 수요 데이터와 섞이지 않게 하기 위함:
   `https://voicescheduler.vercel.app/?utm_source=test`

---

## 3. 어떤 데이터가 쌓이나

### `cta_events` 테이블 — 행동 로그 (1행 = 이벤트 1건)

| 컬럼 | 내용 |
|---|---|
| `type` | `VIEW`(페이지 봄) / `CLICK_SUBSCRIBE`(구독하기 클릭) / `CLICK_TRY`(베타 사용해보기 클릭) / `WAITLIST_SUBMIT`(이메일 제출) |
| `session_uuid` | 익명 방문자 ID (같은 브라우저 = 같은 값) |
| `utm_source / medium / campaign` | 유입 채널 정보 |
| `created_at` | 발생 시각 |

### `waitlist` 테이블 — 대기자 명단

| 컬럼 | 내용 |
|---|---|
| `email` | 제출한 이메일 (유일한 개인정보. 중복 제출은 1건으로 처리) |
| `session_uuid`, utm 3종 | 어느 채널에서 온 대기자인지 연결 |
| `created_at` | 제출 시각 |

### 이 데이터로 답할 수 있는 질문

- 채널별 반응: 카카오 vs 네이버 카페, 어디서 온 사람이 더 많이 클릭하나?
- 전환율(CVR): 100명이 보면 몇 명이 이메일까지 남기나? → **수요 검증의 핵심 숫자**
- 버튼 선호: "구독하기"(결제 의향)와 "베타 사용해보기"(체험 의향) 중 뭘 더 누르나?
- 대기자 수: 베타 시작 시 연락할 실명단.

---

## 4. 데이터 보는 법

### 방법 A — 지표 대시보드 (일상 확인용)

```
https://voicescheduler.vercel.app/admin/metrics
```

접속하면 비밀번호 입력 화면이 뜬다. `ADMIN_PASSWORD` 환경변수 값을 입력하면 채널별 퍼널(방문→클릭→제출)과 전환율이 표시된다.
- 비밀번호는 Vercel 환경변수에 설정되어 있다 (현재 값은 보안상 이 문서에 적지 않음 — PROGRESS.md 참고, **설문 배포 전 변경 권장**).
- 지표 화면의 각 용어 설명은 페이지 안에 함께 표시된다.

### 방법 B — 내 컴퓨터(로컬)에서 보기

로컬 개발 서버도 **같은 실제 DB**를 바라보므로, 로컬에서도 실데이터를 볼 수 있다:

```bash
npm run dev
# 브라우저에서 http://localhost:3000/admin/metrics 접속 → 비밀번호 입력
```

⚠️ 단, 로컬 랜딩(`localhost:3000`)에서 버튼을 눌러도 **실제 DB에 기록된다** (환경 분리 없음). 로컬에서 테스트할 때도 `?utm_source=test`를 붙여 접속할 것.

### 방법 C — 원본 데이터 직접 보기 (Supabase)

이메일 명단 전체를 뽑거나 원본 행을 봐야 할 때:

1. https://supabase.com/dashboard/project/hcygbbbbzfpgucqkmxav 접속
2. 좌측 **Table Editor** → `cta_events` 또는 `waitlist` 선택
3. CSV 내보내기도 여기서 가능

---

## 5. 숫자 읽을 때 주의사항

- **VIEW는 "고유 방문"에 가깝다**: 같은 브라우저는 새로고침해도 VIEW가 1번만 기록된다. 단, 시크릿 모드/다른 브라우저/브라우저 데이터 삭제 후에는 새 방문으로 잡힌다.
- **CLICK은 중복 가능**: 같은 사람이 버튼을 3번 누르면 3건이다. "몇 명이 눌렀나"가 궁금하면 대시보드의 전환율(세션 기준)과 함께 볼 것.
- **`(직접)` 유입** = utm 없이 들어온 방문 (주소 직접 입력, utm 없는 링크 공유 등). 이 비중이 크면 링크 관리가 새고 있다는 뜻.
- **`test` 소스는 집계에서 제외하고 볼 것** — 본인 테스트 데이터다.
- 초기 며칠은 표본이 작아 전환율이 크게 출렁인다. 채널당 VIEW 30~50 이상 모인 뒤 비교할 것.
