"""Mock 전용 FastAPI + SQLite + 서버 전송 이벤트."""
import asyncio
import json
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, create_engine

from app.watch_engine import InvalidTransition, WatchEngine
from app.scheduler import make_scheduler


def create_app(*, database_url: str | None = None, extractor=None, enable_scheduler: bool = True) -> FastAPI:
    url = database_url or os.environ.get("DATABASE_URL", "sqlite:///./ticket_agent.db")
    engine = create_engine(url, connect_args={"check_same_thread": False},
                           poolclass=StaticPool if url == "sqlite://" else None)
    SQLModel.metadata.create_all(engine)
    svc = WatchEngine(engine, **({"extractor": extractor} if extractor else {}))

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        scheduler = make_scheduler(svc.tick_all) if enable_scheduler else None
        if scheduler:
            scheduler.start()
        yield
        if scheduler:
            scheduler.shutdown(wait=False)

    app = FastAPI(title="취소표 에이전트 (가상 데이터)", lifespan=lifespan)
    app.state.watch_engine = svc
    app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                       allow_credentials=True, allow_methods=["GET", "POST"], allow_headers=["*"])

    class CreateWatch(BaseModel):
        text: str = Field(min_length=1)
        scenario: str = "normal"

    class Message(BaseModel):
        text: str = Field(min_length=1)

    def handle(action):
        try:
            return action()
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except (InvalidTransition, ValueError) as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    @app.post("/api/watches")
    def create(body: CreateWatch):
        return handle(lambda: svc.create(body.text, body.scenario))

    @app.post("/api/watches/{watch_id}/messages")
    def reply(watch_id: str, body: Message):
        return handle(lambda: svc.message(watch_id, body.text))

    @app.get("/api/watches/{watch_id}")
    def get(watch_id: str):
        return handle(lambda: svc.get(watch_id))

    @app.post("/api/watches/{watch_id}/approve")
    def approve(watch_id: str):
        return handle(lambda: svc.approve(watch_id))

    @app.post("/api/watches/{watch_id}/skip")
    def skip(watch_id: str):
        return handle(lambda: svc.skip(watch_id))

    @app.post("/api/watches/{watch_id}/cancel")
    def cancel(watch_id: str):
        return handle(lambda: svc.cancel(watch_id))

    @app.get("/api/watches/{watch_id}/events")
    async def events(watch_id: str):
        handle(lambda: svc.get(watch_id))

        async def stream():
            sent: set[str] = set()
            while True:
                snapshot = svc.get(watch_id)
                new_events = [event for event in snapshot["events"] if event["id"] not in sent]
                for event in new_events:
                    sent.add(event["id"])
                    yield f"id: {event['id']}\nevent: chat\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"
                yield ": keep-alive\n\n"
                await asyncio.sleep(1)

        return StreamingResponse(stream(), media_type="text/event-stream",
                                 headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

    return app


app = create_app()
