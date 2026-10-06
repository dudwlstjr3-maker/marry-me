# 작업 규칙 (GPT·Codex·Claude 공통)

이 저장소를 고치는 AI는 모두 이 규칙을 따른다. 사람용 설명은 README.md에 있다.

## 프로젝트

- `index.html` 한 파일짜리 결혼 준비 앱(HTML·CSS·순수 JS). 빌드 도구 없음.
- 실제 사용처는 claude.ai 아티팩트(보안이 걸린 iframe). 아티팩트 반영은 Claude가 claude.ai 대화에서 한다. 이 저장소에서는 하지 않는다.

## 작업 흐름

1. 항상 최신 `main`에서 새 브랜치를 만든다(예: `feat/guest-export`, `fix/budget-total`).
2. 수정한 뒤 `npm test`를 모두 통과시킨다.
3. `main`에 직접 푸시하지 말고 PR을 만든다. 병합은 사용자가 한다.
4. 새 기능을 넣으면 `tests/app.spec.cjs`에 그 기능의 시험도 추가한다.
5. PR 본문 순서: 결과(바꾼 것) → 검증(시험 결과) → 가정 → 남은 문제. 서두와 요약은 쓰지 않는다.

## 절대 지킬 것 (시험이 대부분 자동으로 검사한다)

1. `<form>`과 submit 금지. 저장은 `<button type="button">` 클릭 핸들러, 엔터는 keydown으로 처리한다.
2. 외부 리소스: 스크립트는 cdnjs.cloudflare.com, cdn.jsdelivr.net/npm, code.jquery.com만, 스타일은 fonts.googleapis.com만. 외부 이미지·다른 사이트 요청 금지. 새 라이브러리는 넣지 않는다.
3. 저장 계층(`defaultBody`부터 `ui state` 직전까지: Store, commit, flush, init)은 바꾸지 않는다. 데이터는 객체로만(배열 금지), 삭제는 `deleted: true` 표시로 한다.
4. 고정 ID는 바꾸거나 지우지 않는다: TASKS t01~t44, BUDGET_ITEMS b01~b27, TALKS m1~m17. 새 항목은 새 ID로.
5. 모든 input·textarea·select에 고유한 `data-fk`와 label 또는 aria-label을 붙인다.
6. 누르는 영역은 44px 이상, 글자 대비는 4.5:1 이상. 색은 `:root` CSS 변수로만 쓰고 다크 모드를 유지한다.
7. 법·제도·통계·날짜 같은 사실 내용(`BASIS`, `knowHTML`)은 작업 요청에 있을 때만 고친다. 그때는 `ALLOW_CONTENT_CHANGE=1 npm test`로 시험하고, PR에 바꾼 사실과 출처, 기준일을 적는다.
8. `ARTIFACT_URL`(claude.ai 앱 링크)은 바꾸지 않는다.

## 시험 실행

```sh
npm ci
npx playwright install chromium   # 이미 설치된 Chromium을 쓰려면 PLAYWRIGHT_CHROMIUM_EXECUTABLE=경로
npm test
```

시험은 `tests/sandbox.html`의 보안 iframe(`allow-scripts allow-same-origin`, 폼 제출 불가)에서, 폭 320·360·390·430px × 라이트·다크로 돈다. 기준 비교 시험은 `git show main:index.html`을 쓰므로 git 저장소 안에서 실행한다.

## 하지 말 것

- 요청 없는 새 기능, 탭 구조 변경, 저장 방식 변경, 프레임워크·빌드 도입.
- 범위 밖 버그 수정. 발견하면 PR의 '남은 문제'에 적기만 한다.
