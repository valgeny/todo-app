"""Thin HTTP client for the To-Do List REST API."""

from __future__ import annotations

import json
import os
from typing import Any

import httpx


class TodoApiError(Exception):
    def __init__(self, status: int, body: str) -> None:
        self.status = status
        self.body = body
        super().__init__(f"Todo API {status}: {body[:500]}")


def get_api_origin() -> str:
    return os.environ.get("TODO_API_ORIGIN", "http://127.0.0.1:8000").rstrip("/")


def request(method: str, path: str, body: dict[str, Any] | None = None) -> Any:
    url = f"{get_api_origin()}{path}"
    headers = {"Accept": "application/json"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    with httpx.Client(timeout=30.0) as client:
        response = client.request(
            method,
            url,
            headers=headers,
            content=None if body is None else json.dumps(body),
        )
    if response.status_code == 204:
        return None
    text = response.text
    if not response.is_success:
        raise TodoApiError(response.status_code, text or response.reason_phrase)
    if not text:
        return None
    return response.json()
