"""
MemoryManager — Mem0-powered memory layer for Mnemo agents.

Handles four types of memory:
- Episodic: What happened in past runs (auto-extracted from completed runs)
- Semantic: Facts about the agent's domain and users (extracted from conversations)
- Pattern: Learned failure modes and success patterns (our moat — built over time)
- In-context: Current session memory (handled by the LLM, not by us)

We don't rebuild Mem0. We orchestrate it — adding tenant isolation, memory typing,
relevance scoring, and automatic extraction on top of Mem0's storage engine.
"""

from __future__ import annotations

import os
from enum import Enum
from typing import Any, Optional


class MemoryType(str, Enum):
    """The four types of agent memory Mnemo manages."""

    EPISODIC = "episodic"
    SEMANTIC = "semantic"
    PATTERN = "pattern"


class MemoryManager:
    """
    Manages agent memory through Mem0.

    Every memory is scoped to a tenant_id (isolation) and an agent_id.
    Optionally scoped to a user_id for per-user personalization.
    """

    def __init__(
        self,
        tenant_id: str,
        *,
        api_key: Optional[str] = None,
        debug: bool = False,
    ) -> None:
        self.tenant_id = tenant_id
        self.debug = debug
        self._api_key = api_key or os.getenv("MNEMO_MEM0_API_KEY")
        self._client: Any = None

    def _get_client(self) -> Any:
        """Lazy-initialize the Mem0 client."""
        if self._client is None:
            try:
                from mem0 import MemoryClient
            except ImportError:
                raise ImportError(
                    "Install the Mem0 SDK: pip install mem0ai"
                )

            if not self._api_key:
                raise ValueError(
                    "Mem0 API key required. Set MNEMO_MEM0_API_KEY or pass mem0_api_key to MnemoClient."
                )

            self._client = MemoryClient(api_key=self._api_key)
        return self._client

    def retrieve(
        self,
        agent_id: str,
        query: str,
        *,
        user_id: Optional[str] = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """
        Retrieve memories relevant to the given query.

        Searches across all memory types (episodic, semantic, pattern)
        and returns them ranked by relevance score.

        Args:
            agent_id: The agent to retrieve memories for.
            query: The query to match memories against (usually the user prompt).
            user_id: Optional user scope for per-user memories.
            limit: Maximum number of memories to return.

        Returns:
            List of memory dicts with keys: text, type, score, created_at, metadata.
        """
        try:
            client = self._get_client()

            # Mem0 v2 requires agent_id/user_id inside a `filters` dict.
            # We scope by agent_id (already prefixed with tenant_id).
            # user_id is encoded into the agent scope to avoid AND-filter
            # issues where Mem0 returns 0 results for combined filters.
            scoped_id = self._scoped_agent_id(agent_id)
            if user_id:
                scoped_id = f"{scoped_id}:user:{user_id}"

            raw_response = client.search(
                query=query,
                filters={"agent_id": scoped_id},
                top_k=limit,
            )

            # Mem0 v2 returns {"results": [...]} dict
            raw_memories = raw_response.get("results", []) if isinstance(raw_response, dict) else raw_response

            memories = []
            for mem in raw_memories:
                memories.append({
                    "id": mem.get("id", ""),
                    "text": mem.get("memory", ""),
                    "type": mem.get("metadata", {}).get("mnemo_type", MemoryType.EPISODIC.value),
                    "score": mem.get("score", 0.0),
                    "created_at": mem.get("created_at", ""),
                    "metadata": mem.get("metadata", {}),
                })

            self._log(f"Retrieved {len(memories)} memories for agent={agent_id}")
            return memories

        except ImportError:
            raise
        except Exception as exc:
            self._log(f"Memory retrieval failed: {exc}")
            return []

    def extract_and_store(
        self,
        agent_id: str,
        prompt: str,
        response: str,
        *,
        user_id: Optional[str] = None,
    ) -> int:
        """
        Extract memories from a completed run and store them.

        Analyzes the prompt-response pair to identify:
        - Episodic memories (what happened in this run)
        - Semantic memories (facts learned about the user/domain)
        - Pattern memories (success/failure patterns)

        Args:
            agent_id: The agent that completed the run.
            prompt: The original user prompt.
            response: The LLM's response.
            user_id: Optional user scope.

        Returns:
            Number of new memories created.
        """
        try:
            client = self._get_client()
            count = 0

            # Store episodic memory — what happened in this run
            conversation = [
                {"role": "user", "content": prompt},
                {"role": "assistant", "content": response},
            ]
            scoped_id = self._scoped_agent_id(agent_id)
            if user_id:
                scoped_id = f"{scoped_id}:user:{user_id}"

            result = client.add(
                messages=conversation,
                agent_id=scoped_id,
                metadata={"mnemo_type": MemoryType.EPISODIC.value, "tenant_id": self.tenant_id},
            )
            if result:
                count = len(result.get("results", []))

            self._log(f"Stored {count} memories for agent={agent_id}")
            return count

        except ImportError:
            raise
        except Exception as exc:
            self._log(f"Memory storage failed: {exc}")
            return 0

    def store_pattern(
        self,
        agent_id: str,
        pattern: str,
        pattern_type: str = "general",
        *,
        metadata: Optional[dict[str, Any]] = None,
    ) -> bool:
        """
        Explicitly store a pattern memory.

        Pattern memories are our moat — they capture failure modes,
        success patterns, and learned behaviors that make agents
        smarter over time.

        Args:
            agent_id: The agent this pattern belongs to.
            pattern: The pattern description.
            pattern_type: Category — "failure", "success", "general".
            metadata: Optional additional metadata.

        Returns:
            True if stored successfully.
        """
        try:
            client = self._get_client()

            mem_metadata = {
                "mnemo_type": MemoryType.PATTERN.value,
                "pattern_type": pattern_type,
                "tenant_id": self.tenant_id,
                **(metadata or {}),
            }

            client.add(
                messages=[{"role": "assistant", "content": pattern}],
                agent_id=self._scoped_agent_id(agent_id),
                metadata=mem_metadata,
            )
            self._log(f"Stored pattern memory for agent={agent_id}: {pattern[:50]}...")
            return True

        except Exception as exc:
            self._log(f"Pattern storage failed: {exc}")
            return False

    def list_memories(
        self,
        agent_id: str,
        *,
        user_id: Optional[str] = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """List all stored memories for an agent."""
        try:
            client = self._get_client()

            scoped_id = self._scoped_agent_id(agent_id)
            if user_id:
                scoped_id = f"{scoped_id}:user:{user_id}"

            raw_response = client.get_all(
                filters={"agent_id": scoped_id},
                page_size=limit,
            )

            # Mem0 v2 returns {"results": [...]} dict
            raw = raw_response.get("results", []) if isinstance(raw_response, dict) else raw_response

            memories = []
            for mem in raw:
                memories.append({
                    "id": mem.get("id", ""),
                    "text": mem.get("memory", ""),
                    "type": mem.get("metadata", {}).get("mnemo_type", MemoryType.EPISODIC.value),
                    "created_at": mem.get("created_at", ""),
                    "metadata": mem.get("metadata", {}),
                })
            return memories

        except Exception as exc:
            self._log(f"Memory listing failed: {exc}")
            return []

    def clear(
        self,
        agent_id: str,
        *,
        user_id: Optional[str] = None,
    ) -> int:
        """Delete all memories for an agent. Returns count deleted."""
        try:
            client = self._get_client()
            memories = self.list_memories(agent_id=agent_id, user_id=user_id, limit=100)

            for mem in memories:
                client.delete(mem["id"])

            self._log(f"Cleared {len(memories)} memories for agent={agent_id}")
            return len(memories)

        except Exception as exc:
            self._log(f"Memory clear failed: {exc}")
            return 0

    def _scoped_agent_id(self, agent_id: str) -> str:
        """Prefix agent_id with tenant_id for multi-tenant isolation."""
        return f"{self.tenant_id}:{agent_id}"

    def _scoped_user_id(self, user_id: str) -> str:
        """Prefix user_id with tenant_id for multi-tenant isolation."""
        return f"{self.tenant_id}:{user_id}"

    def _log(self, message: str) -> None:
        """Internal debug logging."""
        if self.debug:
            print(f"[mnemo:memory] {message}")
