"""외부 전송은 1단계에서 사용하지 않는다. 이후 명시적 승인 필요."""
from app.models import ChatEvent


def notify_local(event: ChatEvent) -> None:
    """SSE는 데이터베이스 이벤트를 폴링하므로 별도 전송 불필요."""
    _ = event
