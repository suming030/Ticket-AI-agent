# SPEC.md — 취소표 에이전트

## 1. 한 줄 목표
사용자가 채팅으로 "언제, 어디서 어디로" 표를 요청하면 에이전트가 감시하다 취소표가 나오는 순간 알리고 승인을 받아 좌석을 예약한다. 결제는 사용자가 직접 한다.

## 2. 참고 자료
- `reference/chat.png`: 채팅 레이아웃·말풍선 형태·색 구분 참고. 캡처와 SPEC 충돌 시 **SPEC 우선**.
- 참고 캡처는 2026-10-29 현재 아직 제공되지 않아, 최종 시각 비교는 보류.

## 3. 단계별 범위
| 단계 | 내용 | 실제 서버 | 시작 조건 |
|---|---|---|---|
| 1 | 가짜 데이터로 전체 흐름 완성 | 사용 안 함 | 계획 승인 |
| 2 | 실제 좌석 조회만 연결 | 조회만 | 1단계 테스트 통과 + 사람 승인 |
| 3 | 실제 예약 연결 (결제 제외) | 조회+예약 | 2단계 확인 + 사람 승인 |

## 4. 사용자 흐름
1. 사용자 자연어 입력 → LLM 조건 JSON 추출, 모호하면 질문.
2. 조건 카드 표시, 감시 시작.
3. RailClient.search() 주기 조회.
4. 좌석 발견 시 alert 카드 및 (승인한 경우에만) 텔레그램 알림.
5. 사용자 예매 또는 패스 → 예매 시 RailClient.reserve() 호출.
6. 성공 카드와 결제 기한 안내, 감시 종료. 결제는 사용자 직접.

## 5. 감시 상태
| 상태 | 의미 | 표시 |
|---|---|---|
| `pending_input` | 조건 질문 중 | 회색 확인 중 |
| `watching` | 감시 중 | 초록 감시중 |
| `awaiting_approval` | 좌석 발견 후 승인 대기 | 호박 승인 대기 |
| `reserving` | 예약 요청 중 | 호박 예약 중 |
| `secured` | 좌석 확보 | 초록 확보 |
| `paused` | 비정상 응답 중단 | 호박 일시정지 |
| `ended` | 종료 시각/취소 | 회색 종료 |

명시적으로 허용한 전환만 가능. `awaiting_approval → reserving`은 사용자 승인 필수. 좌석 소멸 및 승인 대기 5분 초과 시 `watching` 복귀.

## 6. 데이터 타입
- `WatchCondition`: operator(KTX/SRT/ANY), from_station, to_station, date, earliest, latest, adults=1, children=0, seat_class(general/first/any), must_have, preferences, deadline, missing.
- `SeatOption`: train_no, operator, depart_at, arrive_at, car, seat, features, price.
- `Reservation`: reservation_id_last4, option, pay_deadline.
- `ChatEvent`: id, kind(user/bot/bot_condition/alert/success/notice), text, at, payload.
- `models.py`의 Pydantic 모델을 최종 필드 정의로 사용.

## 7. RailClient
`search(cond) -> list[SeatOption]`, `reserve(option) -> Reservation`.
예외: `RailBlockedError`, `RailAuthError`, `SeatGoneError`.
Mock에서 3회째 좌석 발견, 예약 성공과 좌석 소멸/로그인 만료/차단 시나리오를 재현. RealRailClient는 2단계 이후.

## 8. 조회 주기
- Mock 데모: 5초.
- 실제 모드: 출발 24시간 전까지 5분, 이후 2분. 최저 60초.
- 실제 모드에 조회마다 0~20초 무작위 지연 추가. 연속 실패 세 번이면 paused.

## 9. LLM 사용 범위
- 사용자 요청 → WatchCondition JSON.
- 선호 불일치 설명 → 한 문장.
- 글로 답한 승인 → approve/skip/unknown.
- 반복 조회에는 사용하지 않는다.

### 조건 추출 프롬프트 (`llm.py`)
```
너는 기차 취소표 감시 조건을 만드는 도우미야.
사용자 요청을 WatchCondition JSON 으로만 출력해. 설명은 붙이지 마.

규칙:
- 날짜·시간이 모호하면("이번 주말", "저녁") 추측하지 말고 missing 에 질문을 넣어.
- "~면 좋고", "가능하면"은 preferences, "꼭", "아니면 안 돼"는 must_have.
- deadline 을 말하지 않으면 출발 1시간 전으로 둬.
- 운영사를 말하지 않으면 operator 는 "ANY".
- 오늘은 {today}, 시간대는 Asia/Seoul.
```

## 10. API
| 메서드 | 경로 | 역할 |
|---|---|---|
| POST | `/api/watches` | 조건 추출·감시 등록 |
| POST | `/api/watches/{id}/messages` | 추가 질문 답변, 텍스트 승인 |
| GET | `/api/watches/{id}/events` | SSE 이벤트 |
| POST | `/api/watches/{id}/approve` | 예매 승인 |
| POST | `/api/watches/{id}/skip` | 패스 |
| POST | `/api/watches/{id}/cancel` | 감시 취소 |
| GET | `/api/watches/{id}` | 상태 및 대화 |

같은 열차 번호+호차+좌석은 한 감시 중 1회만 알림. 모든 이벤트 DB 저장.

## 11. 화면 명세
- 중앙 정렬 흰 카드, 둥근 모서리 24px, 최대 너비 420px, 모바일 전체 폭.
- 상단 왼쪽 취소표 에이전트, 오른쪽 상태 점 + 상태 이름.
- user: 오른쪽 진한 파랑/흰 글씨/우측 하단 각진 말풍선.
- bot: 왼쪽 연회색/좌측 하단 각진 말풍선.
- bot_condition: bot 안에 흰 카드·고정폭 조건.
- alert: 호박색 배경·테두리·열차정보·예매·패스.
- success: 초록색 배경·테두리·✅ 시작.
- notice: 중앙 작은 회색 글씨.
- 타임스탬프 `10.29 21:29` 고정폭, 약 85% 최대 말풍선 폭, 자동 스크롤.
- [예매]/[패스] 누른 후 선택 표시·두 버튼 비활성화.
- 한 줄 입력창·Enter 전송·Shift+Enter 줄바꿈·감시 중 안내·전송 중 입력 점 표시.
- 발표 데모: 상단 [▶ 데모 재생], 1.2초 간격, `src/data/demoScenario.ts`, 첫 화면에 전체 대화 표시, 재생시 0개→7개.

### 발표 데모 메시지 (7개)
1. user 10.29 21:29 "11월 6일 금요일 저녁에 부산에서 서울 가는 KTX 잡아줘. 6시~8시 사이, 1명. 창가면 좋고."
2. bot_condition 10.29 21:30 매진·감시 시작, 부산→서울/2026-11-06/18:00~20:00/일반실 1명/창가 선호/11.06 17:00 종료.
3. notice "· · · 6일 뒤" (4번 앞)
4. bot 11.05 09:00 아직 자리 없음, 2분 간격 안내.
5. alert 11.05 17:41 KTX 19:00 부산→서울 21:41/일반실 7호차 12A 창가/59,800원/예매 여부.
6. user 11.05 17:42 "예매"
7. success 11.05 17:42 좌석 확보, 결제 직접 진행, 감시 종료.

### 오류 안내
- 좌석 소멸 `watching`: "방금 그 자리는 다른 분이 먼저 가져갔어요. 계속 지켜볼게요."
- 선호 불일치 `awaiting_approval`: "19:30 열차에 자리가 났는데 창가가 아니라 통로석이에요. 예매할까요?"
- 로그인 만료 `paused`: "로그인이 풀렸어요. 다시 로그인해 주시면 바로 이어서 볼게요."
- 차단 `paused`: "조회가 막혔어요. 잠시 쉬었다가 직접 확인해 주세요."
- 종료 `ended`: "출발 1시간 전이라 감시를 마쳤어요. 같은 시간대 SRT도 볼까요?"
- 승인 5분 초과 `watching`: "답이 없어서 이 자리는 넘겼어요. 계속 지켜볼게요."

### 색·폰트
`--rail`, `--signal`, `--ok`, `--surface`, `--bubble`, `--ink`, `--muted` 등 CSS 토큰. 다크 모드 대비 보장. IBM Plex Sans KR / IBM Plex Mono (Google Fonts).

## 12. 확인 기준
### 1단계
- 구체적 자연어 요청 → 명시한 JSON, 모호한 요청 → missing 및 질문.
- Mock 세 번째 조회 alert, 예매→secured 및 종료, 패스→감시 지속/중복 방지.
- 승인 없는 reserve 경로 0건, 예외 시 상태 및 메시지.
- 새로고침 이후 대화 유지, 데모 0→7/1.2초 간격·reduced-motion 즉시 표시.
- 375px 가로 스크롤 0건, 다크 모드 가독성, 실서버 요청 0건.
### 2단계
승인된 실제 좌석 조회 1회, 최소 60초, 비정상 응답 시 즉시 paused.
### 3단계
명시적 예매 승인 후에만 예약 요청, 결제 기한 안내, 결제 요청 없음.

## 13. 범위 밖
결제·카드정보, 다중 사용자 회원가입·계정, 1단계 기능 검증 범위의 서버 배포.

## 부가 UX 승인 사항 (2026-10-29)
기존과 달리 긴 스크롤 중심이 아니라 **버튼으로 홈 / 에이전트 / 데모 / 비교 화면 전환**. 이는 사용자가 직접 요청한 화면 동작이다. 최종 캡처 참고 시 디자인만 재조정한다.
