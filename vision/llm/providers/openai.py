"""
OpenAI LLM Provider — fallback provider.
"""

import base64
import time
from pathlib import Path

import openai
import structlog

from vision.core.protocols import LLMResponse

logger = structlog.get_logger()

DEFAULT_MODEL = "gpt-4o"


class OpenAIProvider:
    """
    OpenAI provider as fallback when Claude is unavailable.

    Supports text and vision inputs.
    """

    name = "openai"

    def __init__(self, api_key: str | None = None, model: str = DEFAULT_MODEL):
        self._client = openai.AsyncOpenAI(api_key=api_key)
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

        # OpenAI uses system message in messages list
        full_messages = []
        if system:
            full_messages.append({"role": "system", "content": system})
        full_messages.extend(messages)

        response = await self._client.chat.completions.create(
            model=self._model,
            messages=full_messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )

        latency = (time.perf_counter() - start) * 1000
        content = response.choices[0].message.content or ""
        tokens = response.usage.total_tokens if response.usage else 0

        logger.debug(
            "openai_completion",
            model=self._model,
            tokens=tokens,
            latency_ms=round(latency),
        )

        return LLMResponse(
            content=content,
            model=self._model,
            tokens_used=tokens,
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

        # Build messages with image
        full_messages = []
        if system:
            full_messages.append({"role": "system", "content": system})

        for msg in messages:
            if msg["role"] == "user" and "{image}" in msg.get("content", ""):
                # Replace {image} placeholder with image URL
                text = msg["content"].replace("{image}", "").strip() or "Describe this image."
                full_messages.append({
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{media_type};base64,{image_data}",
                            },
                        },
                        {"type": "text", "text": text},
                    ],
                })
            else:
                full_messages.append(msg)

        response = await self._client.chat.completions.create(
            model=self._model,
            messages=full_messages,
            max_tokens=max_tokens,
        )

        latency = (time.perf_counter() - start) * 1000
        content = response.choices[0].message.content or ""
        tokens = response.usage.total_tokens if response.usage else 0

        logger.debug(
            "openai_vision_completion",
            model=self._model,
            tokens=tokens,
            latency_ms=round(latency),
        )

        return LLMResponse(
            content=content,
            model=self._model,
            tokens_used=tokens,
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
