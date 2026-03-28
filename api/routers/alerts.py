"""Alert configuration and history endpoints."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header

router = APIRouter()


@router.get("/")
async def list_alert_rules(
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
) -> dict[str, Any]:
    """List all alert rules for a tenant."""
    # TODO: Query Supabase alert_rules table
    return {"tenant_id": x_tenant_id, "rules": []}


@router.post("/")
async def create_alert_rule(
    payload: dict[str, Any],
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
) -> dict[str, Any]:
    """Create a new alert rule."""
    # TODO: Insert into Supabase alert_rules table
    return {"status": "created", "tenant_id": x_tenant_id}


@router.get("/history")
async def get_alert_history(
    agent_id: str | None = None,
    limit: int = 50,
    x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
) -> dict[str, Any]:
    """Get alert history for a tenant."""
    # TODO: Query Supabase alert_history table
    return {"tenant_id": x_tenant_id, "alerts": [], "total": 0}
