# 저장소 설정 (marry-me)

공통 팀 문서([TEAM.md](TEAM.md)와 `.claude/agents/vow-*.md`)가 가리키는 이 저장소만의 값이다. 공통 파일은 모든 저장소에서 같고, 이 문서만 저장소마다 다르다(TEAM.md '여러 저장소'). 저장소 규칙([AGENTS.md](../AGENTS.md))이 이 문서보다 우선한다.

## 저장소

- `dudwlstjr3-maker/marry-me`. 공통 파일 8개의 원본이다(TEAM.md '여러 저장소').
- 소유자 계정: `dudwlstjr3-maker`.

## 팀 도입 PR

- PR #6(작업 팀 만들기). 사용자가 이 PR을 병합한 것을 자동 병합 승인으로 본다(TEAM.md 공통 규칙 6).
- 자동 병합은 이 PR이 병합된 뒤에 열린 PR만 대상이다(TEAM.md 자동 병합 조건 1). 그 전에 열린 PR은 사용자가 병합한다.

## 배포

- main에 병합하면 GitHub Pages로 공개 배포된다.

## 시험 파일

- `tests/app.spec.cjs`. 새 기능을 넣으면 그 기능의 시험을 여기에 더한다(AGENTS.md 작업 흐름 4).

## 화면 확인

- `node tests/server.cjs`를 띄우고 `tests/helpers.cjs`의 `openApp`으로 연다.
- `npm run screenshots`는 `docs/screenshots`를 덮어쓰므로 쓰지 않는다.

## 사실 내용

- 있는 곳: `index.html`의 `BASIS`(기준일), `knowHTML`(정보, 가격표), `REGION_COST`(지역 시세), 그 밖의 가격·시세.
- 바꿀 때는 `ALLOW_CONTENT_CHANGE=1 npm test`로 시험하고, PR에 바꾼 사실과 출처, 기준일을 적는다(AGENTS.md 절대 지킬 것 7).

## 추가 확인

vow-judge 확인 목록에 더하는 이 저장소의 항목이다.

- 새 저장 키·ID가 객체 저장과 `deleted: true` 규칙을 지키고, 이전 저장 형식을 읽는가.
- `main`과 비교하는 시험(`git show main:`)이 이 PR이 병합된 뒤의 `main`에서도 통과하는가. (PR #3: 병합 뒤 `main`에서 내용 보존 시험이 실패해 Pages 배포가 멈췄다.)

## 자동 병합 저장소 조건

TEAM.md '자동 병합 조건' 2·3에 들어가는 이 저장소의 값이다. 번호는 그 조건의 번호다.

2. 바뀐 파일이 모두 다음 안에 있다: `index.html`, `tests/app.spec.cjs`, `README.md`, `docs/CHANGELOG.md`, `docs/UI-REVIEW.md`, `docs/screenshots/`. 그 밖의 파일(AGENTS.md, CLAUDE.md, 이 문서, `.claude/`, `.github/`, package 파일, tests의 다른 파일, 실행 파일 등)이 바뀌면 사용자가 병합한다.
3. `index.html`의 다음 구간이 main과 글자 그대로 같다:
   - `var BASIS =`~`function esc(`: 사실, 고정 ID, 지역 시세, 탭 목록
   - `function knowHTML(){`~`function num(`: 정보, 가격표
   - `function defaultBody()`~`/* ---------------- ui state`: 저장 계층
   - `var ARTIFACT_URL` 줄

   외부 주소(`<script src`, `<link href`)도 새로 생기지 않았다. 표시 글자가 main에 없으면 이 조건은 실패로 본다.

## 진행 상황

- 2026-10-28 기준 PR #4(10-08)와 #5(10-13)가 열려 있고 #5는 #4 위에 쌓였다.
