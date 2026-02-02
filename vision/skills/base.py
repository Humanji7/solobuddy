"""
Base Skill — abstract base class and common utilities for all skills.
"""

from abc import ABC, abstractmethod

from vision.core.protocols import Context, SkillResult, LLMProvider

MAX_RESPONSE_LENGTH = 4000  # Telegram limit


class BaseSkill(ABC):
    """
    Abstract base class for Vision skills.

    Provides common validation and output sanitization.
    """

    name: str = "base"
    triggers: list[str] = []

    @abstractmethod
    async def execute(
        self,
        context: Context,
        llm: LLMProvider,
        request_id: str,
    ) -> SkillResult:
        """Execute the skill logic."""
        ...

    def validate_input(self, context: Context) -> bool:
        """Default input validation — require non-empty input."""
        return bool(context.user_input and context.user_input.strip())

    def validate_output(self, result: SkillResult) -> SkillResult:
        """Validate and sanitize output."""
        response = result.response

        # Truncate if too long
        if len(response) > MAX_RESPONSE_LENGTH:
            response = response[: MAX_RESPONSE_LENGTH - 100] + "\n\n[...сообщение обрезано]"
            return SkillResult(
                response=response,
                status=result.status,
                explanation=result.explanation,
                memory_updates=result.memory_updates,
                actions=result.actions,
            )

        return result
