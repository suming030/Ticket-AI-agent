# 🚄 Ticket AI Agent — RailSense

> 매진된 기차의 취소표를 기다리는 시간을 AI에게 맡기는 **대학 과제용 1단계 Mock 프로토타입**.

## 화면과 기능
- **서비스 소개 / AI 에이전트 / 데모 체험 / 버전 비교**: 버튼 클릭으로 화면 전환 (스크롤식 랜딩 페이지가 아님)
- 반응형 채팅 프레임, 말풍선 6종, 라이트·다크 모드
- 가상 조건 인식 및 5초 간격 Mock 조회: 3회째 취소표 등장
- 예매 승인·패스·취소 / 로그인 만료·차단·좌석 소멸 시나리오
- 7개 메시지 데모 자동 재생 / reduced-motion 즉시 완료
- FastAPI·SQLite·SSE 백엔드 로컬 모드
- GitHub Pages에서는 브라우저 Mock만 동작하며 **실제 예약/결제·서버 백엔드 없음**

## 로컬 실행
Python 3.12, Node.js 20 이상, uv, npm이 필요합니다.

```bash
cd backend
uv sync --python 3.12
uv run uvicorn app.main:app --reload
```

별도 터미널에서:
```bash
cd frontend
npm install
npm run dev
```

주소는 `http://localhost:5173/Ticket-AI-agent/` 입니다.

테스트:
```bash
cd backend && uv run pytest
cd frontend && npm run build && npm run test
```

## 보안 및 서비스 범위
- 실제 KTX/SRT 요청이 이루어지지 않습니다. `RealRailClient`는 NotImplementedError만 발생시킵니다.
- `MOCK_ONLY`가 기본이며 결제 관련 API나 UI는 없습니다.
- Claude 연결을 원하면 로컬 환경변수로 `CLAUDE_API_KEY`를 지정합니다. 키가 없으면 명시적인 규칙 기반 오프라인 시연 파서가 동작합니다.
- `.env`, 데이터베이스 파일, 토큰은 Git 저장소에 포함하지 않습니다.
- 모든 예약 승인은 사용자의 명시적인 버튼 클릭 또는 승인 메시지가 있어야 합니다.

## 아직 끝나지 않은 부분
- 사용자가 추후 제공할 `reference/chat.png`에 맞춘 최종 디자인 정합성 검사
- 설치/테스트 실행 결과 검증 (로컬 환경에 패키지 다운로드 권한 필요)
- 2단계 실제 조회 및 3단계 실제 예약 (별도 사용자 승인 필요)
- GitHub Pages 공개 배포 (1단계 검증·승인 후 진행)
