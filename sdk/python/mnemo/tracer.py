"""
Tracer — Dual observability through Langfuse and OpenTelemetry.

Every agent run produces a complete trace that shows:
- What memories were retrieved and injected
- What the LLM was asked (with memory context)
- What the LLM responded
- What new memories were extracted
- Whether any alerts fired
- How long each step took

Traces go to two destinations simultaneously:
1. Langfuse — for the Mnemo dashboard (detailed agent-specific view)
2. OpenTelemetry — for enterprise observability stacks (Datadog, Grafana, CloudWatch)
"""

from __future__ import annotations

import time
from enum import Enum
from typing import Any, Optional


class TraceEvent(str, Enum):
    """Events that occur during an agent run."""

    RUN_START = "run.start"
    RUN_END = "run.end"
    MEMORY_RETRIEVAL_START = "memory.retrieval.start"
    MEMORY_RETRIEVAL_END = "memory.retrieval.end"
    MEMORY_STORAGE_START = "memory.storage.start"
    MEMORY_STORAGE_END = "memory.storage.end"
    LLM_CALL_START = "llm.call.start"
    LLM_CALL_END = "llm.call.end"
    ALERT_FIRED = "alert.fired"
    ERROR = "error"


class Trace:
    """Represents a single agent run trace."""

    def __init__(
        self,
        run_id: str,
        agent_id: str,
        tenant_id: str,
        *,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> None:
        self.run_id = run_id
        self.agent_id = agent_id
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.session_id = session_id
        self.metadata = metadata or {}
        self.events: list[dict[str, Any]] = []
        self.start_time = time.time()

        # Langfuse v4: the span context manager object
        self._langfuse_span: Any = None
        # Langfuse v4: the propagate_attributes context manager
        self._langfuse_propagation: Any = None
        # OpenTelemetry span (set during start_trace)
        self._otel_span: Any = None


class Tracer:
    """
    Dual-destination trace collector.

    Sends traces to both Langfuse (for the Mnemo dashboard) and
    OpenTelemetry (for enterprise observability stacks).
    """

    def __init__(
        self,
        tenant_id: str,
        *,
        langfuse_public_key: Optional[str] = None,
        langfuse_secret_key: Optional[str] = None,
        otel_endpoint: Optional[str] = None,
        debug: bool = False,
    ) -> None:
        self.tenant_id = tenant_id
        self.debug = debug

        # Langfuse client (lazy-initialized)
        self._langfuse_public_key = langfuse_public_key
        self._langfuse_secret_key = langfuse_secret_key
        self._langfuse: Any = None

        # OpenTelemetry tracer (lazy-initialized)
        self._otel_endpoint = otel_endpoint
        self._otel_tracer: Any = None

    def _get_langfuse(self) -> Any:
        """Lazy-initialize the Langfuse v4 client."""
        if self._langfuse is None and self._langfuse_public_key:
            try:
                from langfuse import Langfuse

                self._langfuse = Langfuse(
                    public_key=self._langfuse_public_key,
                    secret_key=self._langfuse_secret_key,
                )
                self._log("Langfuse v4 client initialized")
            except ImportError:
                self._log("Langfuse SDK not installed — traces will be local only")
        return self._langfuse

    def _get_otel_tracer(self) -> Any:
        """Lazy-initialize the OpenTelemetry tracer."""
        if self._otel_tracer is None and self._otel_endpoint:
            try:
                from opentelemetry import trace
                from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
                from opentelemetry.sdk.resources import Resource
                from opentelemetry.sdk.trace import TracerProvider
                from opentelemetry.sdk.trace.export import BatchSpanProcessor

                resource = Resource.create({
                    "service.name": "mnemo",
                    "service.version": "0.1.0",
                    "mnemo.tenant_id": self.tenant_id,
                })
                provider = TracerProvider(resource=resource)
                exporter = OTLPSpanExporter(endpoint=self._otel_endpoint)
                provider.add_span_processor(BatchSpanProcessor(exporter))
                trace.set_tracer_provider(provider)
                self._otel_tracer = trace.get_tracer("mnemo", "0.1.0")
                self._log("OpenTelemetry tracer initialized")
            except ImportError:
                self._log("OpenTelemetry SDK not installed — OTEL traces disabled")
        return self._otel_tracer

    def start_trace(
        self,
        run_id: str,
        agent_id: str,
        *,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> Trace:
        """Start a new trace for an agent run."""
        trace = Trace(
            run_id=run_id,
            agent_id=agent_id,
            tenant_id=self.tenant_id,
            user_id=user_id,
            session_id=session_id,
            metadata=metadata,
        )

        # Start Langfuse v4 trace via propagate_attributes + start_as_current_observation
        langfuse = self._get_langfuse()
        if langfuse:
            try:
                from langfuse import propagate_attributes

                # propagate_attributes sets trace-level properties (user, session, tags)
                prop_ctx = propagate_attributes(
                    user_id=user_id,
                    session_id=session_id,
                    metadata={
                        "tenant_id": self.tenant_id,
                        "agent_id": agent_id,
                        **(metadata or {}),
                    },
                    trace_name=f"mnemo:{agent_id}",
                    tags=["mnemo", f"agent:{agent_id}", f"tenant:{self.tenant_id}"],
                )
                trace._langfuse_propagation = prop_ctx
                prop_ctx.__enter__()

                # Create the root span for this run
                span_ctx = langfuse.start_as_current_observation(
                    name=f"mnemo.run.{agent_id}",
                    as_type="span",
                    input={"run_id": run_id, "agent_id": agent_id},
                    metadata={"run_id": run_id},
                )
                trace._langfuse_span = span_ctx
                span_ctx.__enter__()

            except Exception as exc:
                self._log(f"Langfuse trace start failed: {exc}")

        # Start OpenTelemetry span
        otel = self._get_otel_tracer()
        if otel:
            try:
                span = otel.start_span(
                    name=f"mnemo.run.{agent_id}",
                    attributes={
                        "mnemo.run_id": run_id,
                        "mnemo.agent_id": agent_id,
                        "mnemo.tenant_id": self.tenant_id,
                        "mnemo.user_id": user_id or "",
                        "mnemo.session_id": session_id or "",
                    },
                )
                trace._otel_span = span
            except Exception as exc:
                self._log(f"OTEL span start failed: {exc}")

        self.log_event(trace, TraceEvent.RUN_START)
        self._log(f"Trace started: run_id={run_id}, agent_id={agent_id}")
        return trace

    def log_event(
        self,
        trace: Trace,
        event: TraceEvent,
        *,
        data: Optional[dict[str, Any]] = None,
    ) -> None:
        """Log an event within a trace."""
        event_record = {
            "event": event.value,
            "timestamp": time.time(),
            "data": data or {},
        }
        trace.events.append(event_record)

        # Log to Langfuse v4 as an event
        langfuse = self._get_langfuse()
        if langfuse and trace._langfuse_span:
            try:
                langfuse.create_event(
                    name=event.value,
                    input=data or {},
                )
            except Exception:
                pass  # Non-critical — don't fail the run for tracing issues

        # Log to OpenTelemetry as a span event
        if trace._otel_span:
            try:
                trace._otel_span.add_event(
                    name=event.value,
                    attributes=_flatten_dict(data or {}),
                )
            except Exception:
                pass

    def end_trace(self, trace: Trace, *, status: str = "success") -> Optional[str]:
        """
        End a trace and flush to all destinations.

        Returns the Langfuse trace URL if available.
        """
        self.log_event(trace, TraceEvent.RUN_END, data={"status": status})

        trace_url: Optional[str] = None

        # Finalize Langfuse v4 span and propagation context
        langfuse = self._get_langfuse()
        if langfuse:
            try:
                # Get trace URL while still inside the span context
                trace_url = langfuse.get_trace_url()

                # End the root span
                if trace._langfuse_span:
                    trace._langfuse_span.__exit__(None, None, None)

                # End the propagation context
                if trace._langfuse_propagation:
                    trace._langfuse_propagation.__exit__(None, None, None)

                langfuse.flush()
            except Exception as exc:
                self._log(f"Langfuse trace end failed: {exc}")

        # End OpenTelemetry span
        if trace._otel_span:
            try:
                trace._otel_span.set_attribute("mnemo.status", status)
                trace._otel_span.set_attribute("mnemo.event_count", len(trace.events))
                trace._otel_span.end()
            except Exception as exc:
                self._log(f"OTEL span end failed: {exc}")

        self._log(f"Trace ended: run_id={trace.run_id}, status={status}")
        return trace_url

    def _log(self, message: str) -> None:
        """Internal debug logging."""
        if self.debug:
            print(f"[mnemo:tracer] {message}")


def _flatten_dict(d: dict[str, Any], prefix: str = "") -> dict[str, str]:
    """Flatten a nested dict for OpenTelemetry attributes (which must be flat)."""
    items: dict[str, str] = {}
    for k, v in d.items():
        key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            items.update(_flatten_dict(v, key))
        else:
            items[key] = str(v)
    return items
