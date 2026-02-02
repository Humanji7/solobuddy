"""
Chat Skill — fallback conversational skill for general dialogue.
"""

from pathlib import Path

import structlog

from vision.core.protocols import Context, SkillResult, LLMProvider
from vision.skills.base import BaseSkill

logger = structlog.get_logger()

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


class ChatSkill(BaseSkill):
    """
    Fallback skill for general conversation.

    Handles messages that don't match any specific skill pattern.
    Uses system prompt for personality and tone.
    """

    name = "chat"
    triggers = []  # Fallback, no specific triggers

    def __init__(self):
        self._system_prompt = self._load_system_prompt()

    def _load_system_prompt(self) -> str:
        """Load system prompt from file."""
        prompt_file = PROMPTS_DIR / "system.md"
        if prompt_file.exists():
            return prompt_file.read_text()
        return "You are Vision, a helpful AI assistant for content creators."

    async def execute(
        self,
        context: Context,
        llm: LLMProvider,
        request_id: str,
    ) -> SkillResult:
        """Generate conversational response."""
        # Build messages from conversation history
        messages = []

        # Add conversation history
        for msg in context.conversation_history[-6:]:  # Last 6 messages
            messages.append(msg)

        # Add current user message
        messages.append({"role": "user", "content": context.user_input})

        # Add memory context to system prompt
        system = self._system_prompt
        if context.memory:
            memory_context = "\n\nКонтекст о пользователе:\n"
            for mem in context.memory[:5]:
                memory_context += f"- [{mem['type']}] {mem['content']}\n"
            system += memory_context

        try:
            response = await llm.complete(
                messages=messages,
                system=system,
                max_tokens=1024,
                temperature=0.7,
            )

            return SkillResult(
                response=response.content,
                status="success",
            )

        except Exception as e:
            logger.error("chat_skill_failed", error=str(e), request_id=request_id)
            return SkillResult(
                response="Извини, что-то пошло не так. Попробуй ещё раз.",
                status="error",
            )
