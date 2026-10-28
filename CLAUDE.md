# Claude용 안내

이 저장소의 작업 규칙은 [AGENTS.md](AGENTS.md)를 그대로 따른다.

- claude.ai 대화의 Claude: 사용자가 저장소 주소를 주면 `main`의 최신 `index.html`을 가져와 작업하고, 검사를 통과하면 claude.ai 아티팩트(같은 링크)에 반영한다.
- Claude Code: GitHub 작업은 사용자가 '팀으로'라고 하지 않아도 항상 팀으로 한다. 메인 세션이 [docs/TEAM.md](docs/TEAM.md)의 '언제 팀으로 하나'와 '흐름'대로 `.claude/agents/`의 vow-* 팀원을 조율하고, 브랜치 → `npm test` → PR(AGENTS.md 작업 흐름)은 `vow-build`가 한다. 사용자에게는 TEAM.md '사용자에게 보고' 형식으로 보고한다. 열린 PR 예약 점검과 자동 병합은 TEAM.md '대응팀'을 따른다.
