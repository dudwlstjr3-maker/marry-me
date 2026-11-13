# 가격 비교·예산 UI 전후 비교

- 기준: 최신 main `e05ed3c`, 변경 후: `design/price-budget-ui`.
- 390 × 844px, Chromium, 한국어, Asia/Seoul, 라이트·다크 각 15장. 전후 총 60장.
- `hero`, `timeline`, `budget`, `guest`, `know`는 기존 시험 데이터(준호·민지, 2027-05-08 12:30)를 사용한다. 첫 화면은 맨 위, 탭 화면은 탭 메뉴까지 스크롤해 촬영한다.
- 추가 화면은 `tests/app.spec.cjs`의 `PLAN_SEED`와 같은 비교안 두 개를 바탕으로 한 `priceBudgetSeed()`를 쓴다. 서울 강남 지역, 직접 금액과 참고 시세, 미입력 금액, 직접 추가 항목, 지운 항목을 함께 넣는다. 두 단계 모두 같은 시드를 사용한다.
- 예산 검토는 `budget.planGroup='pa'`로 비교안을 고르고 `apply`를 설정한 상태다. 대관료 초과, 식대 일치, 스드메 여유, 예산 미입력, 금액 미입력을 함께 보여 준다. 예산에 금액을 자동으로 덮어쓰는 조작은 하지 않는다.
- `price-plan`은 비교안 카드 위쪽, `price-tools`는 같은 비교안의 네 가지 접기 도구, `price-custom`은 직접 추가를 펼친 화면이다. `price-pick`은 대관료 담기 줄, `price-extra`는 꽃·부케 분류를 펼친 화면이다.
- `budget-plan`과 `budget-plan-rows`는 예산 검토 상단과 항목별 목록을 각각 보여 준다. `quote-confirm`은 기존 예산과 다른 견적을 넣기 전에 나타나는 확인 상태다. `backup`은 공유 창을 열고 백업 칸으로 스크롤한 상태다.
- 고정 시각은 2026-10-06 12:00 KST. Google Fonts 요청은 기존 시험 도우미가 비워 오프라인 대체 명조·고딕으로 촬영한다. 실제 앱의 Google Fonts Hahmlet·IBM Plex Sans KR 설정은 유지한다.
- 꽃잎 움직임은 촬영 시 비활성화한다. 동작 줄이기 설정과 애니메이션 속성은 별도 시험으로 확인한다.
- 재현: `node tests/server.cjs` 실행 후 `npm run screenshots -- before`, `npm run screenshots -- after`. `before`는 작업 파일 대신 `git show main:index.html`을 사용한다.

| 화면 | 라이트 전 | 라이트 후 | 다크 전 | 다크 후 |
| --- | --- | --- | --- | --- |
| 첫 화면 | [전](before-light-hero.png) | [후](after-light-hero.png) | [전](before-dark-hero.png) | [후](after-dark-hero.png) |
| 진행 순서 | [전](before-light-timeline.png) | [후](after-light-timeline.png) | [전](before-dark-timeline.png) | [후](after-dark-timeline.png) |
| 예산 | [전](before-light-budget.png) | [후](after-light-budget.png) | [전](before-dark-budget.png) | [후](after-dark-budget.png) |
| 하객 | [전](before-light-guest.png) | [후](after-light-guest.png) | [전](before-dark-guest.png) | [후](after-dark-guest.png) |
| 알아둘 것 | [전](before-light-know.png) | [후](after-light-know.png) | [전](before-dark-know.png) | [후](after-dark-know.png) |
| 비교안 카드: 제목·입력·요약 | [전](before-light-price-plan.png) | [후](after-light-price-plan.png) | [전](before-dark-price-plan.png) | [후](after-dark-price-plan.png) |
| 비교안: 담긴 항목·직접 추가·나란히 보기·지운 항목 | [전](before-light-price-tools.png) | [후](after-light-price-tools.png) | [전](before-dark-price-tools.png) | [후](after-dark-price-tools.png) |
| 가격표에 없는 항목 직접 추가 | [전](before-light-price-custom.png) | [후](after-light-price-custom.png) | [전](before-dark-price-custom.png) | [후](after-dark-price-custom.png) |
| 가격표 항목 담기·직접 금액·참고 시세 | [전](before-light-price-pick.png) | [후](after-light-price-pick.png) | [전](before-dark-price-pick.png) | [후](after-dark-price-pick.png) |
| 그 밖에 드는 비용: 꽃·부케 | [전](before-light-price-extra.png) | [후](after-light-price-extra.png) | [전](before-dark-price-extra.png) | [후](after-dark-price-extra.png) |
| 비교안으로 예산 검토: 선택·합계 | [전](before-light-budget-plan.png) | [후](after-light-budget-plan.png) | [전](before-dark-budget-plan.png) | [후](after-dark-budget-plan.png) |
| 비교안으로 예산 검토: 항목별 금액·상태 | [전](before-light-budget-plan-rows.png) | [후](after-light-budget-plan-rows.png) | [전](before-dark-budget-plan-rows.png) | [후](after-dark-budget-plan-rows.png) |
| 예산 요약·축의금을 뺀 실제 부담 | [전](before-light-budget-net.png) | [후](after-light-budget-net.png) | [전](before-dark-budget-net.png) | [후](after-dark-budget-net.png) |
| 식장 견적: 예산 바꾸기 확인 | [전](before-light-quote-confirm.png) | [후](after-light-quote-confirm.png) | [전](before-dark-quote-confirm.png) | [후](after-dark-quote-confirm.png) |
| 공유 창: 데이터 백업·옮기기 | [전](before-light-backup.png) | [후](after-light-backup.png) | [전](before-dark-backup.png) | [후](after-dark-backup.png) |
