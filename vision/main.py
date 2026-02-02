"""
Vision AI Assistant — Entry Point

Usage:
    uv run python -m vision.main
    # or
    vision  # if installed as package
"""

import asyncio
import os
import sys
from pathlib import Path

import structlog

from vision.core.agent import VisionAgent
from vision.data.database import Database
from vision.llm.client import LLMClient
from vision.skills.chat import ChatSkill
from vision.utils.logging import setup_logging

# Project root
PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
MIGRATIONS_DIR = Path(__file__).parent / "data" / "migrations"

logger = structlog.get_logger()


class StubTelegramClient:
    """
    Stub Telegram client for testing.

    Replace with real MCP-based client in Phase 3.
    """

    async def stream(self):
        """Yield test messages (for development only)."""
        from vision.core.protocols import Message

        logger.info("stub_telegram_waiting", hint="Press Enter to send test message, Ctrl+C to exit")

        while True:
            try:
                # Read from stdin for testing
                loop = asyncio.get_event_loop()
                text = await loop.run_in_executor(None, input, "You: ")

                if not text.strip():
                    continue

                yield Message(
                    id=f"test_{asyncio.get_event_loop().time()}",
                    user_id="test_user",
                    text=text,
                )
            except EOFError:
                break

    async def send(self, text: str, message_id: str | None = None, buttons=None) -> None:
        """Print response to stdout."""
        print(f"\nVision: {text}\n")

    async def close(self) -> None:
        """Cleanup."""
        pass


async def main() -> int:
    """Main entry point."""
    # Setup logging
    json_output = os.getenv("VISION_JSON_LOGS", "").lower() == "true"
    setup_logging(json_output=json_output, level="DEBUG")

    logger.info("vision_starting", version="0.1.0")

    # Initialize database
    db = Database(DATA_DIR / "bip.db")
    await db.connect()

    # Run migrations
    try:
        applied = await db.migrate(MIGRATIONS_DIR)
        if applied:
            logger.info("migrations_applied", count=applied)
    except Exception as e:
        logger.error("migration_failed", error=str(e))
        await db.close()
        return 1

    # Initialize LLM client
    llm = LLMClient(
        claude_api_key=os.getenv("ANTHROPIC_API_KEY"),
        openai_api_key=os.getenv("OPENAI_API_KEY"),
    )

    # Initialize skills
    skills = {
        "chat": ChatSkill(),
        # TODO: Add more skills in Phase 2
        # "content_gen": ContentGenSkill(),
        # "idea_bank": IdeaBankSkill(),
    }

    # Initialize Telegram client (stub for now)
    telegram = StubTelegramClient()

    # Create and run agent
    agent = VisionAgent(
        telegram=telegram,
        llm=llm,
        db=db,
        skills=skills,
    )

    try:
        await agent.run()
    except KeyboardInterrupt:
        logger.info("keyboard_interrupt")
        agent.shutdown()

    return 0


def main_sync() -> None:
    """Synchronous wrapper for entry point."""
    sys.exit(asyncio.run(main()))


if __name__ == "__main__":
    main_sync()
