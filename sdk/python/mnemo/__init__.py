"""
Mnemo — Memory and observability for AI agents.

Every AI framework teaches agents to think. Nobody taught them to remember. Until now.

Usage:
    from mnemo import MnemoClient

    mnemo = MnemoClient(tenant_id="your-tenant")
    response = mnemo.run(agent_id="my-agent", prompt="Hello, world!")
"""

from mnemo.client import MnemoClient
from mnemo.memory import MemoryManager
from mnemo.tracer import Tracer
from mnemo.alerts import AlertEngine
from mnemo.compliance import ComplianceLayer

__version__ = "0.1.0"
__all__ = [
    "MnemoClient",
    "MemoryManager",
    "Tracer",
    "AlertEngine",
    "ComplianceLayer",
]
