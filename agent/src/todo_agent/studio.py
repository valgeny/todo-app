"""Compiled graph export for LangSmith Studio (`langgraph dev`).

Builds the MCP-backed agent at import time so Studio can attach to a local
Agent Server. Load env from agent/config before importing this module
(langgraph.json `env` field), or export TODO_MCP_URL yourself.
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv

_config = Path(__file__).resolve().parents[2] / "config"
load_dotenv(_config / ".env")
load_dotenv(_config / ".env.local")
load_dotenv(_config / ".env.local2sandbox", override=False)

# Empty dotenv values should not force AI Studio path
if not (os.environ.get("GOOGLE_API_KEY") or "").strip():
    os.environ.pop("GOOGLE_API_KEY", None)

from todo_agent.graph import build_agent_async  # noqa: E402

graph = asyncio.run(build_agent_async())
