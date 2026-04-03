"""
Mnemo — Memory and observability for AI agents.

Every AI framework teaches agents to think. Nobody taught them to remember. Until now.

Usage:
    from mnemo import MnemoClient

    mnemo = MnemoClient(tenant_id="your-tenant")
    response = mnemo.run(agent_id="my-agent", prompt="Hello, world!")
"""

__version__ = "0.1.1"

# Core — always available
from mnemo.client import MnemoClient, LLMConfig, RunResult

# Optional subsystems — import gracefully if deps missing
try:
    from mnemo.memory import MemoryManager
except ImportError:
    MemoryManager = None  # type: ignore

try:
    from mnemo.tracer import Tracer
except ImportError:
    Tracer = None  # type: ignore

try:
    from mnemo.alerts import AlertEngine
except ImportError:
    AlertEngine = None  # type: ignore

try:
    from mnemo.compliance import ComplianceLayer
except ImportError:
    ComplianceLayer = None  # type: ignore

__all__ = [
    "MnemoClient",
    "LLMConfig",
    "RunResult",
    "MemoryManager",
    "Tracer",
    "AlertEngine",
    "ComplianceLayer",
]
