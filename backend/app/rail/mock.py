"""외부 네트워크 요청이 전혀 없는 결정적 시나리오 기반 RailClient."""
from datetime import datetime, timedelta
from typing import Literal
from app.models import KST, Reservation, SeatOption, WatchCondition
from app.rail.base import RailAuthError, RailBlockedError, SeatGoneError

Scenario = Literal["normal", "gone", "auth", "blocked", "aisle", "failure"]


class MockRailClient:
    def __init__(self, scenario: Scenario = "normal", initial_searches: int = 0):
        self.scenario = scenario
        self.search_count = initial_searches
        self.reserve_count = 0

    def search(self, cond: WatchCondition) -> list[SeatOption]:
        self.search_count += 1
        if self.scenario == "auth" and self.search_count >= 3:
            raise RailAuthError("mock auth expired")
        if self.scenario == "blocked" and self.search_count >= 3:
            raise RailBlockedError("mock challenge")
        if self.scenario == "failure":
            raise RuntimeError("mock transient failure")
        if self.search_count < 3:
            return []
        if self.scenario == "gone" and self.search_count > 3:
            return []
        departure = datetime.combine(cond.date, datetime.min.time(), tzinfo=KST).replace(hour=19, minute=0)
        if not (cond.earliest <= departure.time() <= cond.latest):
            departure = datetime.combine(cond.date, cond.earliest, tzinfo=KST)
        return [SeatOption(
            train_no="KTX 121", operator="KTX", depart_at=departure,
            arrive_at=departure + timedelta(hours=2, minutes=41),
            car="7", seat="12A" if self.scenario != "aisle" else "12B",
            features=["창가"] if self.scenario != "aisle" else ["통로"],
            price=59800,
        )]

    def reserve(self, option: SeatOption) -> Reservation:
        self.reserve_count += 1
        if self.scenario == "gone":
            raise SeatGoneError("mock seat no longer available")
        return Reservation(reservation_id_last4="4821", option=option,
                           pay_deadline=datetime.now(KST) + timedelta(minutes=15))
