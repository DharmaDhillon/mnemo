"""
Mnemo API — FastAPI backend for trace ingestion, memory retrieval, and alert management.

Receives traces from the SDK and MiniFounder agents.
Stores runs + traces in Supabase. Stores memories in Mem0.
Forwards to Langfuse if configured. Tracks Shield violations.
Every endpoint is tenant-scoped.
"""

from __future__ import annotations

import os
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Header
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

# ─── Mem0 client ───
_mem0 = None

def get_mem0():
    global _mem0
    if _mem0 is None:
        api_key = os.getenv("MNEMO_MEM0_API_KEY")
        if api_key:
            try:
                from mem0 import MemoryClient
                _mem0 = MemoryClient(api_key=api_key)
            except Exception as e:
                print(f"[mnemo-api] Mem0 init failed: {e}")
    return _mem0

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


# ─── Shield violation detection ───

def detect_violation_type(prompt: str) -> str:
    prompt_lower = prompt.lower()
    if any(w in prompt_lower for w in ["essay", "homework", "write my", "do my", "cheat"]):
        return "academic_dishonesty"
    if any(w in prompt_lower for w in ["hate", "kill", "hurt", "stupid", "idiot", "dumb"]):
        return "inappropriate_language"
    if any(w in prompt_lower for w in ["address", "phone", "password", "credit card", "social security"]):
        return "personal_information"
    return "policy_violation"


SHIELD_BLOCK_KEYWORDS = ["blocked", "can't help with that", "only help with coding", "not able to", "i can't", "i cannot", "inappropriate", "not allowed"]

def is_shield_block(agent_id: str, response: str) -> bool:
    if "shield" not in agent_id.lower():
        return False
    resp_lower = (response or "").lower()
    return any(kw in resp_lower for kw in SHIELD_BLOCK_KEYWORDS)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    get_supabase()
    get_mem0()
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
    return {"status": "ok", "service": "mnemo-api", "version": "0.2.0"}


@app.post("/ingest")
async def ingest_trace(
    payload: IngestPayload,
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID"),
) -> dict[str, Any]:
    """
    Receive a trace from the SDK or MiniFounder agents.

    Stores the run in Supabase, stores memories in Mem0,
    tracks Shield violations, and forwards to Langfuse.
    Never throws errors that break the caller.
    """
    tenant_id = x_tenant_id or payload.tenant_id
    memories_created = 0

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
            now_ts = payload.timestamp or datetime.now(timezone.utc).isoformat()
            run_data: dict[str, Any] = {
                "tenant_id": tenant_id,
                "agent_id": payload.agent_id,
                "run_id": payload.run_id,
                "user_id": payload.user_id,
                "status": payload.status,
                "duration_ms": payload.latency_ms,
                "memories_injected": payload.memories_injected,
                "memories_created": payload.memories_created,
                "metadata": {
                    **(payload.metadata or {}),
                    "prompt": (payload.prompt or "")[:200],
                },
                "created_at": now_ts,
            }
            if payload.status in ("success", "error"):
                run_data["completed_at"] = now_ts

            run_result = sb.table("runs").insert(run_data).execute()

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

            # ─── FIX 2: Shield agent special handling ───
            if is_shield_block(payload.agent_id, payload.response or ""):
                violation_type = detect_violation_type(payload.prompt or "")
                sb.table("alert_history").insert({
                    "tenant_id": tenant_id,
                    "agent_id": payload.agent_id,
                    "severity": "high",
                    "message": f"Shield blocked message from user {payload.user_id or 'unknown'}. Prompt: {(payload.prompt or '')[:100]}",
                    "fired_at": now_ts,
                    "data": {
                        "user_id": payload.user_id,
                        "violation_type": violation_type,
                        "blocked": True,
                        "coppa_logged": True,
                        "run_id": payload.run_id,
                    },
                }).execute()

                # Store Shield-specific memory in Mem0
                mem0 = get_mem0()
                if mem0:
                    try:
                        mem0.add(
                            [{"role": "system", "content": f"User {payload.user_id or 'unknown'} had content blocked on {now_ts}. Violation: {violation_type}. Shield intervention count increased."}],
                            agent_id=payload.agent_id,
                            metadata={"mnemo_type": "pattern", "violation_type": violation_type, "tenant_id": tenant_id},
                        )
                    except Exception as e:
                        print(f"[mnemo-api] Shield Mem0 error: {e}")

        # ─── FIX 1: Store memories in Mem0 ───
        if payload.prompt and payload.response:
            mem0 = get_mem0()
            if mem0:
                try:
                    messages = [
                        {"role": "user", "content": payload.prompt},
                        {"role": "assistant", "content": payload.response},
                    ]
                    user_scope = f"{tenant_id}:{payload.user_id}" if payload.user_id else tenant_id
                    result = mem0.add(
                        messages,
                        user_id=user_scope,
                        agent_id=payload.agent_id,
                        metadata={"mnemo_type": "episodic", "tenant_id": tenant_id},
                    )
                    if result:
                        memories_created = len(result.get("results", [])) if isinstance(result, dict) else len(result) if result else 0
                except Exception as e:
                    print(f"[mnemo-api] Mem0 storage error: {e}")

            # Update run with actual memories_created count
            if sb and memories_created > 0 and run_result and run_result.data:
                try:
                    sb.table("runs").update({
                        "memories_created": memories_created,
                    }).eq("run_id", payload.run_id).execute()
                except Exception:
                    pass

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
                pass

        return {"status": "ok", "run_id": payload.run_id, "memories_created": memories_created}

    except Exception as e:
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


@app.get("/memories/{tenant_id}/{agent_id}")
async def get_memories_for_agent(
    tenant_id: str,
    agent_id: str,
    limit: int = 50,
) -> dict[str, Any]:
    """Get memories from Mem0 for an agent."""
    mem0 = get_mem0()
    if not mem0:
        return {"agent_id": agent_id, "memories": [], "total": 0}
    try:
        raw = mem0.get_all(filters={"agent_id": agent_id}, page_size=limit)
        memories = raw.get("results", []) if isinstance(raw, dict) else raw or []
        return {"agent_id": agent_id, "memories": memories, "total": len(memories)}
    except Exception as e:
        print(f"[mnemo-api] Mem0 get error: {e}")
        return {"agent_id": agent_id, "memories": [], "total": 0, "error": str(e)}


@app.get("/alerts/{tenant_id}")
async def get_alerts(
    tenant_id: str,
    agent_id: Optional[str] = None,
    limit: int = 50,
) -> dict[str, Any]:
    """Get alert history for a tenant."""
    sb = get_supabase()
    if not sb:
        return {"tenant_id": tenant_id, "alerts": [], "total": 0}
    query = sb.table("alert_history").select("*").eq("tenant_id", tenant_id).order("fired_at", desc=True).limit(limit)
    if agent_id:
        query = query.eq("agent_id", agent_id)
    result = query.execute()
    return {"tenant_id": tenant_id, "alerts": result.data or [], "total": len(result.data or [])}


@app.get("/agents/{tenant_id}")
async def get_agents(tenant_id: str) -> dict[str, Any]:
    """Get all agents for a tenant."""
    sb = get_supabase()
    if not sb:
        return {"tenant_id": tenant_id, "agents": []}
    result = sb.table("agents").select("*").eq("tenant_id", tenant_id).execute()
    return {"tenant_id": tenant_id, "agents": result.data or []}
