"""
Startup Arena - FastAPI Backend Entry Point
Multi-Agent Debate System for Startup Idea Evaluation
"""
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(
    os.path.join(os.path.dirname(__file__), "..", "..", ".env"),
    override=True,
)

from app.api.debate import router as debate_router
from app.api.ws import router as ws_router
from app.db.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    await init_db()
    yield


app = FastAPI(
    title="Startup Arena",
    description="Multi-Agent Debate System for Startup Idea Evaluation",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(debate_router, prefix="/api")
app.include_router(ws_router, prefix="/ws")


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "startup-arena"}
