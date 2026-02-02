"""
Circuit Breaker — prevents cascading failures when LLM providers are down.

States:
- CLOSED: Normal operation, requests pass through
- OPEN: Provider is failing, requests are rejected immediately
- HALF_OPEN: Testing if provider recovered
"""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Callable, TypeVar

import structlog

logger = structlog.get_logger()

T = TypeVar("T")


class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitOpenError(Exception):
    """Circuit is open, request rejected."""


@dataclass
class CircuitBreaker:
    """
    Circuit breaker for LLM provider failover.

    Args:
        name: Provider name for logging
        failure_threshold: Failures before opening circuit
        recovery_timeout: Seconds before trying again (half-open)
        success_threshold: Successes in half-open before closing
    """

    name: str
    failure_threshold: int = 3
    recovery_timeout: float = 30.0
    success_threshold: int = 2

    _state: CircuitState = field(default=CircuitState.CLOSED, init=False)
    _failure_count: int = field(default=0, init=False)
    _success_count: int = field(default=0, init=False)
    _last_failure_time: datetime | None = field(default=None, init=False)
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock, init=False)

    @property
    def state(self) -> CircuitState:
        return self._state

    @property
    def is_available(self) -> bool:
        """Check if circuit allows requests."""
        if self._state == CircuitState.CLOSED:
            return True
        if self._state == CircuitState.OPEN:
            return self._should_attempt_reset()
        return True  # HALF_OPEN allows test requests

    def _should_attempt_reset(self) -> bool:
        """Check if enough time passed to try half-open."""
        if self._last_failure_time is None:
            return True
        elapsed = datetime.now() - self._last_failure_time
        return elapsed >= timedelta(seconds=self.recovery_timeout)

    async def call(self, func: Callable[[], T]) -> T:
        """
        Execute function through circuit breaker.

        Raises CircuitOpenError if circuit is open and not ready to retry.
        """
        async with self._lock:
            if self._state == CircuitState.OPEN:
                if self._should_attempt_reset():
                    self._state = CircuitState.HALF_OPEN
                    self._success_count = 0
                    logger.info("circuit_half_open", provider=self.name)
                else:
                    raise CircuitOpenError(f"Circuit open for {self.name}")

        try:
            result = await func()
            await self._on_success()
            return result
        except Exception as e:
            await self._on_failure(e)
            raise

    async def _on_success(self) -> None:
        """Handle successful call."""
        async with self._lock:
            if self._state == CircuitState.HALF_OPEN:
                self._success_count += 1
                if self._success_count >= self.success_threshold:
                    self._state = CircuitState.CLOSED
                    self._failure_count = 0
                    logger.info("circuit_closed", provider=self.name)
            else:
                self._failure_count = 0

    async def _on_failure(self, error: Exception) -> None:
        """Handle failed call."""
        async with self._lock:
            self._failure_count += 1
            self._last_failure_time = datetime.now()

            if self._state == CircuitState.HALF_OPEN:
                self._state = CircuitState.OPEN
                logger.warning("circuit_reopened", provider=self.name, error=str(error))
            elif self._failure_count >= self.failure_threshold:
                self._state = CircuitState.OPEN
                logger.warning(
                    "circuit_opened",
                    provider=self.name,
                    failures=self._failure_count,
                    error=str(error),
                )

    def reset(self) -> None:
        """Manually reset circuit to closed state."""
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time = None
