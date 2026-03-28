"""
Mnemo API — FastAPI backend for trace ingestion, memory retrieval, and alert management.

Receives traces from the SDK, routes to Langfuse + Mem0, and serves the dashboard.
Every endpoint is tenant-scoped. Supabase RLS enforces isolation.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware

from api.routers import traces, memories, alerts


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Initialize connections on startup, clean up on shutdown."""
    # TODO: Initialize Supabase client pool
    yield
    # TODO: Close connections


app = FastAPI(
    title="Mnemo API",
    description="Memory and observability for AI agents",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.mnemo.ai"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(traces.router, prefix="/traces", tags=["traces"])
app.include_router(memories.router, prefix="/memories", tags=["memories"])
app.include_router(alerts.router, prefix="/alerts", tags=["alerts"])


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "mnemo-api", "version": "0.1.0"}


@app.post("/ingest")
async def ingest_trace(
    payload: dict[str, Any],
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
) -> dict[str, str]:
    """
    Receive a trace from the SDK and route it to storage.

    The SDK sends traces here. We store them in Supabase and
    forward to Langfuse for the observability dashboard.
    """
    run_id = payload.get("run_id")
    if not run_id:
        raise HTTPException(status_code=400, detail="run_id is required")

    # TODO: Store in Supabase with RLS (tenant_id from header)
    # TODO: Forward to Langfuse

    return {"status": "accepted", "run_id": run_id}
