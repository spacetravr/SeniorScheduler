# 카드뉴스 소스와 PNG 재생산 절차

## 파일

| 파일 | 내용 |
|---|---|
| `set01.html` | Set 01 "매일 그 전화" — 공감 → 문제 → 소개 → 작동 3단계 → 안심 → CTA (6장) |
| `set02.html` | Set 02 "리포트가 이렇게 옵니다" — 도입 → 정상 리포트 → 확인 필요 리포트 → 정직한 판정 → 알림 정책 → CTA (6장) |
| `set01-card01~06.png` | Set 01 렌더 결과 (1080×1080) |
| `set02-card01~06.png` | Set 02 렌더 결과 (1080×1080) |

문구만 고치고 아래 절차로 다시 캡처하면 무한 재생산됩니다. **색은 `:root` 토큰(네이비/크림/테라코타/베이지)만 사용** — `app/globals.css` 와 동기화 유지.

## 디자인 규칙 (수정 시 지킬 것)

- 카드 1장 = 메시지 1개. 큰 글자(본문 28px 이상, 헤드라인 78~96px), 넓은 여백.
- 강조(테라코타)는 **카드당 1점**. 이모지 사용하지 않음.
- 카드마다 레이아웃을 달리해 리듬을 준다(전면 텍스트 / 인용 / 목업 / 단계 / 선언).
- 한글 우선(Pretendard). 영문은 URL 정도만.
- 금지: 의료 효능 암시, 미구현 기능(알림톡·앱 설치·실시간 대화·긴급 출동), "자녀를 대신/대체", 가격 숫자, 창작 수치·후기.

## PNG 재생산 (file:// 은 폰트 CDN·캡처가 막히므로 반드시 로컬 HTTP 서버)

```bash
# 1) 이 디렉터리에서 로컬 서버 기동
cd marketing-assets/cardnews
python -m http.server 8899 --bind 127.0.0.1

# 2) 브라우저 자동화(Playwright MCP 등)로 전체 페이지 캡처
#    - http://127.0.0.1:8899/set01.html 로 이동
#    - 캡처 전 주입 CSS: `.card{margin:0 !important;} body{background:#fff;}`
#    - 폰트 로딩 대기 1.5초 이상
#    - page.screenshot({ fullPage: true, scale: 'device' }) 로 전체 저장

# 3) 세로로 1080px 씩 잘라 카드 1장씩 저장 (Pillow)
python - <<'PY'
from PIL import Image
im = Image.open('full01.png')          # 2)에서 저장한 전체 이미지
for i in range(6):
    im.crop((0, i*1080, 1080, (i+1)*1080)).save(f'set01-card{i+1:02d}.png')
PY
```

### 캡처 환경 주의 (실측 기록, 2026-07-28)

- 이 PC의 브라우저는 `devicePixelRatio ≈ 0.667`(창 축소 상태)이라 **요소 단위 캡처(`locator.screenshot`)와 `clip` 좌표가 어긋난다.** 위 절차처럼 전체 페이지를 찍고 이미지에서 1080px 밴드로 잘라내는 방식이 가장 안전하다.
- 캡처 직전 `html{zoom:1.5}` 를 함께 주입하면 실제 래스터 해상도가 1080px 로 맞는다(전체 이미지 폭 1620, 카드 1장은 1080px 밴드).
- 결과 검증: 각 PNG 가 정확히 1080×1080 이고, 워드마크(좌상단)와 본문이 겹치지 않는지 눈으로 확인.

## 레이아웃 안전선 점검 (수정 후 1회)

브라우저 콘솔에서:

```js
[...document.querySelectorAll('.card')].map(c => {
  const cr = c.getBoundingClientRect();
  const kids = [...c.children].filter(k => !k.classList.contains('mark') && !k.classList.contains('num'));
  const top = Math.min(...kids.map(k => k.getBoundingClientRect().top - cr.top));
  const bot = Math.max(...kids.map(k => k.getBoundingClientRect().bottom - cr.top));
  return `${c.id} top=${Math.round(top)} bot=${Math.round(bot)}`;
});
```

`top ≥ 140`, `bot ≤ 1020` 이면 워드마크·페이지 번호와 충돌하지 않는다.
