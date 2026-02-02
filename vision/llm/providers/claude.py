"""
Claude LLM Provider — primary provider using Anthropic API.
"""

import base64
import time
from pathlib import Path

import anthropic
import structlog

from vision.core.protocols import LLMResponse

logger = structlog.get_logger()

DEFAULT_MODEL = "claude-sonnet-4-20250514"


class ClaudeProvider:
    """
    Anthropic Claude provider.

    Supports text and vision (image) inputs.
    """

    name = "claude"

    def __init__(self, api_key: str | None = None, model: str = DEFAULT_MODEL):
        self._client = anthropic.AsyncAnthropic(api_key=api_key)
        self._model = model

    async def complete(
        self,
        messages: list[dict[str, str]],
        system: str | None = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ) -> LLMResponse:
        """Generate completion from messages."""
        start = time.perf_counter()

        kwargs = {
            "model": self._model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": messages,
        }
        if system:
            kwargs["system"] = system

        response = await self._client.messages.create(**kwargs)

        latency = (time.perf_counter() - start) * 1000
        content = response.content[0].text if response.content else ""

        logger.debug(
            "claude_completion",
            model=self._model,
            tokens=response.usage.input_tokens + response.usage.output_tokens,
            latency_ms=round(latency),
        )

        return LLMResponse(
            content=content,
            model=self._model,
            tokens_used=response.usage.input_tokens + response.usage.output_tokens,
            latency_ms=latency,
            provider=self.name,
        )

    async def complete_with_vision(
        self,
        messages: list[dict],
        image_path: str,
        system: str | None = None,
        max_tokens: int = 1024,
    ) -> LLMResponse:
        """Generate completion with image input."""
        start = time.perf_counter()

        # Read and encode image
        path = Path(image_path)
        if not path.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")

        image_data = base64.standard_b64encode(path.read_bytes()).decode("utf-8")
        media_type = self._get_media_type(path.suffix)

        # Build message with image
        vision_messages = []
        for msg in messages:
            if msg["role"] == "user" and "{image}" in msg.get("content", ""):
                # Replace {image} placeholder with actual image block
                vision_messages.append({
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_data,
                            },
                        },
                        {
                            "type": "text",
                            "text": msg["content"].replace("{image}", "").strip() or "Describe this image.",
                        },
                    ],
                })
            else:
                vision_messages.append(msg)

        kwargs = {
            "model": self._model,
            "max_tokens": max_tokens,
            "messages": vision_messages,
        }
        if system:
            kwargs["system"] = system

        response = await self._client.messages.create(**kwargs)

        latency = (time.perf_counter() - start) * 1000
        content = response.content[0].text if response.content else ""

        logger.debug(
            "claude_vision_completion",
            model=self._model,
            tokens=response.usage.input_tokens + response.usage.output_tokens,
            latency_ms=round(latency),
        )

        return LLMResponse(
            content=content,
            model=self._model,
            tokens_used=response.usage.input_tokens + response.usage.output_tokens,
            latency_ms=latency,
            provider=self.name,
        )

    def _get_media_type(self, suffix: str) -> str:
        """Get MIME type from file extension."""
        types = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".webp": "image/webp",
        }
        return types.get(suffix.lower(), "image/jpeg")

    async def close(self) -> None:
        """Cleanup resources."""
        await self._client.close()

    def is_available(self) -> bool:
        """Always available (circuit breaker handles failures)."""
        return True
