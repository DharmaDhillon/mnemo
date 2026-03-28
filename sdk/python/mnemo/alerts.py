"""
AlertEngine — Smart alert detection for agent behavior.

Fires alerts when agent behavior deviates from normal:
- Response latency exceeds threshold
- No memories were available (agent has amnesia)
- Response length is abnormally short or long
- Error rate exceeds threshold
- Custom rules defined by the developer

Alerts are logged to the trace and can trigger webhooks,
Slack messages, or PagerDuty incidents.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from mnemo.tracer import Tracer, TraceEvent


class AlertSeverity(str, Enum):
    """Alert severity levels."""

    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class AlertCondition(str, Enum):
    """Built-in alert conditions."""

    LATENCY_HIGH = "latency_high"
    NO_MEMORIES = "no_memories"
    RESPONSE_TOO_SHORT = "response_too_short"
    RESPONSE_TOO_LONG = "response_too_long"
    ERROR_RATE_HIGH = "error_rate_high"
    CUSTOM = "custom"


@dataclass
class AlertRule:
    """
    A rule that defines when an alert should fire.

    Built-in conditions use threshold values.
    Custom conditions use a predicate function.
    """

    name: str
    condition: AlertCondition
    severity: AlertSeverity = AlertSeverity.WARNING
    threshold: Optional[float] = None
    predicate: Optional[Callable[[dict[str, Any]], bool]] = None
    webhook_url: Optional[str] = None
    message_template: str = "Alert: {name} fired for agent {agent_id}"


@dataclass
class FiredAlert:
    """Record of an alert that fired."""

    rule_name: str
    agent_id: str
    run_id: str
    severity: AlertSeverity
    message: str
    timestamp: float = field(default_factory=time.time)
    data: dict[str, Any] = field(default_factory=dict)


class AlertEngine:
    """
    Evaluates alert rules against completed agent runs.

    Maintains a sliding window of recent run metrics to detect
    patterns like rising error rates or degrading latency.
    """

    # Default alert rules applied to every agent
    DEFAULT_RULES: list[AlertRule] = [
        AlertRule(
            name="high_latency",
            condition=AlertCondition.LATENCY_HIGH,
            severity=AlertSeverity.WARNING,
            threshold=10000.0,  # 10 seconds
            message_template="Agent {agent_id} took {duration_ms:.0f}ms (threshold: {threshold}ms)",
        ),
        AlertRule(
            name="no_memories",
            condition=AlertCondition.NO_MEMORIES,
            severity=AlertSeverity.INFO,
            threshold=0,
            message_template="Agent {agent_id} had no memories available — running without context",
        ),
    ]

    def __init__(
        self,
        tenant_id: str,
        tracer: Tracer,
        *,
        debug: bool = False,
        enable_defaults: bool = True,
    ) -> None:
        self.tenant_id = tenant_id
        self.tracer = tracer
        self.debug = debug

        self._rules: list[AlertRule] = []
        if enable_defaults:
            self._rules.extend(self.DEFAULT_RULES)

        # Sliding window of recent run metrics for pattern detection
        self._recent_runs: list[dict[str, Any]] = []
        self._max_window = 100

        # History of fired alerts
        self.history: list[FiredAlert] = []

    def add_rule(self, rule: AlertRule) -> None:
        """Register a new alert rule."""
        self._rules.append(rule)
        self._log(f"Alert rule added: {rule.name}")

    def remove_rule(self, name: str) -> bool:
        """Remove an alert rule by name. Returns True if found and removed."""
        before = len(self._rules)
        self._rules = [r for r in self._rules if r.name != name]
        return len(self._rules) < before

    def evaluate(
        self,
        run_id: str,
        agent_id: str,
        prompt: str,
        response: str,
        memories_injected: int,
        duration_ms: float,
    ) -> list[str]:
        """
        Evaluate all alert rules against a completed run.

        Returns list of alert names that fired.
        """
        run_metrics = {
            "run_id": run_id,
            "agent_id": agent_id,
            "prompt": prompt,
            "response": response,
            "memories_injected": memories_injected,
            "duration_ms": duration_ms,
            "response_length": len(response),
            "timestamp": time.time(),
        }

        # Add to sliding window
        self._recent_runs.append(run_metrics)
        if len(self._recent_runs) > self._max_window:
            self._recent_runs = self._recent_runs[-self._max_window:]

        fired: list[str] = []

        for rule in self._rules:
            if self._check_rule(rule, run_metrics):
                message = rule.message_template.format(
                    name=rule.name,
                    agent_id=agent_id,
                    run_id=run_id,
                    duration_ms=duration_ms,
                    threshold=rule.threshold,
                    memories_injected=memories_injected,
                    response_length=len(response),
                )

                alert = FiredAlert(
                    rule_name=rule.name,
                    agent_id=agent_id,
                    run_id=run_id,
                    severity=rule.severity,
                    message=message,
                    data=run_metrics,
                )
                self.history.append(alert)
                fired.append(rule.name)

                self._log(f"Alert fired: {rule.name} ({rule.severity.value}): {message}")

                if rule.webhook_url:
                    self._fire_webhook(rule.webhook_url, alert)

        return fired

    def _check_rule(self, rule: AlertRule, metrics: dict[str, Any]) -> bool:
        """Check if a single rule fires against the given metrics."""
        if rule.condition == AlertCondition.LATENCY_HIGH:
            return metrics["duration_ms"] > (rule.threshold or 10000)

        elif rule.condition == AlertCondition.NO_MEMORIES:
            return metrics["memories_injected"] == 0

        elif rule.condition == AlertCondition.RESPONSE_TOO_SHORT:
            return metrics["response_length"] < (rule.threshold or 10)

        elif rule.condition == AlertCondition.RESPONSE_TOO_LONG:
            return metrics["response_length"] > (rule.threshold or 50000)

        elif rule.condition == AlertCondition.ERROR_RATE_HIGH:
            # Check error rate over the sliding window
            if len(self._recent_runs) < 5:
                return False
            error_count = sum(
                1 for r in self._recent_runs[-10:]
                if r.get("response_length", 0) == 0
            )
            error_rate = error_count / min(len(self._recent_runs), 10)
            return error_rate > (rule.threshold or 0.5)

        elif rule.condition == AlertCondition.CUSTOM:
            if rule.predicate:
                return rule.predicate(metrics)
            return False

        return False

    def _fire_webhook(self, url: str, alert: FiredAlert) -> None:
        """Send an alert to a webhook URL (non-blocking best-effort)."""
        try:
            import urllib.request
            import json

            payload = json.dumps({
                "rule": alert.rule_name,
                "agent_id": alert.agent_id,
                "run_id": alert.run_id,
                "severity": alert.severity.value,
                "message": alert.message,
                "timestamp": alert.timestamp,
            }).encode()

            req = urllib.request.Request(
                url,
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            urllib.request.urlopen(req, timeout=5)
        except Exception as exc:
            self._log(f"Webhook failed for {url}: {exc}")

    def _log(self, message: str) -> None:
        """Internal debug logging."""
        if self.debug:
            print(f"[mnemo:alerts] {message}")
