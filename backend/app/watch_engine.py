"""감시 상태 전환·알림·예약 승인. 모든 경로는 명시적으로 제한한다."""
import json
from datetime import datetime, timedelta
from uuid import uuid4
from sqlmodel import Session, select

from app.llm import extract_condition
from app.models import ChatEvent, EventRow, KST, SeatOption, SeenSeat, WatchCondition, WatchRow, WatchState
from app.rail.base import RailAuthError, RailBlockedError, SeatGoneError
from app.rail.mock import MockRailClient

ALLOWED: dict[WatchState, set[WatchState]] = {
    WatchState.pending_input: {WatchState.watching, WatchState.ended},
    WatchState.watching: {WatchState.awaiting_approval, WatchState.paused, WatchState.ended},
    WatchState.awaiting_approval: {WatchState.reserving, WatchState.watching, WatchState.paused, WatchState.ended},
    WatchState.reserving: {WatchState.secured, WatchState.watching, WatchState.paused, WatchState.ended},
    WatchState.paused: {WatchState.watching, WatchState.ended},
    WatchState.secured: set(),
    WatchState.ended: set(),
}


class InvalidTransition(ValueError):
    pass


def transition(current: WatchState, target: WatchState, *, approved: bool = False) -> WatchState:
    if target not in ALLOWED[current] or (target == WatchState.reserving and not approved):
        raise InvalidTransition(f"허용되지 않은 상태 전환: {current.value} → {target.value}")
    return target


def aware(dt: datetime) -> datetime:
    return dt.replace(tzinfo=KST) if dt.tzinfo is None else dt.astimezone(KST)


def event(session: Session, watch_id: str, kind: str, text: str, payload: dict | None = None,
          when: datetime | None = None) -> ChatEvent:
    at = aware(when or datetime.now(KST))
    record = ChatEvent(id=str(uuid4()), kind=kind, text=text, at=at, payload=payload)
    session.add(EventRow(id=record.id, watch_id=watch_id, kind=kind, text=text,
                         payload_json=json.dumps(payload, ensure_ascii=False, default=str) if payload else None,
                         at=at))
    return record


def list_events(session: Session, watch_id: str) -> list[ChatEvent]:
    rows = session.exec(select(EventRow).where(EventRow.watch_id == watch_id).order_by(EventRow.at, EventRow.id)).all()
    return [ChatEvent(id=r.id, kind=r.kind, text=r.text, at=aware(r.at),
                      payload=json.loads(r.payload_json) if r.payload_json else None) for r in rows]


def seat_key(option: SeatOption) -> str:
    return f"{option.train_no}|{option.car}|{option.seat}"


class WatchEngine:
    def __init__(self, engine, *, extractor=extract_condition):
        self.db = engine
        self.extractor = extractor
        self.clients: dict[str, MockRailClient] = {}

    def _get(self, session: Session, watch_id: str) -> WatchRow:
        watch = session.get(WatchRow, watch_id)
        if watch is None:
            raise KeyError("감시를 찾을 수 없어요")
        return watch

    def get(self, watch_id: str) -> dict:
        with Session(self.db) as session:
            watch = self._get(session, watch_id)
            return {"id": watch.id, "state": watch.state,
                    "condition": json.loads(watch.condition_json) if watch.condition_json else None,
                    "search_count": watch.search_count,
                    "events": [x.model_dump(mode="json") for x in list_events(session, watch_id)]}

    def create(self, text: str, scenario: str = "normal") -> dict:
        if scenario not in ("normal", "gone", "auth", "blocked", "aisle", "failure"):
            raise ValueError("지원하지 않는 시나리오")
        with Session(self.db) as session:
            watch = WatchRow(id=str(uuid4()), state=WatchState.pending_input.value,
                             original_request=text, scenario=scenario)
            session.add(watch)
            event(session, watch.id, "user", text)
            result = self.extractor(text)
            if isinstance(result, list):
                event(session, watch.id, "bot", " ".join(result))
            else:
                watch.condition_json = result.model_dump_json()
                watch.state = transition(WatchState.pending_input, WatchState.watching).value
                event(session, watch.id, "bot_condition",
                      "이 조건으로 취소표를 지켜볼게요. 창가가 없으면 선호 조건과 다른 점도 알려드릴게요.",
                      result.model_dump(mode="json"))
            session.commit()
            return self.get(watch.id)

    def message(self, watch_id: str, text: str) -> dict:
        with Session(self.db) as session:
            watch = self._get(session, watch_id)
            event(session, watch.id, "user", text)
            if "그만" in text or "취소" in text:
                if WatchState(watch.state) not in (WatchState.secured, WatchState.ended):
                    watch.state = transition(WatchState(watch.state), WatchState.ended).value
                    event(session, watch.id, "bot", "감시를 종료했어요.")
            elif watch.state == WatchState.pending_input.value:
                result = self.extractor(watch.original_request + " " + text)
                if isinstance(result, list):
                    event(session, watch.id, "bot", " ".join(result))
                else:
                    watch.condition_json = result.model_dump_json()
                    watch.state = transition(WatchState.pending_input, WatchState.watching).value
                    event(session, watch.id, "bot_condition", "조건이 확인됐어요. 감시를 시작할게요.", result.model_dump(mode="json"))
            elif watch.state == WatchState.awaiting_approval.value and text.strip() in {"예매", "응 잡아", "승인", "잡아줘"}:
                session.commit()
                return self.approve(watch_id)
            elif watch.state == WatchState.awaiting_approval.value and text.strip() in {"패스", "넘겨", "괜찮아"}:
                session.commit()
                return self.skip(watch_id)
            elif watch.state == WatchState.paused.value:
                event(session, watch.id, "bot", "현재 감시가 일시정지되어 있어요. 관리자가 연결 상태를 확인해야 해요.")
            else:
                event(session, watch.id, "bot", "감시 중이에요. 중지하려면 '그만'이라고 입력해 주세요.")
            session.commit()
        return self.get(watch_id)

    def _client(self, watch: WatchRow) -> MockRailClient:
        if watch.id not in self.clients:
            self.clients[watch.id] = MockRailClient(watch.scenario, watch.search_count)
        return self.clients[watch.id]

    def tick(self, watch_id: str, *, now: datetime | None = None) -> dict:
        now = aware(now or datetime.now(KST))
        with Session(self.db) as session:
            watch = self._get(session, watch_id)
            if watch.state not in (WatchState.watching.value, WatchState.awaiting_approval.value):
                return self.get(watch_id)
            cond = WatchCondition.model_validate_json(watch.condition_json)
            if now >= cond.deadline:
                watch.state = transition(WatchState(watch.state), WatchState.ended).value
                watch.candidate_json = None
                event(session, watch.id, "bot", "출발 1시간 전이라 감시를 마쳤어요. 같은 시간대 SRT도 볼까요?")
            elif watch.state == WatchState.awaiting_approval.value and watch.approval_expires and now >= aware(watch.approval_expires):
                watch.state = transition(WatchState.awaiting_approval, WatchState.watching).value
                watch.candidate_json = None
                event(session, watch.id, "bot", "답이 없어서 이 자리는 넘겼어요. 계속 지켜볼게요.")
            else:
                try:
                    options = self._client(watch).search(cond)
                    watch.search_count += 1
                    watch.failures = 0
                    if watch.state == WatchState.awaiting_approval.value:
                        previous = SeatOption.model_validate_json(watch.candidate_json)
                        if seat_key(previous) not in {seat_key(x) for x in options}:
                            watch.state = transition(WatchState.awaiting_approval, WatchState.watching).value
                            watch.candidate_json = None
                            event(session, watch.id, "bot", "방금 그 자리는 다른 분이 먼저 가져갔어요. 계속 지켜볼게요.")
                    else:
                        seen = {row.seat_key for row in session.exec(select(SeenSeat).where(SeenSeat.watch_id == watch.id)).all()}
                        for option in options:
                            if seat_key(option) in seen or not self._matches(cond, option):
                                continue
                            watch.state = transition(WatchState.watching, WatchState.awaiting_approval).value
                            watch.candidate_json = option.model_dump_json()
                            watch.approval_expires = now + timedelta(minutes=5)
                            session.add(SeenSeat(id=str(uuid4()), watch_id=watch.id, seat_key=seat_key(option)))
                            mismatched = [x for x in cond.preferences if x not in option.features]
                            explanation = ("선호하신 " + ", ".join(mismatched) + " 좌석은 아니지만 조건에 맞는 표예요. "
                                           if mismatched else "")
                            event(session, watch.id, "alert", "🚄 취소표가 나왔어요! " + explanation + "지금 예매할까요?",
                                  option.model_dump(mode="json"))
                            break
                except RailAuthError:
                    watch.state = transition(WatchState(watch.state), WatchState.paused).value
                    event(session, watch.id, "bot", "로그인이 풀렸어요. 다시 로그인해 주시면 바로 이어서 볼게요.")
                except RailBlockedError:
                    watch.state = transition(WatchState(watch.state), WatchState.paused).value
                    event(session, watch.id, "bot", "조회가 막혔어요. 잠시 쉬었다가 직접 확인해 주세요.")
                except Exception:
                    watch.failures += 1
                    if watch.failures >= 3:
                        watch.state = transition(WatchState(watch.state), WatchState.paused).value
                        event(session, watch.id, "bot", "조회 오류가 반복되어 감시를 잠시 멈췄어요.")
            session.add(watch)
            session.commit()
        return self.get(watch_id)

    def _matches(self, cond: WatchCondition, option: SeatOption) -> bool:
        return (cond.operator in ("ANY", option.operator)
                and option.depart_at.date() == cond.date
                and cond.earliest <= option.depart_at.time().replace(tzinfo=None) <= cond.latest
                and all(x in option.features for x in cond.must_have))

    def approve(self, watch_id: str) -> dict:
        with Session(self.db) as session:
            watch = self._get(session, watch_id)
            if watch.state != WatchState.awaiting_approval.value:
                raise InvalidTransition("승인 대기 중인 좌석이 없습니다")
            if watch.approval_expires and datetime.now(KST) >= aware(watch.approval_expires):
                watch.state = transition(WatchState.awaiting_approval, WatchState.watching).value
                watch.candidate_json = None
                event(session, watch.id, "bot", "승인 시간이 지나서 계속 감시할게요.")
                session.commit()
                return self.get(watch_id)
            watch.state = transition(WatchState.awaiting_approval, WatchState.reserving, approved=True).value
            option = SeatOption.model_validate_json(watch.candidate_json)
            try:
                reserved = self._client(watch).reserve(option)
                watch.state = transition(WatchState.reserving, WatchState.secured).value
                event(session, watch.id, "success", "✅ 좌석을 확보했어요. 결제 기한 안에 앱에서 결제하면 끝나요. 감시는 종료했어요.",
                      reserved.model_dump(mode="json"))
            except SeatGoneError:
                watch.state = transition(WatchState.reserving, WatchState.watching).value
                event(session, watch.id, "bot", "방금 그 자리는 다른 분이 먼저 가져갔어요. 계속 지켜볼게요.")
            except (RailAuthError, RailBlockedError):
                watch.state = transition(WatchState.reserving, WatchState.paused).value
                event(session, watch.id, "bot", "연결 상태가 바뀌어 감시를 잠시 멈췄어요.")
            watch.candidate_json = None
            session.commit()
        return self.get(watch_id)

    def skip(self, watch_id: str) -> dict:
        with Session(self.db) as session:
            watch = self._get(session, watch_id)
            watch.state = transition(WatchState(watch.state), WatchState.watching).value
            watch.candidate_json = None
            event(session, watch.id, "bot", "이번 좌석은 넘겼어요. 다른 취소표를 계속 찾아볼게요.")
            session.commit()
        return self.get(watch_id)

    def cancel(self, watch_id: str) -> dict:
        with Session(self.db) as session:
            watch = self._get(session, watch_id)
            watch.state = transition(WatchState(watch.state), WatchState.ended).value
            event(session, watch.id, "bot", "감시를 종료했어요.")
            session.commit()
        return self.get(watch_id)

    def tick_all(self) -> None:
        with Session(self.db) as session:
            ids = [row.id for row in session.exec(select(WatchRow).where(WatchRow.state.in_([
                WatchState.watching.value, WatchState.awaiting_approval.value]))).all()]
        for watch_id in ids:
            self.tick(watch_id)
