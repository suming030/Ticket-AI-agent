"""실제/가상 열차 인터페이스: 다른 곳에서 철도 서버를 호출하지 않는다."""
from typing import Protocol
from app.models import Reservation, SeatOption, WatchCondition


class RailBlockedError(Exception):
    """보안문자·서버 차단 — 즉시 일시정지."""


class RailAuthError(Exception):
    """로그인 만료 — 즉시 일시정지."""


class SeatGoneError(Exception):
    """승인 시점에 좌석이 없거나 사라짐."""


class RailClient(Protocol):
    def search(self, cond: WatchCondition) -> list[SeatOption]: ...
    def reserve(self, option: SeatOption) -> Reservation: ...
