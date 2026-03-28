"""Trace retrieval endpoints."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header

router = APIRouter()


@router.get("/{tenant_id}")
async def get_traces(
    tenant_id: str,
    agent_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
) -> dict[str, Any]:
    """Get traces for a tenant, optionally filtered by agent."""
    if tenant_id != x_tenant_id:
        return {"error": "tenant_id mismatch", "traces": []}

    # TODO: Query Supabase with RLS
    return {"tenant_id": tenant_id, "traces": [], "total": 0}
