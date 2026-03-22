"""WebSocket handler for real-time debate streaming."""
import asyncio
import json
import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.db.database import async_session
from app.graph.debate_graph import get_runtime_agent_configs, run_debate
from app.models.debate import Debate, DebateStatus

logger = logging.getLogger(__name__)
router = APIRouter()


class ConnectionManager:
    """Manage active WebSocket connections per debate."""

    def __init__(self):
        self.active: dict[str, list[WebSocket]] = {}

    async def connect(self, debate_id: str, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(debate_id, []).append(ws)

    def disconnect(self, debate_id: str, ws: WebSocket):
        if debate_id in self.active and ws in self.active[debate_id]:
            self.active[debate_id].remove(ws)
            if not self.active[debate_id]:
                del self.active[debate_id]

    async def broadcast(self, debate_id: str, message: dict[str, Any]):
        """Send message to all connected clients for a debate."""
        if debate_id not in self.active:
            return
        data = json.dumps(message, ensure_ascii=False)
        disconnected = []
        for ws in self.active[debate_id]:
            try:
                await ws.send_text(data)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            self.disconnect(debate_id, ws)


manager = ConnectionManager()


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
                # First connection: start the debate
                debate.status = DebateStatus.IN_PROGRESS
                await session.commit()
                asyncio.create_task(
                    _run_debate_with_streaming(debate_id, debate.idea, debate.max_rounds)
                )
            elif status == DebateStatus.COMPLETED:
                # Debate already done, send the report directly
                await websocket.send_json({
                    "type": "debate_complete",
                    "report": debate.report or {},
                    "final_scores": debate.final_scores or {},
                })
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
                await websocket.send_json({
                    "type": "debate_start",
                    "message": "Debate is in progress...",
                    "agent_configs": get_runtime_agent_configs(),
                })

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
    except Exception as e:
        logger.error(f"WebSocket error for debate {debate_id}: {e}")
    finally:
        manager.disconnect(debate_id, websocket)


async def _run_debate_with_streaming(debate_id: str, idea: str, max_rounds: int):
    """Run the debate graph and stream events to connected clients."""
    try:
        runtime_configs = get_runtime_agent_configs()
        logger.info("Debate %s runtime agent configs: %s", debate_id, runtime_configs)

        await manager.broadcast(debate_id, {
            "type": "debate_start",
            "message": "Debate is starting...",
            "agent_configs": runtime_configs,
        })

        async def on_event(event: dict):
            await manager.broadcast(debate_id, event)

        result = await run_debate(idea, max_rounds, on_event)

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
                from datetime import datetime
                debate.completed_at = datetime.utcnow()
                await session.commit()

        await manager.broadcast(debate_id, {
            "type": "debate_complete",
            "report": result.get("report", {}),
            "final_scores": result.get("final_scores", {}),
        })

    except Exception as e:
        logger.error(f"Debate {debate_id} failed: {e}")
        async with async_session() as session:
            db_result = await session.execute(
                select(Debate).where(Debate.id == debate_id)
            )
            debate = db_result.scalar_one_or_none()
            if debate:
                debate.status = DebateStatus.FAILED
                await session.commit()

        await manager.broadcast(debate_id, {
            "type": "error",
            "message": f"Debate failed: {str(e)}",
        })
