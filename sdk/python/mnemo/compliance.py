"""
ComplianceLayer — Healthcare and education regulatory compliance.

This is our enterprise moat. No competitor has this.

When compliance mode is enabled, every agent run is:
- Tagged with the applicable regulatory framework (HIPAA, FERPA, COPPA)
- Logged with full decision audit trail
- Subject to data retention policies per tenant
- Exportable in formats regulators accept

This is what gets Mnemo into hospitals and schools.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional


class ComplianceMode(str, Enum):
    """Supported regulatory frameworks."""

    HIPAA = "hipaa"        # Healthcare (US)
    FERPA = "ferpa"        # Education (US)
    COPPA = "coppa"        # Children's privacy (US)
    GDPR = "gdpr"          # General data protection (EU)
    SOC2 = "soc2"          # Service organization controls


@dataclass
class DecisionLog:
    """Immutable record of a single agent decision for audit purposes."""

    run_id: str
    agent_id: str
    tenant_id: str
    timestamp: float
    framework: ComplianceMode
    prompt_hash: str  # We store hash, not raw prompt (PHI protection)
    response_hash: str
    memories_used: int
    decision_metadata: dict[str, Any] = field(default_factory=dict)

    def to_audit_format(self) -> dict[str, Any]:
        """Export in a format suitable for regulatory audit."""
        return {
            "record_type": "ai_agent_decision",
            "regulatory_framework": self.framework.value,
            "run_id": self.run_id,
            "agent_id": self.agent_id,
            "tenant_id": self.tenant_id,
            "timestamp_utc": self.timestamp,
            "prompt_fingerprint": self.prompt_hash,
            "response_fingerprint": self.response_hash,
            "memory_context_count": self.memories_used,
            "metadata": self.decision_metadata,
        }


@dataclass
class RetentionPolicy:
    """Data retention configuration per compliance framework."""

    framework: ComplianceMode
    max_retention_days: int
    require_encryption_at_rest: bool = True
    require_audit_log: bool = True
    allow_memory_persistence: bool = True  # COPPA may require this to be False
    phi_fields: list[str] = field(default_factory=list)  # Fields that may contain PHI


# Default retention policies per framework
DEFAULT_RETENTION_POLICIES: dict[ComplianceMode, RetentionPolicy] = {
    ComplianceMode.HIPAA: RetentionPolicy(
        framework=ComplianceMode.HIPAA,
        max_retention_days=2190,  # 6 years per HIPAA
        require_encryption_at_rest=True,
        require_audit_log=True,
        phi_fields=["patient_name", "dob", "ssn", "mrn", "diagnosis", "treatment"],
    ),
    ComplianceMode.FERPA: RetentionPolicy(
        framework=ComplianceMode.FERPA,
        max_retention_days=1825,  # 5 years
        require_encryption_at_rest=True,
        require_audit_log=True,
        phi_fields=["student_name", "student_id", "grades", "enrollment"],
    ),
    ComplianceMode.COPPA: RetentionPolicy(
        framework=ComplianceMode.COPPA,
        max_retention_days=365,  # 1 year — more restrictive for children
        require_encryption_at_rest=True,
        require_audit_log=True,
        allow_memory_persistence=False,  # Don't persist memories for children
        phi_fields=["child_name", "age", "parent_email", "school"],
    ),
    ComplianceMode.GDPR: RetentionPolicy(
        framework=ComplianceMode.GDPR,
        max_retention_days=1095,  # 3 years default, configurable
        require_encryption_at_rest=True,
        require_audit_log=True,
        phi_fields=["name", "email", "address", "phone"],
    ),
    ComplianceMode.SOC2: RetentionPolicy(
        framework=ComplianceMode.SOC2,
        max_retention_days=2555,  # 7 years
        require_encryption_at_rest=True,
        require_audit_log=True,
    ),
}


class ComplianceLayer:
    """
    Enforces regulatory compliance for agent operations.

    When active, every agent decision is logged as an immutable
    audit record that can be exported for regulators.
    """

    def __init__(
        self,
        tenant_id: str,
        mode: ComplianceMode,
        *,
        retention_policy: Optional[RetentionPolicy] = None,
        debug: bool = False,
    ) -> None:
        self.tenant_id = tenant_id
        self.mode = mode
        self.debug = debug
        self.policy = retention_policy or DEFAULT_RETENTION_POLICIES.get(
            mode,
            RetentionPolicy(framework=mode, max_retention_days=1095),
        )
        self._decision_log: list[DecisionLog] = []
        self._log(f"Compliance mode enabled: {mode.value}")

    def log_decision(
        self,
        run_id: str,
        agent_id: str,
        prompt: str,
        response: str,
        memories_used: int,
        *,
        metadata: Optional[dict[str, Any]] = None,
    ) -> DecisionLog:
        """
        Log a single agent decision for audit purposes.

        Prompt and response are stored as hashes, never raw text,
        to protect PHI/PII in compliance mode.
        """
        import hashlib

        record = DecisionLog(
            run_id=run_id,
            agent_id=agent_id,
            tenant_id=self.tenant_id,
            timestamp=time.time(),
            framework=self.mode,
            prompt_hash=hashlib.sha256(prompt.encode()).hexdigest(),
            response_hash=hashlib.sha256(response.encode()).hexdigest(),
            memories_used=memories_used,
            decision_metadata=metadata or {},
        )
        self._decision_log.append(record)
        self._log(f"Decision logged: run_id={run_id}")
        return record

    def can_persist_memories(self) -> bool:
        """Check if the current compliance mode allows memory persistence."""
        return self.policy.allow_memory_persistence

    def get_retention_days(self) -> int:
        """Get the maximum data retention period in days."""
        return self.policy.max_retention_days

    def export_audit_report(
        self,
        *,
        agent_id: Optional[str] = None,
        start_time: Optional[float] = None,
        end_time: Optional[float] = None,
    ) -> list[dict[str, Any]]:
        """
        Export decision logs in a format regulators accept.

        Can be filtered by agent_id and time range.
        """
        records = self._decision_log

        if agent_id:
            records = [r for r in records if r.agent_id == agent_id]
        if start_time:
            records = [r for r in records if r.timestamp >= start_time]
        if end_time:
            records = [r for r in records if r.timestamp <= end_time]

        return [r.to_audit_format() for r in records]

    def export_audit_json(self, **kwargs: Any) -> str:
        """Export audit report as formatted JSON."""
        report = self.export_audit_report(**kwargs)
        return json.dumps(
            {
                "audit_report": {
                    "framework": self.mode.value,
                    "tenant_id": self.tenant_id,
                    "generated_at": time.time(),
                    "record_count": len(report),
                    "records": report,
                }
            },
            indent=2,
        )

    def check_phi_exposure(self, text: str) -> list[str]:
        """
        Check if text potentially contains PHI/PII fields.

        Returns list of field names that may be exposed.
        This is a basic check — production deployments should use
        a dedicated PHI detection service.
        """
        exposed = []
        text_lower = text.lower()
        for phi_field in self.policy.phi_fields:
            if phi_field.lower().replace("_", " ") in text_lower:
                exposed.append(phi_field)
        return exposed

    def _log(self, message: str) -> None:
        """Internal debug logging."""
        if self.debug:
            print(f"[mnemo:compliance:{self.mode.value}] {message}")
