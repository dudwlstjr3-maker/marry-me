# marry me

결혼식 날짜를 넣으면 준비 일정, 예산, 하객·축의금, 신혼여행, 알아둘 제도, 둘이 정할 것을 한 화면에서 관리하는 한 파일짜리 웹앱이에요.

## 파일

- `index.html` — 앱 전체(HTML·CSS·JS). 밖에서 불러오는 건 Google Fonts뿐이에요.

## 탭

진행 순서 / 예산 / 하객 / 신혼여행 / 알아둘 것 / 둘이 정할 것

## 어디서 열면 어떻게 저장되나

| 여는 곳 | 저장 |
|---|---|
| claude.ai 아티팩트 링크 | 공유 저장소. 수정 권한을 준 상대와 같은 데이터를 봐요. |
| GitHub Pages, 내려받은 파일 | 그 브라우저에만 저장(localStorage). 기기끼리 공유되지 않아요. |

## 수정할 때 지킬 것

- `<form>`과 submit을 쓰지 마세요. claude.ai는 앱을 보안이 걸린 iframe에서 열어서 폼 제출이 막혀요. 저장은 `<button type="button">` 클릭 핸들러로, 엔터는 keydown으로 처리해요.
- 외부 리소스는 스크립트 cdnjs.cloudflare.com, cdn.jsdelivr.net/npm, code.jquery.com과 스타일 fonts.googleapis.com만 쓸 수 있어요. 외부 이미지와 다른 사이트로의 요청은 막혀요.
- 저장 로직은 `Store`, `commit`, `flush`, `init`에 있어요. claude.ai에서는 `window.claude.use('db')`의 `plan/main` 문서를, 그 밖에서는 localStorage `wedding-plan-v1`을 써요. 데이터는 객체로만 저장하고(배열 금지), 삭제는 키를 지우지 않고 `deleted: true`로 표시해요.
- 고정 ID는 바꾸거나 지우지 마세요: `TASKS` t01~t44, `BUDGET_ITEMS` b01~b27, `TALKS` m1~m17. 저장된 체크·메모·금액이 ID에 묶여 있어요. 새 항목은 새 ID로 추가하세요.
- 입력칸(input, textarea, select)에는 고유한 `data-fk`를 붙이세요. 화면을 다시 그릴 때 입력 중인 칸의 커서를 지키는 데 써요.
- 색은 `:root`의 CSS 변수로만 쓰고, 다크 모드와 휴대폰 안전 영역 처리를 유지하세요.
- 알아둘 것 탭의 제도 내용은 2026년 10월 6일 기준이에요(`BASIS`). 지역별 비용 표는 한국소비자원 2025년 4월~2026년 2월 발표값이에요(`REGION_COST`). 내용을 고치면 기준 날짜도 같이 고치세요.

## 데이터 단위

- 예산 금액: 만원 / 식대 1인 금액: 원 / 축의금: 만원
- 날짜: `YYYY-MM-DD` / 예식 시간: `HH:MM`, 10분 단위, 9~19시

## 수정본을 claude.ai 앱에 반영하기

Claude에게 저장소 주소와 함께 "이 저장소의 index.html로 결혼 준비 D-day 아티팩트 업데이트해 줘"라고 하면 돼요. 공개 저장소여야 Claude가 바로 가져올 수 있어요.

## 개발 시험

앱은 계속 `index.html` 한 파일로 실행돼요. Node.js와 Playwright는 개발 시험에만 써요.

```sh
npm ci
npx playwright install chromium
npm test
```

시험은 `tests/sandbox.html`의 `sandbox="allow-scripts allow-same-origin"` iframe에서 실행해요. 폼 제출 권한은 없어요. 폭 320·360·390·430px, 라이트·다크를 검사해요.

시스템 Chromium이 `/usr/bin/chromium`에 있으면 자동으로 사용해요. 다른 경로는 `PLAYWRIGHT_CHROMIUM_EXECUTABLE`로 지정할 수 있어요. 시험은 Google Fonts 요청을 빈 스타일로 대체하고 시스템 한글 글꼴을 사용해요. 실제 claude.ai 데이터베이스와 글꼴 제공사 연결을 확인하는 시험은 아니에요.

전후 화면을 다시 찍으려면 한 터미널에서 `node tests/server.cjs`를 실행하고, 다른 터미널에서 아래 명령을 실행해요. `before`는 `main`의 원본 HTML을 사용해요.

```sh
npm run screenshots -- before
npm run screenshots -- after
```

[UI 개선 결과와 전후 화면](docs/UI-REVIEW.md)을 볼 수 있어요.

## GPT와 Claude가 같이 고치는 방법

이 저장소의 `main`에 있는 `index.html`이 원본이에요. 두 AI 모두 여기서 시작하고, 규칙은 [AGENTS.md](AGENTS.md)에 있어요.

1. **GPT(Codex)에게 시킬 때**: Codex에서 이 저장소를 고르고 "AGENTS.md 규칙대로 ○○ 해 줘"라고 하면 돼요. 작업이 끝나면 PR이 올라오고, 확인한 뒤 병합하면 돼요.
2. **Claude에게 시킬 때**: claude.ai 대화에서 저장소 주소와 함께 요청하세요. Claude가 최신 `main`을 가져와 고친 `index.html`을 주면, GitHub 웹에서 그 파일을 올리면 돼요.
3. **앱에 반영할 때**: 병합한 뒤 Claude에게 "깃허브 최신으로 앱 업데이트해 줘"라고 하면, Claude가 검사하고 같은 앱 링크에 반영해요.
4. 한 번에 한 AI만 고치세요. 한 작업이 병합된 뒤 다음 작업을 시작해야 서로 덮어쓰지 않아요.

바뀐 내용은 [docs/CHANGELOG.md](docs/CHANGELOG.md)에 적어요.

