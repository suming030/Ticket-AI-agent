from datetime import date, datetime, time, timedelta
import pytest
from fastapi.testclient import TestClient
from app.main import create_app
from app.models import KST, WatchCondition


def fixed_extract(_: str) -> WatchCondition:
    dt = date(2026, 11, 6)
    return WatchCondition(operator="KTX", from_station="부산", to_station="서울", date=dt,
                          earliest=time(18), latest=time(20), adults=1, seat_class="general",
                          preferences=["창가"], deadline=datetime(2026, 11, 6, 17, tzinfo=KST))


@pytest.fixture
def app():
    return create_app(database_url="sqlite://", extractor=fixed_extract, enable_scheduler=False)


@pytest.fixture
def client(app):
    return TestClient(app)
