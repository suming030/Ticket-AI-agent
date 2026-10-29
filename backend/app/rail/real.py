"""2단계 전까지는 절대 사용하지 않는 실제 연동 인터페이스의 자리.

실제 사이트 URL·인증 요청 코드는 1단계에 포함하지 않는다.
"""
from app.models import WatchCondition, SeatOption, Reservation


class RealRailClient:
    def search(self, cond: WatchCondition) -> list[SeatOption]:
        raise NotImplementedError("2단계 승인 전에는 실제 조회를 사용할 수 없습니다.")

    def reserve(self, option: SeatOption) -> Reservation:
        raise NotImplementedError("3단계 승인 전에는 실제 예약을 사용할 수 없습니다.")
