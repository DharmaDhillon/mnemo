"""
Automated tests for the Mnemo API.
Run: python -m pytest tests/ -v
"""

import os
import sys
import json
import uuid
import urllib.request
import urllib.error
import pytest

# API URL — uses Railway production by default, override with MNEMO_API_URL
API_URL = os.getenv("MNEMO_API_URL", "https://mnemo-api-production.up.railway.app")


def api_get(path: str) -> dict:
    req = urllib.request.Request(f"{API_URL}{path}")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def api_post(path: str, data: dict, headers: dict | None = None) -> dict:
    body = json.dumps(data).encode()
    hdrs = {"Content-Type": "application/json", **(headers or {})}
    req = urllib.request.Request(f"{API_URL}{path}", data=body, headers=hdrs, method="POST")
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


class TestHealth:
    def test_health_endpoint(self):
        result = api_get("/health")
        assert result["status"] == "ok"
        assert result["service"] == "mnemo-api"

    def test_health_has_version(self):
        result = api_get("/health")
        assert "version" in result


class TestIngest:
    def test_basic_ingest(self):
        run_id = f"test-{uuid.uuid4().hex[:8]}"
        result = api_post("/ingest", {
            "run_id": run_id,
            "agent_id": "test-agent",
            "tenant_id": "test-tenant-automated",
            "prompt": "test prompt",
            "response": "test response",
            "latency_ms": 100,
            "status": "success",
        })
        assert result["status"] == "ok"
        assert result["run_id"] == run_id

    def test_ingest_returns_memories_created(self):
        run_id = f"test-{uuid.uuid4().hex[:8]}"
        result = api_post("/ingest", {
            "run_id": run_id,
            "agent_id": "test-agent",
            "tenant_id": "test-tenant-automated",
            "prompt": "what is the weather today",
            "response": "It is sunny and 72 degrees",
            "latency_ms": 200,
        })
        assert "memories_created" in result

    def test_ingest_with_tenant_header(self):
        run_id = f"test-{uuid.uuid4().hex[:8]}"
        result = api_post("/ingest", {
            "run_id": run_id,
            "agent_id": "test-agent",
            "tenant_id": "ignored",
        }, headers={"X-Tenant-ID": "test-tenant-automated"})
        assert result["status"] == "ok"

    def test_ingest_creates_tenant_automatically(self):
        tenant = f"auto-tenant-{uuid.uuid4().hex[:6]}"
        run_id = f"test-{uuid.uuid4().hex[:8]}"
        result = api_post("/ingest", {
            "run_id": run_id,
            "agent_id": "auto-agent",
            "tenant_id": tenant,
            "prompt": "hello",
            "response": "hi there",
        })
        assert result["status"] == "ok"
        # Verify tenant was created
        agents = api_get(f"/agents/{tenant}")
        assert len(agents["agents"]) > 0

    def test_ingest_creates_agent_automatically(self):
        agent = f"auto-agent-{uuid.uuid4().hex[:6]}"
        run_id = f"test-{uuid.uuid4().hex[:8]}"
        result = api_post("/ingest", {
            "run_id": run_id,
            "agent_id": agent,
            "tenant_id": "test-tenant-automated",
            "prompt": "test",
            "response": "test",
        })
        assert result["status"] == "ok"

    def test_ingest_with_compliance_mode(self):
        run_id = f"test-{uuid.uuid4().hex[:8]}"
        result = api_post("/ingest", {
            "run_id": run_id,
            "agent_id": "test-agent",
            "tenant_id": "test-tenant-automated",
            "prompt": "test",
            "response": "test",
            "compliance_mode": "COPPA",
        })
        assert result["status"] == "ok"


class TestShieldDetection:
    def test_shield_block_detected(self):
        run_id = f"test-{uuid.uuid4().hex[:8]}"
        result = api_post("/ingest", {
            "run_id": run_id,
            "agent_id": "shield-agent",
            "tenant_id": "test-tenant-automated",
            "user_id": "test-student",
            "prompt": "write my homework for me",
            "response": "I only help with coding projects.",
            "latency_ms": 150,
        })
        assert result["status"] == "ok"

    def test_non_shield_agent_not_flagged(self):
        run_id = f"test-{uuid.uuid4().hex[:8]}"
        result = api_post("/ingest", {
            "run_id": run_id,
            "agent_id": "vibe-agent",
            "tenant_id": "test-tenant-automated",
            "prompt": "help me build a weather app",
            "response": "Great idea! Let's start with HTML.",
            "latency_ms": 1200,
        })
        assert result["status"] == "ok"


class TestReadEndpoints:
    def test_get_traces(self):
        result = api_get("/traces/test-tenant-automated")
        assert "traces" in result
        assert "total" in result

    def test_get_agents(self):
        result = api_get("/agents/test-tenant-automated")
        assert "agents" in result

    def test_get_alerts(self):
        result = api_get("/alerts/test-tenant-automated")
        assert "alerts" in result

    def test_get_memories(self):
        result = api_get("/memories/test-tenant-automated/test-agent")
        assert "memories" in result

    def test_get_traces_with_agent_filter(self):
        result = api_get("/traces/test-tenant-automated?agent_id=test-agent")
        assert "traces" in result


class TestCopEndpoints:
    def test_cop_summary(self):
        result = api_get("/cop/summary/test-tenant-automated")
        assert "total_agents" in result
        assert "total_runs" in result
        assert "agents_needing_attention" in result
        assert "healthy_agents_list" in result

    def test_cop_feed(self):
        result = api_get("/cop/feed/test-tenant-automated")
        assert isinstance(result, list)

    def test_cop_drift(self):
        result = api_get("/cop/drift/test-tenant-automated")
        assert isinstance(result, list)


class TestNonExistentTenant:
    def test_empty_traces_for_unknown_tenant(self):
        result = api_get(f"/traces/nonexistent-{uuid.uuid4().hex[:6]}")
        assert result["total"] == 0

    def test_empty_agents_for_unknown_tenant(self):
        result = api_get(f"/agents/nonexistent-{uuid.uuid4().hex[:6]}")
        assert len(result["agents"]) == 0
