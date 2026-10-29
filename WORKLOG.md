# WORKLOG.md — 작업 기록

## 2026-10-29 22:00 · 1단계 Mock 구현 (진행 중)
- 읽은 파일: 사용자가 대화에서 제공한 AGENTS.md, SPEC.md, PROMPTS.md. `reference/chat.png`는 미제공.
- 바꾼 파일: AGENTS.md, SPEC.md, PROMPTS.md, WORKLOG.md, .gitignore, .env.example, README.md, reference/README.md, backend/app/*, backend/tests/*, frontend/src/*, frontend/tests/* 및 설정 파일.
- 실행한 명령 → 결과:
  - `python -m compileall -q backend/app backend/tests` → 성공 (구문 검사).
  - `uv python install 3.12` → 실패 (외부 DNS/네트워크 차단으로 Python 3.12 다운로드 불가).
  - `npm ci --offline` → 실패 (package-lock.json 없음, clean install 사용 불가).
  - `npm install --offline` → 실패 (Playwright npm 패키지 로컬 캐시 없음).
  - `uv sync --python 3.13 --offline` → 실패 (apscheduler 패키지 로컬 캐시 없음; Python 3.13은 지정 스택과 달라 3.12 실행으로 인정하지 않음).
- 판단과 이유: 1단계는 Mock만 구현. 공개 GitHub Pages는 FastAPI를 실행할 수 없어 브라우저 Mock 경로를 따로 제공. 이전 랜딩페이지와 달리 버튼 기반 화면 전환을 구현.
- 남은 문제: Python 3.12/패키지 설치 환경 확보, 백엔드·프론트 실제 테스트, 최종 사용자 제공 캡처 비교, 외부 배포 승인.

## 기억해 둘 결정 제안 (AGENTS.md 직접 수정하지 않음)
- 사용자 승인 사항: 버튼 기반 홈/에이전트/데모/버전 비교 화면 전환.
- 추가 제안: GitHub Pages 배포는 브라우저 Mock 전용으로 분리하고 API 백엔드는 로컬 전용으로 유지한다.
