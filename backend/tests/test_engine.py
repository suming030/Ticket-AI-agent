from datetime import datetime, timedelta
from app.models import KST, WatchState, WatchCondition
from app.watch_engine import InvalidTransition, transition
from app.llm import offline_extract, extract_condition
from app.scheduler import polling_interval_seconds, jitter_seconds
import pytest

NOW = datetime(2026, 11, 5, 18, tzinfo=KST)


def create(client, scenario="normal"):
    response = client.post('/api/watches', json={"text": "11월 6일 금요일 저녁에 부산에서 서울 가는 KTX 잡아줘. 6시~8시 사이, 1명. 창가면 좋고.", "scenario": scenario})
    assert response.status_code == 200, response.text
    return response.json()['id']


def test_condition_parsing_and_questions():
    result = offline_extract("11월 6일 금요일 저녁에 부산에서 서울 가는 KTX 잡아줘. 6시~8시 사이, 1명. 창가면 좋고.", today=NOW.date())
    assert isinstance(result, WatchCondition)
    assert result.date.isoformat() == "2026-11-06"
    assert result.from_station == "부산" and result.to_station == "서울"
    assert result.earliest.hour == 18 and result.latest.hour == 20
    assert result.preferences == ["창가"] and result.deadline.hour == 17
    assert isinstance(offline_extract("이번 주말쯤 부산 가는 거", today=NOW.date()), list)


def test_approved_only_transition():
    with pytest.raises(InvalidTransition):
        transition(WatchState.watching, WatchState.reserving)
    with pytest.raises(InvalidTransition):
        transition(WatchState.awaiting_approval, WatchState.reserving)
    assert transition(WatchState.awaiting_approval, WatchState.reserving, approved=True) == WatchState.reserving


def test_3rd_poll_alert_and_approve(client, app):
    watch_id = create(client)
    svc = app.state.watch_engine
    with pytest.raises(InvalidTransition):
        svc.approve(watch_id)
    for _ in range(2):
        assert svc.tick(watch_id, now=NOW)['state'] == 'watching'
    found = svc.tick(watch_id, now=NOW)
    assert found['state'] == 'awaiting_approval'
    assert len([x for x in found['events'] if x['kind'] == 'alert']) == 1
    assert svc.clients[watch_id].reserve_count == 0
    response = client.post(f'/api/watches/{watch_id}/approve')
    assert response.status_code == 200
    assert response.json()['state'] == 'secured'
    assert svc.clients[watch_id].reserve_count == 1
    assert any(x['kind'] == 'success' for x in response.json()['events'])
    assert client.get(f'/api/watches/{watch_id}').json()['state'] == 'secured'


def test_skip_prevents_repeat_alert(client, app):
    watch_id = create(client)
    svc = app.state.watch_engine
    for _ in range(3): svc.tick(watch_id, now=NOW)
    assert client.post(f'/api/watches/{watch_id}/skip').json()['state'] == 'watching'
    svc.tick(watch_id, now=NOW)
    assert len([x for x in svc.get(watch_id)['events'] if x['kind'] == 'alert']) == 1


def test_gone_at_approval(client, app):
    watch_id = create(client, 'gone')
    svc = app.state.watch_engine
    for _ in range(3): svc.tick(watch_id, now=NOW)
    state = svc.approve(watch_id)
    assert state['state'] == 'watching'
    assert any('다른 분이 먼저' in x['text'] for x in state['events'])


@pytest.mark.parametrize('scenario,message',[('auth','로그인이 풀렸어요'),('blocked','조회가 막혔어요')])
def test_immediate_pause(client, app, scenario, message):
    wid = create(client, scenario)
    svc = app.state.watch_engine
    for _ in range(3): state = svc.tick(wid, now=NOW)
    assert state['state'] == 'paused'
    assert any(message in e['text'] for e in state['events'])


def test_three_failures_pause(client, app):
    wid = create(client, 'failure')
    for _ in range(3): state=app.state.watch_engine.tick(wid, now=NOW)
    assert state['state'] == 'paused'


def test_approval_timeout(client, app):
    wid=create(client)
    for _ in range(3): app.state.watch_engine.tick(wid, now=NOW)
    state=app.state.watch_engine.tick(wid, now=NOW + timedelta(minutes=6))
    assert state['state'] == 'watching'


def test_deadline_ends(client, app):
    wid=create(client)
    state=app.state.watch_engine.tick(wid, now=datetime(2026,11,6,17,tzinfo=KST))
    assert state['state'] == 'ended'


def test_recover_events_after_refresh(client, app):
    wid=create(client)
    app.state.watch_engine.tick(wid, now=NOW)
    first=client.get(f'/api/watches/{wid}').json()
    second=client.get(f'/api/watches/{wid}').json()
    assert first['events'] == second['events']


def test_timing_guards():
    assert polling_interval_seconds(mock=True,departure=NOW) == 5
    assert polling_interval_seconds(mock=False,departure=NOW+timedelta(hours=20),now=NOW) == 120
    assert polling_interval_seconds(mock=False,departure=NOW+timedelta(hours=30),now=NOW) == 300
    assert jitter_seconds(mock=True) == 0


def test_llm_schema_validation_3_attempts():
    calls=[]
    def broken(system, text):
        calls.append((system,text))
        return '{"operator":"INVALID"}'
    result=extract_condition('test',today=NOW.date(),completion=broken)
    assert len(calls) == 3 and isinstance(result, list)
    assert '2026-11-05' in calls[0][0]


def test_no_real_requests():
    from app.rail.real import RealRailClient
    with pytest.raises(NotImplementedError):
        RealRailClient().search(None)
