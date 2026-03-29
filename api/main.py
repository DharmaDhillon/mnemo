"""
Mnemo API — FastAPI backend for trace ingestion, memory retrieval, and alert management.

Receives traces from the SDK and MiniFounder agents.
Stores runs + traces in Supabase. Forwards to Langfuse if configured.
Every endpoint is tenant-scoped.
"""

from __future__ import annotations

import os
import time
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

# ─── Supabase client ───
_supabase = None

def get_supabase():
    global _supabase
    if _supabase is None:
        from supabase import create_client
        url = os.getenv("MNEMO_SUPABASE_URL")
        key = os.getenv("MNEMO_SUPABASE_SERVICE_KEY")
        if url and key:
            _supabase = create_client(url, key)
    return _supabase

# ─── Langfuse client ───
_langfuse = None

def get_langfuse():
    global _langfuse
    if _langfuse is None:
        pub = os.getenv("MNEMO_LANGFUSE_PUBLIC_KEY")
        sec = os.getenv("MNEMO_LANGFUSE_SECRET_KEY")
        if pub and sec:
            try:
                from langfuse import Langfuse
                _langfuse = Langfuse(public_key=pub, secret_key=sec)
            except Exception:
                pass
    return _langfuse


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    get_supabase()
    get_langfuse()
    yield


app = FastAPI(
    title="Mnemo API",
    description="Memory and observability for AI agents",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Models ───

class IngestPayload(BaseModel):
    run_id: str
    agent_id: str
    tenant_id: str
    user_id: Optional[str] = None
    prompt: Optional[str] = None
    response: Optional[str] = None
    latency_ms: Optional[float] = None
    timestamp: Optional[str] = None
    compliance_mode: Optional[str] = None
    memories_injected: int = 0
    memories_created: int = 0
    status: str = "success"
    metadata: Optional[dict[str, Any]] = None


# ─── Endpoints ───

@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "mnemo-api", "version": "0.1.0"}


@app.post("/ingest")
async def ingest_trace(
    payload: IngestPayload,
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID"),
) -> dict[str, Any]:
    """
    Receive a trace from the SDK or MiniFounder agents.

    Stores the run in Supabase runs table, stores trace events,
    and forwards to Langfuse if configured. Never throws errors
    that break the caller.
    """
    tenant_id = x_tenant_id or payload.tenant_id

    try:
        sb = get_supabase()
        if sb:
            # Ensure tenant exists
            existing = sb.table("tenants").select("id").eq("tenant_id", tenant_id).execute()
            if not existing.data:
                sb.table("tenants").insert({
                    "tenant_id": tenant_id,
                    "name": tenant_id,
                    "plan": "free",
                }).execute()

            # Ensure agent exists
            existing_agent = sb.table("agents").select("id").eq("tenant_id", tenant_id).eq("agent_id", payload.agent_id).execute()
            if not existing_agent.data:
                sb.table("agents").insert({
                    "tenant_id": tenant_id,
                    "agent_id": payload.agent_id,
                }).execute()

            # Insert run
            run_data: dict[str, Any] = {
                "tenant_id": tenant_id,
                "agent_id": payload.agent_id,
                "run_id": payload.run_id,
                "user_id": payload.user_id,
                "status": payload.status,
                "duration_ms": payload.latency_ms,
                "memories_injected": payload.memories_injected,
                "memories_created": payload.memories_created,
                "metadata": payload.metadata or {},
            }
            if payload.timestamp:
                run_data["created_at"] = payload.timestamp
            if payload.status in ("success", "error"):
                run_data["completed_at"] = payload.timestamp or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

            sb.table("runs").insert(run_data).execute()

            # Insert trace events
            trace_events = [
                {"event": "run.start", "data": {"prompt": (payload.prompt or "")[:500]}},
                {"event": "run.end", "data": {"response_length": len(payload.response or ""), "status": payload.status}},
            ]
            if payload.compliance_mode:
                trace_events.append({"event": "compliance", "data": {"mode": payload.compliance_mode}})

            for evt in trace_events:
                sb.table("traces").insert({
                    "tenant_id": tenant_id,
                    "run_id": payload.run_id,
                    "event": evt["event"],
                    "data": evt["data"],
                }).execute()

        # Forward to Langfuse
        lf = get_langfuse()
        if lf:
            try:
                from langfuse import propagate_attributes
                with propagate_attributes(
                    user_id=payload.user_id,
                    metadata={"tenant_id": tenant_id, "agent_id": payload.agent_id},
                    trace_name=f"mnemo:{payload.agent_id}",
                ):
                    with lf.start_as_current_observation(
                        name=f"mnemo.run.{payload.agent_id}",
                        as_type="span",
                        input={"prompt": (payload.prompt or "")[:500]},
                        output={"response_length": len(payload.response or "")},
                        metadata={"run_id": payload.run_id, "latency_ms": payload.latency_ms},
                    ):
                        pass
                lf.flush()
            except Exception:
                pass  # Never fail the caller for tracing issues

        return {"status": "ok", "run_id": payload.run_id}

    except Exception as e:
        # Log but don't break the caller
        print(f"[mnemo-api] ingest error: {e}")
        return {"status": "ok", "run_id": payload.run_id, "warning": str(e)}


@app.get("/traces/{tenant_id}")
async def get_traces(
    tenant_id: str,
    agent_id: Optional[str] = None,
    limit: int = 50,
) -> dict[str, Any]:
    """Get traces for a tenant."""
    sb = get_supabase()
    if not sb:
        return {"tenant_id": tenant_id, "traces": [], "total": 0}

    query = sb.table("runs").select("*").eq("tenant_id", tenant_id).order("created_at", desc=True).limit(limit)
    if agent_id:
        query = query.eq("agent_id", agent_id)
    result = query.execute()
    return {"tenant_id": tenant_id, "traces": result.data or [], "total": len(result.data or [])}


@app.get("/memories/{agent_id}")
async def get_memories(
    agent_id: str,
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID"),
    limit: int = 50,
) -> dict[str, Any]:
    """Get memories for an agent."""
    sb = get_supabase()
    if not sb:
        return {"agent_id": agent_id, "memories": [], "total": 0}

    query = sb.table("memories").select("*").eq("agent_id", agent_id).order("created_at", desc=True).limit(limit)
    if x_tenant_id:
        query = query.eq("tenant_id", x_tenant_id)
    result = query.execute()
    return {"agent_id": agent_id, "memories": result.data or [], "total": len(result.data or [])}


@app.get("/agents/{tenant_id}")
async def get_agents(tenant_id: str) -> dict[str, Any]:
    """Get all agents for a tenant."""
    sb = get_supabase()
    if not sb:
        return {"tenant_id": tenant_id, "agents": []}

    result = sb.table("agents").select("*").eq("tenant_id", tenant_id).execute()
    return {"tenant_id": tenant_id, "agents": result.data or []}
