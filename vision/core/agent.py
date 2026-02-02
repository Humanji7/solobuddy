"""
Vision Agent — main event loop with graceful shutdown and message handling.

The agent orchestrates:
- Telegram message stream
- Intent routing to skills
- Context building and memory
- LLM interactions
"""

import asyncio
import signal
from typing import Callable, Any

import structlog

from vision.core.protocols import Message, Context, SkillResult, Skill, TelegramClient
from vision.data.database import Database
from vision.llm.client import LLMClient

logger = structlog.get_logger()

MESSAGE_TIMEOUT = 60.0  # seconds
SHUTDOWN_TIMEOUT = 30.0  # seconds


class VisionAgent:
    """
    Main Vision agent with graceful shutdown and parallel message processing.

    Features:
    - Async message stream from Telegram
    - Parallel message handling (non-blocking)
    - Timeout protection per message
    - Graceful shutdown on SIGTERM/SIGINT
    - Structured logging
    """

    def __init__(
        self,
        telegram: TelegramClient,
        llm: LLMClient,
        db: Database,
        skills: dict[str, Skill],
        router: Callable[[str, Context], str] | None = None,
    ):
        self.telegram = telegram
        self.llm = llm
        self.db = db
        self.skills = skills
        self._router = router or self._default_router

        self._shutdown = asyncio.Event()
        self._tasks: set[asyncio.Task] = set()

    async def run(self) -> None:
        """
        Main event loop.

        Streams messages from Telegram and processes them in parallel.
        Handles graceful shutdown on signals.
        """
        self._setup_signal_handlers()
        logger.info("agent_started", skills=list(self.skills.keys()))

        try:
            async for message in self.telegram.stream():
                if self._shutdown.is_set():
                    break

                task = asyncio.create_task(
                    self._handle_message_safe(message),
                    name=f"msg-{message.id}",
                )
                self._tasks.add(task)
                task.add_done_callback(self._tasks.discard)

        except asyncio.CancelledError:
            logger.info("agent_cancelled")
        finally:
            await self._cleanup()

    def shutdown(self) -> None:
        """Trigger graceful shutdown."""
        if not self._shutdown.is_set():
            logger.info("shutdown_requested")
            self._shutdown.set()

    # -------------------------------------------------------------------------
    # Message Handling
    # -------------------------------------------------------------------------

    async def _handle_message_safe(self, message: Message) -> None:
        """Handle message with timeout and error protection."""
        log = logger.bind(message_id=message.id, user_id=message.user_id)

        try:
            await asyncio.wait_for(
                self._handle_message(message),
                timeout=MESSAGE_TIMEOUT,
            )
        except asyncio.TimeoutError:
            log.error("message_timeout", timeout=MESSAGE_TIMEOUT)
            await self._send_error(message, "⏱ Таймаут, попробуй ещё раз")
        except Exception as e:
            log.exception("message_failed", error=str(e))
            await self._send_error(message, "❌ Ошибка, попробуй ещё раз")

    async def _handle_message(self, message: Message) -> None:
        """Core message processing logic."""
        log = logger.bind(message_id=message.id)

        # 1. Preprocess (voice/image → text)
        text = await self._preprocess(message)
        if not text:
            log.warning("empty_message_text")
            return

        # 2. Build context
        session_id = self._get_session_id(message.user_id)
        context = await self._build_context(text, message, session_id)

        # 3. Route to skill
        skill_name = await self._route(text, context)
        skill = self.skills.get(skill_name)

        if not skill:
            log.warning("skill_not_found", skill=skill_name)
            skill = self.skills.get("chat")  # fallback
            if not skill:
                await self._send_error(message, "Skill not found")
                return

        log.info("skill_selected", skill=skill_name)

        # 4. Validate input
        if not skill.validate_input(context):
            log.warning("input_validation_failed", skill=skill_name)
            await self.telegram.send(
                "Не понял запрос. Попробуй переформулировать.",
                message_id=message.id,
            )
            return

        # 5. Execute skill
        result = await skill.execute(context, self.llm, request_id=message.id)

        # 6. Validate output
        result = skill.validate_output(result)

        # 7. Save conversation
        await self._save_conversation(text, result.response, session_id, message.message_type)

        # 8. Update memory if requested
        if result.memory_updates:
            await self._update_memory(result.memory_updates)

        # 9. Send response
        await self.telegram.send(result.response, message_id=message.id)

        log.info(
            "message_processed",
            skill=skill_name,
            status=result.status,
        )

    # -------------------------------------------------------------------------
    # Helpers
    # -------------------------------------------------------------------------

    async def _preprocess(self, message: Message) -> str:
        """Convert voice/image to text, or return text as-is."""
        if message.text:
            return message.text

        if message.voice_file:
            # TODO: Whisper integration
            logger.debug("voice_message_received", file=message.voice_file)
            return "[Voice message - Whisper integration pending]"

        if message.image_file:
            # Image will be processed by vision-capable skill
            logger.debug("image_message_received", file=message.image_file)
            return "[Image attached]"

        return ""

    def _get_session_id(self, user_id: str) -> str:
        """Generate session ID for conversation tracking."""
        # Simple implementation: one session per user
        return f"session_{user_id}"

    async def _build_context(
        self,
        text: str,
        message: Message,
        session_id: str,
    ) -> Context:
        """Build execution context with memory and history."""
        # Load recent conversation history
        history = await self.db.fetch_all(
            """
            SELECT role, content FROM conversations
            WHERE session_id = ?
            ORDER BY created_at DESC
            LIMIT 10
            """,
            (session_id,),
        )
        history = list(reversed(history))  # chronological order

        # Load relevant memory
        memory = await self.db.fetch_all(
            """
            SELECT type, content, importance FROM memory
            WHERE importance >= 5
            ORDER BY importance DESC
            LIMIT 20
            """,
        )

        return Context(
            user_input=text,
            session_id=session_id,
            message=message,
            memory=memory,
            conversation_history=[{"role": h["role"], "content": h["content"]} for h in history],
        )

    async def _route(self, text: str, context: Context) -> str:
        """Determine which skill should handle the message."""
        if callable(self._router):
            if asyncio.iscoroutinefunction(self._router):
                return await self._router(text, context)
            return self._router(text, context)
        return "chat"

    def _default_router(self, text: str, context: Context) -> str:
        """Simple keyword-based router (placeholder for LLM router)."""
        text_lower = text.lower()

        # Pattern matching
        patterns = {
            "content_gen": ["напиши", "создай", "пост про", "твит про", "сгенерируй"],
            "idea_bank": ["сохрани", "запомни", "идея:", "идеи про"],
            "dashboard": ["статистика", "метрики", "как дела", "прогресс"],
            "autopsy": ["разбери", "что не так", "почему не зашло"],
        }

        for skill, keywords in patterns.items():
            if any(kw in text_lower for kw in keywords):
                return skill

        return "chat"

    async def _save_conversation(
        self,
        user_text: str,
        assistant_text: str,
        session_id: str,
        message_type: str,
    ) -> None:
        """Save conversation to database."""
        await self.db.insert("conversations", {
            "session_id": session_id,
            "role": "user",
            "content": user_text,
            "message_type": message_type,
        })
        await self.db.insert("conversations", {
            "session_id": session_id,
            "role": "assistant",
            "content": assistant_text,
            "message_type": "text",
        })

    async def _update_memory(self, updates: list[tuple[str, str, int]]) -> None:
        """Update memory with new facts."""
        for mem_type, content, importance in updates:
            await self.db.insert("memory", {
                "type": mem_type,
                "content": content,
                "importance": importance,
            })
            logger.debug("memory_updated", type=mem_type, importance=importance)

    async def _send_error(self, message: Message, text: str) -> None:
        """Send error message to user."""
        try:
            await self.telegram.send(text, message_id=message.id)
        except Exception as e:
            logger.error("failed_to_send_error", error=str(e))

    # -------------------------------------------------------------------------
    # Lifecycle
    # -------------------------------------------------------------------------

    def _setup_signal_handlers(self) -> None:
        """Setup handlers for graceful shutdown."""
        loop = asyncio.get_running_loop()

        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(sig, self.shutdown)

    async def _cleanup(self) -> None:
        """Graceful shutdown: wait for pending tasks, close connections."""
        logger.info("agent_shutting_down", pending_tasks=len(self._tasks))

        # Wait for pending message handlers
        if self._tasks:
            done, pending = await asyncio.wait(
                self._tasks,
                timeout=SHUTDOWN_TIMEOUT,
            )
            if pending:
                logger.warning("cancelling_pending_tasks", count=len(pending))
                for task in pending:
                    task.cancel()

        # Close connections
        await self.llm.close()
        await self.telegram.close()
        await self.db.close()

        logger.info("agent_stopped")
