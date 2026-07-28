# SNS 운영 키트 — Senior Scheduler (v2, 2026-07-28)

> 카드뉴스 이미지: `marketing-assets/cardnews/` (1080×1080 인스타 정방형)
> - Set 01 "매일 그 전화" — `set01.html` / `set01-card01~06.png`
> - Set 02 "리포트가 이렇게 옵니다" — `set02.html` / `set02-card01~06.png`
> 캡션: `marketing-assets/captions-set01.md`, `captions-set02.md`
> 재생산·디자인 규칙: `marketing-assets/cardnews/README.md`
> 톤: "따뜻함+신뢰". 카드 1장 = 메시지 1개, 큰 글자·넓은 여백, 강조는 카드당 1점, 이모지 미사용.
> 과장·의료 효능 주장 금지, 미구현 기능 언급 금지, "자녀를 대신/대체" 표현 금지(→ "보완·거들다").
>
> **v2 변경(2026-07-28)**: Set 01 전면 리뉴얼(가독성·비대칭 레이아웃), Set 02 신규 제작, 캡션 파일 분리.

## 1. 인스타그램 프로필

- **이름**: Senior Scheduler | 시니어 스케줄러
- **카테고리**: 건강/웰빙 서비스 (의료 아님 주의 — "소프트웨어 회사"도 무방)
- **소개(150자)**:
  ```
  부모님 안부, 전화 한 통으로.
  앱 설치 없이 · 복약/병원 일정 확인 · 결과 리포트
  지금 베타 사전등록 (무료) — 아래 링크
  ```
- **링크**: `https://seniorscheduler.vercel.app/?utm_source=instagram&utm_medium=social&utm_campaign=profile`
  (프로필 링크는 campaign=profile 고정 — 게시물별 링크와 분리 집계)

## 2. 카드뉴스 세트와 캡션

캡션 전문·해시태그·댓글 응대 가이드는 각 캡션 파일이 단일 소스입니다(여기서 중복 관리하지 않음).

| 세트 | 구성(6장) | 이미지 | 캡션 | utm_campaign |
|---|---|---|---|---|
| Set 01 "매일 그 전화" | 공감 → 문제 → 소개 → 작동 3단계 → 안심 → CTA | `cardnews/set01-card01~06.png` | `captions-set01.md` | `cardnews01` |
| Set 02 "리포트가 이렇게 옵니다" | 도입 → 정상 리포트 예시 → "확인 필요" 예시 → 정직한 판정 → 알림 정책 → CTA | `cardnews/set02-card01~06.png` | `captions-set02.md` | `cardnews02` |

Set 02 주의: 카드 2·3의 리포트 화면은 **예시**입니다. 게시물 캡션에 예시임을 반드시 남기고, 실제 고객 데이터를 캡처해 쓰지 않습니다.

## 3. 채널별 링크 (utm 규칙)

| 용도 | 링크 |
|---|---|
| 인스타 프로필 | `/?utm_source=instagram&utm_medium=social&utm_campaign=profile` |
| 인스타 게시물(카드뉴스01) | `/?utm_source=instagram&utm_medium=social&utm_campaign=cardnews01` |
| 인스타 게시물(카드뉴스02) | `/?utm_source=instagram&utm_medium=social&utm_campaign=cardnews02` |
| 인스타 스토리 | `/?utm_source=instagram&utm_medium=social&utm_campaign=story` |
| 페이스북/스레드 | `utm_source=facebook` / `utm_source=threads` (나머지 동일 패턴) |

기본 도메인: `https://seniorscheduler.vercel.app` — 유입은 /admin/metrics에서 채널별 확인.
(기존 카페 링크 11종은 USER_CHECK.md §2가 단일 소스 — 중복 생성 금지)

## 4. 2주 콘텐츠 캘린더 (주 3회: 월·수·금)

| # | 요일 | 형식 | 주제 | 상태 |
|---|---|---|---|---|
| 1 | 1주 월 | 카드뉴스 6장 | Set 01: 공감→소개→작동→안심→CTA | ✅ 제작 완료 (v2 리뉴얼) |
| 2 | 1주 수 | 단장 이미지 | "부모님 폰에 앱이 없어도 됩니다" — 오해 깨기 1컷 | `set01-card03.png` 단독 재사용 |
| 3 | 1주 금 | 카드뉴스 6장 | Set 02: 리포트가 이렇게 옵니다 (정직한 판정·알림 정책) | ✅ 제작 완료 |
| 4 | 2주 월 | 단장 이미지 | 안심 3원칙 | `set01-card05.png` 단독 재사용 |
| 5 | 2주 수 | 단장 이미지 | "모르는 건 모른다고 말씀드립니다" — 정직한 판정 1컷 | `set02-card04.png` 단독 재사용 |
| 6 | 2주 금 | 카드뉴스 4~5장 | "이런 분께 필요해요" 페르소나 3종 (멀리 사는 자녀/맞벌이/형제 교대 돌봄) | Set 03 후보 |

운영 수칙:
- 게시 시간: 20:30~21:30 KST (3050 자녀 세대 저녁 활동 시간대)
- 모든 수치·기능 주장은 실제 구현된 것만 (실시간 대화·알림톡·앱 설치·긴급출동 등 미구현 기능 언급 금지)
- 의료 효능("건강이 좋아져요" 류) 문구 금지 — 가드레일 1과 동일 기준
- "자녀를 대신/대체" 표현 금지 → "자녀가 못 챙기는 시간을 보완/거들다" (MARKETING-PLAN §2)
- 가격 숫자, 실측 아닌 수치·후기 창작 금지. 리포트 화면은 예시임을 명시
- 댓글 문의 → FAQ 링크(/faq)로 응대. 응급 관련 질문에는 "긴급 구조를 대행하지 않습니다, 위급 시 119" 고지

## 5. 다음 제작 백로그

- Set 03: 페르소나 공감 시리즈 (멀리 사는 자녀 / 맞벌이 / 형제 교대 돌봄)
- 스토리 템플릿 (1080×1920) — set01.html·set02.html 변형으로 제작 가능
- 릴스 15초 (MARKETING-PLAN §3-3): 전화벨 → AI 인사(실제 TTS) → 어르신 답변(재연) → 리포트 화면. "재연 영상" 표기 필수
- 프로필용 로고 이미지 (현재 app/icon.svg 브랜드 전화 아이콘 확대판)
