"""백엔드 프로세스 안에서 5초 Mock 스케줄 실행."""
import random
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.models import KST


def polling_interval_seconds(*, mock: bool, departure: datetime, now: datetime | None = None) -> int:
    if mock:
        return 5
    now = now or datetime.now(KST)
    return max(60, 120 if departure - now <= __import__('datetime').timedelta(hours=24) else 300)


def jitter_seconds(*, mock: bool) -> int:
    return 0 if mock else random.randint(0, 20)


def make_scheduler(tick):
    scheduler = AsyncIOScheduler(timezone=str(KST))
    scheduler.add_job(tick, "interval", seconds=5, max_instances=1,
                      id="mock-watch-tick", coalesce=True, replace_existing=True)
    return scheduler
