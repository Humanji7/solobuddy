"""
Vision LLM Client — multi-provider client with automatic failover.

Claude is primary, OpenAI is fallback. Circuit breaker prevents cascading failures.
"""

import structlog

from vision.core.protocols import LLMResponse
from vision.llm.circuit_breaker import CircuitBreaker, CircuitOpenError
from vision.llm.providers.claude import ClaudeProvider
from vision.llm.providers.openai import OpenAIProvider

logger = structlog.get_logger()


class LLMError(Exception):
    """All LLM providers failed."""


class LLMClient:
    """
    Multi-provider LLM client with failover.

    Uses Claude as primary provider, falls back to OpenAI if Claude fails.
    Circuit breakers prevent hammering failing providers.
    """

    def __init__(
        self,
        claude_api_key: str | None = None,
        openai_api_key: str | None = None,
        claude_model: str | None = None,
        openai_model: str | None = None,
    ):
        self._providers: list[tuple] = []
        self._claude = None
        self._openai = None

        # Initialize Claude (primary) if key available
        if claude_api_key:
            self._claude = ClaudeProvider(
                api_key=claude_api_key,
                model=claude_model or "claude-sonnet-4-20250514",
            )
            claude_cb = CircuitBreaker(name="claude", failure_threshold=3, recovery_timeout=60.0)
            self._providers.append((self._claude, claude_cb))
            logger.info("llm_provider_initialized", provider="claude")

        # Initialize OpenAI (fallback) if key available
        if openai_api_key:
            self._openai = OpenAIProvider(
                api_key=openai_api_key,
                model=openai_model or "gpt-4o",
            )
            openai_cb = CircuitBreaker(name="openai", failure_threshold=3, recovery_timeout=60.0)
            self._providers.append((self._openai, openai_cb))
            logger.info("llm_provider_initialized", provider="openai")

        if not self._providers:
            logger.warning("no_llm_providers", hint="Set ANTHROPIC_API_KEY or OPENAI_API_KEY")

    async def complete(
        self,
        messages: list[dict[str, str]],
        system: str | None = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ) -> LLMResponse:
        """
        Generate completion with automatic failover.

        Tries Claude first, falls back to OpenAI if Claude fails.
        """
        last_error: Exception | None = None

        for provider, circuit in self._providers:
            if not circuit.is_available:
                logger.debug("provider_skipped_circuit_open", provider=provider.name)
                continue

            try:
                return await circuit.call(
                    lambda p=provider: p.complete(
                        messages=messages,
                        system=system,
                        max_tokens=max_tokens,
                        temperature=temperature,
                    )
                )
            except CircuitOpenError:
                continue
            except Exception as e:
                last_error = e
                logger.warning(
                    "provider_failed",
                    provider=provider.name,
                    error=str(e),
                )
                continue

        raise LLMError(f"All providers failed. Last error: {last_error}")

    async def complete_with_vision(
        self,
        messages: list[dict],
        image_path: str,
        system: str | None = None,
        max_tokens: int = 1024,
    ) -> LLMResponse:
        """
        Generate completion with image input and automatic failover.
        """
        last_error: Exception | None = None

        for provider, circuit in self._providers:
            if not circuit.is_available:
                logger.debug("provider_skipped_circuit_open", provider=provider.name)
                continue

            try:
                return await circuit.call(
                    lambda p=provider: p.complete_with_vision(
                        messages=messages,
                        image_path=image_path,
                        system=system,
                        max_tokens=max_tokens,
                    )
                )
            except CircuitOpenError:
                continue
            except Exception as e:
                last_error = e
                logger.warning(
                    "provider_vision_failed",
                    provider=provider.name,
                    error=str(e),
                )
                continue

        raise LLMError(f"All providers failed for vision. Last error: {last_error}")

    async def close(self) -> None:
        """Close all provider connections."""
        if self._claude:
            await self._claude.close()
        if self._openai:
            await self._openai.close()
        logger.info("llm_client_closed")

    def is_available(self) -> bool:
        """Check if at least one provider is available."""
        return any(cb.is_available for _, cb in self._providers)

    @property
    def primary_provider(self) -> str:
        """Return name of currently active primary provider."""
        for provider, circuit in self._providers:
            if circuit.is_available:
                return provider.name
        return "none"
