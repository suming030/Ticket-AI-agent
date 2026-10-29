"""유일한 Claude API 호출 위치. API 키 미설정이면 명확한 오프라인 데모 파서 사용."""
import json
import os
import re
from datetime import date, datetime, time, timedelta
from typing import Callable
from zoneinfo import ZoneInfo

from app.models import KST, WatchCondition

EXTRACTION_PROMPT = """너는 기차 취소표 감시 조건을 만드는 도우미야.
사용자 요청을 WatchCondition JSON 으로만 출력해. 설명은 붙이지 마.

규칙:
- 날짜·시간이 모호하면("이번 주말", "저녁") 추측하지 말고 missing 에 질문을 넣어.
- "~면 좋고", "가능하면"은 preferences, "꼭", "아니면 안 돼"는 must_have.
- deadline 을 말하지 않으면 출발 1시간 전으로 둬.
- 운영사를 말하지 않으면 operator 는 "ANY".
- 오늘은 {today}, 시간대는 Asia/Seoul.
"""

STATIONS = ("서울", "부산", "대전", "대구", "동대구", "광명", "수원", "울산", "천안아산", "동탄", "수서", "익산", "목포", "포항", "여수EXPO", "오송")


def offline_extract(message: str, today: date | None = None) -> WatchCondition | list[str]:
    """API 키가 없는 시연에 한정된 규칙 기반 파서. LLM인 척하지 않는다."""
    today = today or datetime.now(KST).date()
    missing: list[str] = []
    m = re.search(r"(?:(\d{4})[년.\-/ ]+)?(\d{1,2})월\s*(\d{1,2})일", message)
    if m:
        try:
            year = int(m[1]) if m[1] else today.year
            day = date(year, int(m[2]), int(m[3]))
            if not m[1] and day < today:
                day = date(year + 1, int(m[2]), int(m[3]))
        except ValueError:
            day = today
            missing.append("출발 날짜를 정확하게 알려주세요.")
    else:
        day = today
        missing.append("기차를 이용할 정확한 날짜를 알려주세요.")
    departures = re.search(r"(\d{1,2})시\s*[~∼\-부터 ]+\s*(\d{1,2})시", message)
    if departures:
        earliest_h, latest_h = int(departures[1]), int(departures[2])
        if ("저녁" in message or "오후" in message) and earliest_h < 12:
            earliest_h += 12
            if latest_h < 12:
                latest_h += 12
        if not (0 <= earliest_h < latest_h <= 23):
            missing.append("출발 희망 시간을 정확하게 알려주세요.")
            earliest_h, latest_h = 18, 20
    else:
        earliest_h, latest_h = 18, 20
        missing.append("희망 출발 시간을 알려주세요. 예: 18시~20시")
    found = sorted([(message.find(s), s) for s in STATIONS if s in message], key=lambda v: v[0])
    if len(found) < 2:
        missing.append("출발역과 도착역을 모두 알려주세요.")
        origin, destination = "미정", "미정"
    else:
        origin, destination = found[0][1], found[1][1]
    count_match = re.search(r"(\d+)명", message)
    adults = int(count_match[1]) if count_match else 1
    preference = ["창가"] if ("창가면" in message or "창가면 좋" in message or "창가 가능" in message) else []
    must = ["창가"] if ("창가 꼭" in message or "꼭 창가" in message) else []
    operator = "KTX" if "KTX" in message.upper() else "SRT" if "SRT" in message.upper() else "ANY"
    departure = datetime.combine(day, time(earliest_h), tzinfo=KST)
    cond = WatchCondition(operator=operator, from_station=origin, to_station=destination,
                          date=day, earliest=time(earliest_h), latest=time(latest_h),
                          adults=adults, preferences=preference, must_have=must,
                          deadline=departure - timedelta(hours=1), missing=missing)
    return cond if not missing else missing


def extract_condition(message: str, *, today: date | None = None,
                      completion: Callable[[str, str], str] | None = None) -> WatchCondition | list[str]:
    """응답 스키마 검증, 최초 시도 + 재시도 2번. 실패하면 질문으로 복귀."""
    today = today or datetime.now(KST).date()
    if completion is None and not os.environ.get("CLAUDE_API_KEY"):
        return offline_extract(message, today)
    if completion is None:
        def completion(system: str, user: str) -> str:
            import httpx
            response = httpx.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": os.environ["CLAUDE_API_KEY"], "anthropic-version": "2023-06-01"},
                json={"model": os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-5"),
                      "max_tokens": 950, "system": system,
                      "messages": [{"role": "user", "content": user}]}, timeout=15,
            )
            response.raise_for_status()
            return response.json()["content"][0]["text"]
    prompt = EXTRACTION_PROMPT.format(today=today.isoformat())
    for _ in range(3):
        try:
            raw = completion(prompt, message)
            data = json.loads(raw)
            cond = WatchCondition.model_validate(data)
            return cond if not cond.missing else cond.missing
        except Exception:
            # API 오류·스키마 불일치 등의 세부 정보에 토큰이 포함될 수 있으므로 출력하지 않는다.
            continue
    return ["날짜, 출발역, 도착역, 희망 시간대를 다시 알려주세요."]
