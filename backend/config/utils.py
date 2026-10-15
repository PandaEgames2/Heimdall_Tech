from __future__ import annotations

from typing import Any


def normalize_email(value: str | None) -> str:
    if not value:
        return ""
    return value.strip().lower()


def build_cache_key(prefix: str, *parts: Any) -> str:
    return ":".join([prefix, *[str(part) for part in parts]])
