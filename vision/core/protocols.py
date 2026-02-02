"""
Vision Core Protocols — typed contracts for skills, LLM providers, and data structures.

Defines the interfaces that all components must implement.
"""

from dataclasses import dataclass, field
from typing import Protocol, Literal, Any
from datetime import datetime


# =============================================================================
# Data Structures
# =============================================================================

@dataclass(frozen=True, slots=True)
class Message:
    """Incoming message from Telegram."""
    id: str
    user_id: str
    text: str | None = None
    voice_file: str | None = None
    image_file: str | None = None
    reply_to: str | None = None
    timestamp: datetime = field(default_factory=datetime.now)

    @property
    def message_type(self) -> Literal["text", "voice", "image"]:
        if self.voice_file:
            return "voice"
        if self.image_file:
            return "image"
        return "text"


@dataclass(slots=True)
class Context:
    """Execution context for skills."""
    user_input: str
    session_id: str
    message: Message
    memory: list[dict[str, Any]] = field(default_factory=list)
    conversation_history: list[dict[str, str]] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class SkillResult:
    """Result returned by skill execution."""
    response: str
    status: Literal["success", "partial", "error"]
    explanation: str | None = None
    memory_updates: list[tuple[str, str, int]] | None = None  # (type, content, importance)
    actions: list[dict[str, Any]] | None = None


@dataclass(frozen=True, slots=True)
class LLMResponse:
    """Response from LLM provider."""
    content: str
    model: str
    tokens_used: int
    latency_ms: float
    provider: str


# =============================================================================
# Protocols (Interfaces)
# =============================================================================

class Skill(Protocol):
    """
    Contract for all Vision skills.

    Skills are the core building blocks — each handles a specific capability
    (content generation, idea bank, authenticity check, etc.).
    """

    name: str
    triggers: list[str]  # Keywords/patterns that activate this skill

    async def execute(
        self,
        context: Context,
        llm: "LLMProvider",
        request_id: str,
    ) -> SkillResult:
        """Execute the skill with given context."""
        ...

    def validate_input(self, context: Context) -> bool:
        """Check if input is valid for this skill."""
        ...

    def validate_output(self, result: SkillResult) -> SkillResult:
        """Validate and potentially sanitize the output."""
        ...


class LLMProvider(Protocol):
    """
    Contract for LLM providers (Claude, OpenAI).

    Supports multi-provider setup with circuit breaker for failover.
    """

    name: str

    async def complete(
        self,
        messages: list[dict[str, str]],
        system: str | None = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ) -> LLMResponse:
        """Generate completion from messages."""
        ...

    async def complete_with_vision(
        self,
        messages: list[dict[str, Any]],
        image_url: str,
        system: str | None = None,
        max_tokens: int = 1024,
    ) -> LLMResponse:
        """Generate completion with image input (Claude Vision)."""
        ...

    async def close(self) -> None:
        """Cleanup resources."""
        ...

    def is_available(self) -> bool:
        """Check if provider is currently available (circuit breaker)."""
        ...


class Router(Protocol):
    """
    Contract for intent router.

    Determines which skill should handle the incoming message.
    """

    async def classify(
        self,
        text: str,
        context: Context,
    ) -> str:
        """Return skill name that should handle this input."""
        ...


class TelegramClient(Protocol):
    """Contract for Telegram integration."""

    async def stream(self) -> "AsyncIterator[Message]":
        """Stream incoming messages."""
        ...

    async def send(
        self,
        text: str,
        message_id: str | None = None,
        buttons: list[list[str]] | None = None,
    ) -> None:
        """Send message to user."""
        ...

    async def close(self) -> None:
        """Cleanup resources."""
        ...


class Repository(Protocol):
    """Base contract for data repositories."""

    async def get(self, id: int) -> dict[str, Any] | None:
        ...

    async def create(self, data: dict[str, Any]) -> int:
        ...

    async def update(self, id: int, data: dict[str, Any]) -> bool:
        ...

    async def delete(self, id: int) -> bool:
        ...


# =============================================================================
# Type Aliases
# =============================================================================

SkillName = Literal[
    "content_gen",
    "idea_bank",
    "authenticity",
    "autopsy",
    "dashboard",
    "chat",
]

Platform = Literal["twitter", "linkedin", "threads", "telegram"]

MemoryType = Literal["strategy", "tone_of_voice", "fact", "preference"]

IdeaStatus = Literal["new", "used", "archived"]

PostStatus = Literal["draft", "published", "failed"]

AuthenticityResult = Literal["pass", "warning", "fail"]
