# AGENTS.md — 취소표 에이전트 프로젝트 지침

> 코딩 에이전트는 모든 작업을 시작하기 전에 이 파일을 읽는다. 사람이 관리한다. 에이전트는 「기억해 둘 결정」에 추가를 **제안**만 하고 직접 고치지 않는다.

## 1. 프로젝트 목적
매진된 기차의 취소표를 감시하다가 조건에 맞는 좌석이 나오면 채팅으로 알리고, 사용자가 승인하면 좌석을 예약(결제 전 단계)까지 해 주는 개인용 AI 에이전트. 사용자는 채팅으로 요청하고 결제는 직접 한다.

## 2. 기술 스택 (임의로 바꾸지 말 것)
| 영역 | 사용 기술 |
|---|---|
| 프론트엔드 | Vite + React 18 + TypeScript (strict) + Tailwind CSS v4 |
| 백엔드 | Python 3.12 + FastAPI + Pydantic v2 |
| 감시 스케줄러 | APScheduler (백엔드 프로세스 안에서 실행) |
| 실시간 전달 | SSE (Server-Sent Events) |
| 저장소 | SQLite (SQLModel) |
| LLM | Claude API (조건 추출·알림 문장·애매한 판단에만 사용) |
| 푸시 알림 (선택) | 텔레그램 봇 |
| 테스트 | 백엔드 pytest, 프론트·E2E Playwright |
| 패키지 관리 | 백엔드 uv, 프론트 npm |

목록에 없는 패키지가 필요하면 이유와 대안을 적어 먼저 승인받는다. 사용자가 2026-10-29에 공식 보조 패키지(@vitejs/plugin-react, @tailwindcss/vite, @playwright/test, uvicorn, httpx 등) 사용을 승인했다.

## 3. 폴더 구조
```
/
├─ AGENTS.md
├─ SPEC.md
├─ PROMPTS.md
├─ WORKLOG.md
├─ reference/     # 캡처 이미지: 읽기 전용
├─ backend/
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ models.py
│  │  ├─ watch_engine.py
│  │  ├─ scheduler.py
│  │  ├─ llm.py
│  │  ├─ notify.py
│  │  └─ rail/
│  │     ├─ base.py
│  │     ├─ mock.py
│  │     └─ real.py
│  └─ tests/
└─ frontend/
   ├─ src/components/
   ├─ src/data/
   ├─ src/lib/
   └─ tests/
```

## 4. 코드 규칙
- 화면 문구는 한국어. 시간대는 항상 `Asia/Seoul`. 날짜 계산은 timezone-aware 객체.
- 컴포넌트 하나는 한 역할만. 색·글꼴·간격은 CSS 변수 토큰, 컴포넌트에 #hex 직접 작성 금지.
- 라이트/다크, 375px 가로 스크롤 방지, 키보드·포커스 접근성, reduced-motion 지원.
- LLM 응답 Pydantic 검증, 실패 시 최대 2번 재시도 후 질문.
- 반복 조회에는 LLM 사용 금지. 조회·비교는 일반 코드만.

## 5. 작업 범위와 권한
### 승인 없이 허용
프로젝트 폴더 안 파일 읽기·만들기·고치기, 테스트·빌드·린트, 모든 MockRailClient 실행.
### 승인 후에만
파일 삭제·폴더 이동, 추가 패키지 설치, RealRailClient 이용 실행, 외부 메시지 전송, git push와 외부 배포.
### 절대 금지
결제·카드 저장, 보안문자 자동 해결, 차단 회피(IP·헤더 위장·다중 계정), 실제 조회 주기 60초 미만, 코드·로그·WORKLOG에 비밀번호·토큰 기록, 프로젝트 폴더 밖 접근.

## 6. 실제 서비스 연동
- 실제 서버 요청은 `backend/app/rail/real.py`에서만, 테스트는 Mock만. 실제 요청 테스트는 실패 처리.
- 오픈소스 실제 연동 라이브러리는 업데이트·이슈·라이선스 조사 후 승인.
- 비정상 응답(차단·보안문자·세션 만료·형식 변경)은 즉시 paused.
- 로그에는 계정·예약번호 전체를 남기지 않고 뒤 4자리만 사용.

## 7. 일하는 방식
1. 작업 전 계획 제시, 승인받기.
2. 작은 단계로 나눠 각 단계에서 테스트.
3. 같은 오류 세 번 수정해도 실패하면 중단 보고.
4. SPEC에 없는 결정은 질문.
5. 체크리스트 검토 후 결과 보고.

## 8. 완료 정의
- `uv run pytest`, `npm run build`, `npm run test` 모두 통과.
- 해당 SPEC 단계의 확인 기준 충족.
- `WORKLOG.md`에 작업 기록.

## 9. 작업 기록 형식
```
## YYYY-MM-DD HH:MM · 단계 이름
- 읽은 파일:
- 바꾼 파일:
- 실행한 명령 → 결과 (성공/실패, 오류 요약):
- 판단과 이유:
- 남은 문제:
```

## 10. 기억해 둘 결정 (사람이 확인 후 추가)
- (예) 데모 모드에서는 조회 주기를 5초로 쓴다. 실제 모드 최소값은 60초.
