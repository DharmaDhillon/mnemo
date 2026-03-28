"""Memory retrieval endpoints."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header

router = APIRouter()


@router.get("/{agent_id}")
async def get_memories(
    agent_id: str,
    user_id: str | None = None,
    limit: int = 50,
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
) -> dict[str, Any]:
    """Get all memories for an agent."""
    # TODO: Query Mem0 via MemoryManager with tenant scoping
    return {"agent_id": agent_id, "tenant_id": x_tenant_id, "memories": [], "total": 0}
