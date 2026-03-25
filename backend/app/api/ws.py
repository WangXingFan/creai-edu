"""WebSocket handler for real-time debate streaming."""
import asyncio
import json
import logging
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select, update

from app.db.database import async_session
from app.graph.debate_graph import get_runtime_agent_configs, run_debate
from app.models.debate import Debate, DebateStatus
from app.tools.runner import DEMO_MODE

logger = logging.getLogger(__name__)
router = APIRouter()

# Replay timing: per-event-type delay in seconds to mimic real-time streaming
_REPLAY_DELAYS: dict[str, float] = {
    "debate_start": 0.3,
    "search_start": 0.2,
    "search_token": 0.02,
    "search_complete": 0.3,
    "round_start": 0.4,
    "scheduler_decision": 0.2,
    "task_assigned": 0.15,
    "tool_call": 0.2,
    "tool_result": 0.3,
    "evidence_posted": 0.1,
    "agent_start": 0.15,
    "agent_token": 0.025,
    "agent_complete": 0.3,
    "agent_error": 0.2,
    "action_emitted": 0.1,
    "score_update": 0.15,
    "round_summary_start": 0.2,
    "round_summary": 0.4,
    "judge_decision": 0.3,
    "convergence": 0.2,
    "final_report_start": 0.3,
    "state_update": 0.0,
    "debate_complete": 0.0,
}
_REPLAY_DEFAULT_DELAY = 0.1


def _build_complete_event_payload(
    events: list[dict[str, Any]] | None,
    *,
    fallback_report: dict[str, Any] | None = None,
    fallback_final_scores: dict[str, Any] | None = None,
    fallback_action_trace: list[dict[str, Any]] | None = None,
    fallback_evidence_board: list[dict[str, Any]] | None = None,
    fallback_agent_states: dict[str, Any] | None = None,
    fallback_halt_reason: str | None = None,
    fallback_step_count: int = 0,
    fallback_current_round: int = 0,
) -> dict[str, Any]:
    event_list = events if isinstance(events, list) else []
    complete_evt = next(
        (event for event in reversed(event_list) if event.get("type") == "debate_complete"),
        None,
    )
    final_report_evt = next(
        (event for event in reversed(event_list) if event.get("type") == "final_report"),
        None,
    )

    report = {}
    if isinstance(complete_evt, dict) and isinstance(complete_evt.get("report"), dict):
        report = complete_evt["report"]
    elif isinstance(final_report_evt, dict) and isinstance(final_report_evt.get("report"), dict):
        report = final_report_evt["report"]
    elif isinstance(fallback_report, dict):
        report = fallback_report

    final_scores = {}
    if isinstance(complete_evt, dict) and isinstance(complete_evt.get("final_scores"), dict):
        final_scores = complete_evt["final_scores"]
    elif isinstance(fallback_final_scores, dict):
        final_scores = fallback_final_scores

    action_trace = []
    if isinstance(complete_evt, dict) and isinstance(complete_evt.get("action_trace"), list):
        action_trace = complete_evt["action_trace"]
    elif isinstance(fallback_action_trace, list):
        action_trace = fallback_action_trace

    evidence_board = []
    if isinstance(complete_evt, dict) and isinstance(complete_evt.get("evidence_board"), list):
        evidence_board = complete_evt["evidence_board"]
    elif isinstance(fallback_evidence_board, list):
        evidence_board = fallback_evidence_board

    agent_states = {}
    if isinstance(complete_evt, dict) and isinstance(complete_evt.get("agent_states"), dict):
        agent_states = complete_evt["agent_states"]
    elif isinstance(fallback_agent_states, dict):
        agent_states = fallback_agent_states

    halt_reason = fallback_halt_reason
    if isinstance(complete_evt, dict) and "halt_reason" in complete_evt:
        halt_reason = complete_evt.get("halt_reason")

    step_count = fallback_step_count
    if isinstance(complete_evt, dict) and isinstance(complete_evt.get("step_count"), int):
        step_count = complete_evt["step_count"]

    current_round = fallback_current_round
    if isinstance(complete_evt, dict) and isinstance(complete_evt.get("current_round"), int):
        current_round = complete_evt["current_round"]

    return {
        "type": "debate_complete",
        "report": report,
        "final_scores": final_scores,
        "action_trace": action_trace,
        "evidence_board": evidence_board,
        "agent_states": agent_states,
        "halt_reason": halt_reason,
        "step_count": step_count,
        "current_round": current_round,
    }


class ConnectionManager:
    """Manage active WebSocket connections per debate."""

    def __init__(self):
        self.active: dict[str, list[WebSocket]] = {}
        self._lock = asyncio.Lock()
        self.background_tasks: dict[str, asyncio.Task[Any]] = {}
        self.event_history: dict[str, list[dict[str, Any]]] = {}
        self.latest_state: dict[str, dict[str, Any]] = {}

    async def connect(self, debate_id: str, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            self.active.setdefault(debate_id, []).append(ws)

    async def disconnect(self, debate_id: str, ws: WebSocket):
        async with self._lock:
            if debate_id in self.active and ws in self.active[debate_id]:
                self.active[debate_id].remove(ws)
                if not self.active[debate_id]:
                    del self.active[debate_id]

    def register_background_task(self, debate_id: str, task: asyncio.Task[Any]):
        """Keep a strong reference to active debate tasks and log task failures."""
        self.background_tasks[debate_id] = task

        def _cleanup(completed_task: asyncio.Task[Any]) -> None:
            self.background_tasks.pop(debate_id, None)
            if completed_task.cancelled():
                logger.warning("Debate task %s was cancelled", debate_id)
                return

            exc = completed_task.exception()
            if exc:
                logger.error(
                    "Debate task %s crashed: %s",
                    debate_id,
                    exc,
                    exc_info=(type(exc), exc, exc.__traceback__),
                )

        task.add_done_callback(_cleanup)

    def record_event(self, debate_id: str, message: dict[str, Any]):
        """Keep a lightweight in-memory replay log for reconnecting clients."""
        event_type = message.get("type")
        if event_type == "state_update":
            self.latest_state[debate_id] = message
            return
        if event_type in {"search_token", "agent_token", "runtime_config"}:
            return
        history = self.event_history.setdefault(debate_id, [])
        history.append(message)
        if len(history) > 300:
            del history[:-300]

    def get_replay_bundle(self, debate_id: str) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
        return list(self.event_history.get(debate_id, [])), self.latest_state.get(debate_id)

    def clear_runtime_cache(self, debate_id: str):
        self.event_history.pop(debate_id, None)
        self.latest_state.pop(debate_id, None)

    async def broadcast(self, debate_id: str, message: dict[str, Any]):
        """Send message to all connected clients for a debate."""
        data = json.dumps(message, ensure_ascii=False)
        async with self._lock:
            sockets = list(self.active.get(debate_id, []))
        if not sockets:
            return
        disconnected = []
        for ws in sockets:
            try:
                await ws.send_text(data)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            await self.disconnect(debate_id, ws)


manager = ConnectionManager()


async def _try_mark_debate_in_progress(session, debate_id: str) -> bool:
    """Atomically transition a debate from pending to in-progress once."""
    result = await session.execute(
        update(Debate)
        .where(
            Debate.id == debate_id,
            Debate.status == DebateStatus.PENDING,
        )
        .values(status=DebateStatus.IN_PROGRESS)
    )
    await session.commit()
    return bool(result.rowcount)


@router.websocket("/debate/{debate_id}")
async def debate_websocket(websocket: WebSocket, debate_id: str):
    """WebSocket endpoint for streaming debate progress."""
    await manager.connect(debate_id, websocket)

    try:
        # Verify debate exists
        async with async_session() as session:
            result = await session.execute(
                select(Debate).where(Debate.id == debate_id)
            )
            debate = result.scalar_one_or_none()
            if not debate:
                await websocket.send_json({"type": "error", "message": "Debate not found"})
                await websocket.close()
                return

            await websocket.send_json({
                "type": "runtime_config",
                "agent_configs": get_runtime_agent_configs(),
            })

            status = debate.status

            if status == DebateStatus.PENDING:
                # Atomically transition once to avoid starting the same debate twice.
                did_start = await _try_mark_debate_in_progress(session, debate_id)
                if did_start:
                    # Check for cached replay before running a real debate
                    cached_events = await _find_cached_debate(debate.idea)
                    if cached_events:
                        task = asyncio.create_task(
                            _replay_cached_events(debate_id, cached_events),
                            name=f"debate-replay-{debate_id}",
                        )
                    else:
                        task = asyncio.create_task(
                            _run_debate_with_streaming(debate_id, debate.idea, debate.max_rounds),
                            name=f"debate-run-{debate_id}",
                        )
                    manager.register_background_task(debate_id, task)
                else:
                    await session.refresh(debate)
                    status = debate.status

            if status == DebateStatus.COMPLETED:
                complete_payload = _build_complete_event_payload(
                    debate.event_cache if isinstance(debate.event_cache, list) else None,
                    fallback_report=debate.report or {},
                    fallback_final_scores=debate.final_scores or {},
                    fallback_action_trace=debate.action_trace or [],
                    fallback_evidence_board=debate.evidence_board or [],
                    fallback_agent_states=debate.agent_states or {},
                    fallback_halt_reason=debate.halt_reason,
                    fallback_step_count=debate.step_count or 0,
                    fallback_current_round=debate.current_round or 0,
                )

                if (
                    (not debate.report and complete_payload["report"])
                    or (not debate.final_scores and complete_payload["final_scores"])
                ):
                    debate.report = complete_payload["report"]
                    debate.final_scores = complete_payload["final_scores"]
                    debate.action_trace = complete_payload["action_trace"]
                    debate.evidence_board = complete_payload["evidence_board"]
                    debate.agent_states = complete_payload["agent_states"]
                    debate.halt_reason = complete_payload["halt_reason"]
                    debate.step_count = complete_payload["step_count"]
                    debate.current_round = complete_payload["current_round"]
                    await session.commit()

                await websocket.send_json(complete_payload)
            elif status == DebateStatus.FAILED:
                # Debate already failed, tell client and close
                await websocket.send_json({
                    "type": "error",
                    "message": "This debate has failed. Please start a new one.",
                })
                await websocket.close()
                return
            # If IN_PROGRESS, notify client that debate is already running
            elif status == DebateStatus.IN_PROGRESS:
                replay_events, latest_state = manager.get_replay_bundle(debate_id)
                if replay_events:
                    for event in replay_events:
                        await websocket.send_json(event)
                else:
                    await websocket.send_json({
                        "type": "debate_start",
                        "message": "Debate is in progress...",
                        "agent_configs": get_runtime_agent_configs(),
                    })
                if latest_state:
                    await websocket.send_json(latest_state)

        # Keep connection alive
        while True:
            try:
                data = await websocket.receive_text()
                msg = json.loads(data)
                if msg.get("type") == "stop":
                    break
            except WebSocketDisconnect:
                break
            except Exception:
                break

    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("WebSocket error for debate %s", debate_id)
    finally:
        await manager.disconnect(debate_id, websocket)


async def _run_debate_with_streaming(debate_id: str, idea: str, max_rounds: int):
    """Run the debate graph and stream events to connected clients."""
    try:
        runtime_configs = get_runtime_agent_configs()
        logger.info("Debate %s runtime agent configs: %s", debate_id, runtime_configs)

        start_event = {
            "type": "debate_start",
            "message": "Debate is starting...",
            "agent_configs": runtime_configs,
        }
        manager.record_event(debate_id, start_event)
        await manager.broadcast(debate_id, start_event)

        # Collect all events for cache recording
        recorded_events: list[dict[str, Any]] = [start_event]

        async def on_event(event: dict):
            recorded_events.append(event)
            manager.record_event(debate_id, event)
            await manager.broadcast(debate_id, event)

        result = await run_debate(idea, max_rounds, on_event)

        complete_event = {
            "type": "debate_complete",
            "report": result.get("report", {}),
            "final_scores": result.get("final_scores", {}),
            "action_trace": result.get("action_trace", []),
            "evidence_board": result.get("evidence_board", []),
            "agent_states": result.get("agent_states", {}),
            "halt_reason": result.get("halt_reason"),
            "step_count": result.get("step_count", 0),
            "current_round": result.get("current_round", 0),
        }
        cache_events = [*recorded_events, complete_event]

        # Save results to database
        async with async_session() as session:
            db_result = await session.execute(
                select(Debate).where(Debate.id == debate_id)
            )
            debate = db_result.scalar_one_or_none()
            if debate:
                debate.status = DebateStatus.COMPLETED
                debate.transcript = result.get("transcript", [])
                debate.final_scores = result.get("final_scores", {})
                debate.report = result.get("report", {})
                debate.agent_states = result.get("agent_states", {})
                debate.action_trace = result.get("action_trace", [])
                debate.evidence_board = result.get("evidence_board", [])
                debate.shared_blackboard = result.get("shared_blackboard", [])
                debate.halt_reason = result.get("halt_reason")
                debate.step_count = result.get("step_count", 0)
                debate.current_round = result.get("current_round", debate.current_round)
                debate.completed_at = datetime.now(UTC)
                # Always save raw event stream for potential future replay;
                # users control which debates are replayable via cache_enabled flag.
                if not DEMO_MODE:
                    debate.event_cache = cache_events
                await session.commit()
        manager.record_event(debate_id, complete_event)
        await manager.broadcast(debate_id, complete_event)
        manager.clear_runtime_cache(debate_id)

    except Exception:
        logger.exception("Debate %s failed", debate_id)
        async with async_session() as session:
            db_result = await session.execute(
                select(Debate).where(Debate.id == debate_id)
            )
            debate = db_result.scalar_one_or_none()
            if debate:
                debate.status = DebateStatus.FAILED
                await session.commit()

        error_event = {
            "type": "error",
            "message": "Debate failed due to an internal server error.",
        }
        manager.record_event(debate_id, error_event)
        await manager.broadcast(debate_id, error_event)
        manager.clear_runtime_cache(debate_id)


async def _find_cached_debate(idea: str) -> dict[str, Any] | None:
    """Find a user-enabled cached debate with a matching idea for replay."""
    async with async_session() as session:
        result = await session.execute(
            select(Debate)
            .where(
                Debate.status == DebateStatus.COMPLETED,
                Debate.cache_enabled.is_(True),
                Debate.event_cache.isnot(None),
            )
            .order_by(Debate.completed_at.desc())
        )
        for debate in result.scalars():
            if debate.idea and debate.idea.strip().lower() == idea.strip().lower():
                cache = debate.event_cache
                if isinstance(cache, list) and len(cache) > 0:
                    logger.info(
                        "Cache hit for idea '%.40s' from debate %s (%d events)",
                        idea, debate.id, len(cache),
                    )
                    return {
                        "source_debate_id": debate.id,
                        "events": cache,
                        "report": debate.report or {},
                        "final_scores": debate.final_scores or {},
                        "action_trace": debate.action_trace or [],
                        "evidence_board": debate.evidence_board or [],
                        "agent_states": debate.agent_states or {},
                        "halt_reason": debate.halt_reason,
                        "step_count": debate.step_count or 0,
                        "current_round": debate.current_round or 0,
                    }
    return None


async def _replay_cached_events(debate_id: str, replay_bundle: dict[str, Any]):
    """Replay a cached event stream with realistic timing delays.

    The front-end receives the same events as a real run, so it renders
    identically. Delays are tuned so the whole replay finishes in ~40-60s
    instead of ~10min, giving the audience a "fast-forward live" feel.
    """
    try:
        events = replay_bundle.get("events")
        if not isinstance(events, list):
            raise ValueError("Replay bundle does not contain a valid event list")

        has_complete_event = any(
            isinstance(event, dict) and event.get("type") == "debate_complete"
            for event in events
        )
        for event in events:
            event_type = event.get("type", "")
            delay = _REPLAY_DELAYS.get(event_type, _REPLAY_DEFAULT_DELAY)
            if delay > 0:
                await asyncio.sleep(delay)
            manager.record_event(debate_id, event)
            await manager.broadcast(debate_id, event)

        complete_payload = _build_complete_event_payload(
            events,
            fallback_report=replay_bundle.get("report"),
            fallback_final_scores=replay_bundle.get("final_scores"),
            fallback_action_trace=replay_bundle.get("action_trace"),
            fallback_evidence_board=replay_bundle.get("evidence_board"),
            fallback_agent_states=replay_bundle.get("agent_states"),
            fallback_halt_reason=replay_bundle.get("halt_reason"),
            fallback_step_count=replay_bundle.get("step_count", 0),
            fallback_current_round=replay_bundle.get("current_round", 0),
        )
        persisted_events = events if has_complete_event else [*events, complete_payload]

        if not has_complete_event:
            manager.record_event(debate_id, complete_payload)
            await manager.broadcast(debate_id, complete_payload)

        async with async_session() as session:
            db_result = await session.execute(
                select(Debate).where(Debate.id == debate_id)
            )
            debate = db_result.scalar_one_or_none()
            if debate:
                debate.status = DebateStatus.COMPLETED
                debate.completed_at = datetime.now(UTC)
                debate.report = complete_payload.get("report", {})
                debate.final_scores = complete_payload.get("final_scores", {})
                debate.action_trace = complete_payload.get("action_trace", [])
                debate.evidence_board = complete_payload.get("evidence_board", [])
                debate.agent_states = complete_payload.get("agent_states", {})
                debate.halt_reason = complete_payload.get("halt_reason")
                debate.step_count = complete_payload.get("step_count", 0)
                debate.current_round = complete_payload.get("current_round", 0)
                debate.event_cache = persisted_events
                await session.commit()

        manager.clear_runtime_cache(debate_id)
        logger.info("Cache replay finished for debate %s", debate_id)

    except Exception:
        logger.exception("Cache replay failed for debate %s", debate_id)
        async with async_session() as session:
            db_result = await session.execute(
                select(Debate).where(Debate.id == debate_id)
            )
            debate = db_result.scalar_one_or_none()
            if debate:
                debate.status = DebateStatus.FAILED
                await session.commit()
        error_event = {
            "type": "error",
            "message": "Debate replay failed.",
        }
        await manager.broadcast(debate_id, error_event)
        manager.clear_runtime_cache(debate_id)
