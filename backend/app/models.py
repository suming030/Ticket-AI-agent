"""전역 API/DB 타입. 날짜·시간은 반드시 Asia/Seoul timezone-aware."""
from datetime import date, datetime, time
from enum import StrEnum
from typing import Any, Literal
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field, field_validator, model_validator
from sqlmodel import SQLModel, Field as SQLField

KST = ZoneInfo("Asia/Seoul")


class WatchState(StrEnum):
    pending_input = "pending_input"
    watching = "watching"
    awaiting_approval = "awaiting_approval"
    reserving = "reserving"
    secured = "secured"
    paused = "paused"
    ended = "ended"


class WatchCondition(BaseModel):
    operator: Literal["KTX", "SRT", "ANY"] = "ANY"
    from_station: str
    to_station: str
    date: date
    earliest: time
    latest: time
    adults: int = Field(default=1, ge=0)
    children: int = Field(default=0, ge=0)
    seat_class: Literal["general", "first", "any"] = "general"
    must_have: list[str] = Field(default_factory=list)
    preferences: list[str] = Field(default_factory=list)
    deadline: datetime
    missing: list[str] = Field(default_factory=list)

    @field_validator("deadline")
    @classmethod
    def check_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("deadline must have timezone")
        return value.astimezone(KST)

    @model_validator(mode="after")
    def validate_interval(self):
        if self.adults + self.children < 1:
            raise ValueError("passenger count must be >= 1")
        if self.earliest >= self.latest:
            raise ValueError("earliest must be before latest")
        return self


class SeatOption(BaseModel):
    train_no: str
    operator: str
    depart_at: datetime
    arrive_at: datetime
    car: str
    seat: str
    features: list[str] = Field(default_factory=list)
    price: int = Field(ge=0)

    @field_validator("depart_at", "arrive_at")
    @classmethod
    def aware(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("train time must have timezone")
        return value.astimezone(KST)


class Reservation(BaseModel):
    reservation_id_last4: str
    option: SeatOption
    pay_deadline: datetime

    @field_validator("pay_deadline")
    @classmethod
    def aware(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("payment deadline must have timezone")
        return value.astimezone(KST)


class ChatEvent(BaseModel):
    id: str
    kind: Literal["user", "bot", "bot_condition", "alert", "success", "notice"]
    text: str
    at: datetime
    payload: dict[str, Any] | None = None

    @field_validator("at")
    @classmethod
    def aware(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("event time must have timezone")
        return value.astimezone(KST)


class WatchRow(SQLModel, table=True):
    id: str = SQLField(primary_key=True)
    state: str = "pending_input"
    original_request: str
    condition_json: str | None = None
    scenario: str = "normal"
    search_count: int = 0
    failures: int = 0
    candidate_json: str | None = None
    approval_expires: datetime | None = None
    created_at: datetime = SQLField(default_factory=lambda: datetime.now(KST))


class EventRow(SQLModel, table=True):
    id: str = SQLField(primary_key=True)
    watch_id: str = SQLField(index=True)
    kind: str
    text: str
    payload_json: str | None = None
    at: datetime = SQLField(default_factory=lambda: datetime.now(KST))


class SeenSeat(SQLModel, table=True):
    id: str = SQLField(primary_key=True)
    watch_id: str = SQLField(index=True)
    seat_key: str
