"""SSE (Server-Sent Events) helpers for streaming analysis phases."""
from __future__ import annotations

import json
from typing import Any


def format_sse(data: dict[str, Any], event: str | None = None) -> str:
    """Format a dictionary as an SSE message string."""
    lines: list[str] = []
    if event:
        lines.append(f"event: {event}")
    payload = json.dumps(data, default=str)
    lines.append(f"data: {payload}")
    lines.append("")
    lines.append("")
    return "\n".join(lines)


def phase_event(
    phase: int,
    status: str,
    title: str,
    output: dict[str, Any] | None = None,
    error: str | None = None,
) -> str:
    """Build an SSE message for a pipeline phase update."""
    payload: dict[str, Any] = {
        "phase": phase,
        "status": status,
        "title": title,
    }
    if output is not None:
        payload["output"] = output
    if error is not None:
        payload["error"] = error
    return format_sse(payload, event="phase")


def complete_event(result: dict[str, Any]) -> str:
    """Build the final SSE message when the entire pipeline finishes."""
    return format_sse({"status": "complete", "result": result}, event="complete")


def error_event(phase: int, title: str, message: str) -> str:
    """Build an SSE error message."""
    return phase_event(phase, status="error", title=title, error=message)
