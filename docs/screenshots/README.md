# v24 디자인 전후 비교

- 기준: 최신 main `8f253f3`, 변경 후: `design/wedding-ceremony`.
- 390 × 844px, Chromium, 한국어, Asia/Seoul, 라이트·다크 각 5장(총 20장).
- `hero`: 첫 화면. `timeline`, `budget`, `guest`, `know`: 해당 탭을 선택하고 탭 메뉴까지 스크롤한 화면.
- 동일한 시험 데이터(준호·민지, 2027-05-08 12:30)와 고정 시각(2026-10-06 12:00 KST)을 사용해 D-day와 내용이 동일하다.
- Google Fonts 요청은 기존 시험 도우미가 비워 오프라인 대체 명조·고딕으로 촬영한다. 실제 앱의 Google Fonts Hahmlet·IBM Plex Sans KR 설정은 유지한다.
- 꽃잎 움직임은 촬영 시 비활성화한다. 동작 줄이기 설정과 애니메이션 속성은 별도 시험으로 확인한다.
- 재현: `node tests/server.cjs` 실행 후 `npm run screenshots -- before`, `npm run screenshots -- after`.

| 화면 | 라이트 전 | 라이트 후 | 다크 전 | 다크 후 |
| --- | --- | --- | --- | --- |
| 첫 화면 | [전](before-light-hero.png) | [후](after-light-hero.png) | [전](before-dark-hero.png) | [후](after-dark-hero.png) |
| 진행 순서 | [전](before-light-timeline.png) | [후](after-light-timeline.png) | [전](before-dark-timeline.png) | [후](after-dark-timeline.png) |
| 예산 | [전](before-light-budget.png) | [후](after-light-budget.png) | [전](before-dark-budget.png) | [후](after-dark-budget.png) |
| 하객 | [전](before-light-guest.png) | [후](after-light-guest.png) | [전](before-dark-guest.png) | [후](after-dark-guest.png) |
| 알아둘 것 | [전](before-light-know.png) | [후](after-light-know.png) | [전](before-dark-know.png) | [후](after-dark-know.png) |
