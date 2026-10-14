"""Load LangChain tools from a remote MCP server (Streamable HTTP).

Discovery (default): langchain-mcp-adapters MultiServerMCPClient.get_tools()
  → MCP tools/list over streamable HTTP; session-per-call (Cloud Run–friendly).

Alternative (not wired): mcp SDK streamablehttp_client + load_mcp_tools(session)
  → one long-lived session for stateful MCP servers.
"""

from __future__ import annotations

import os
from typing import Any

from langchain_core.tools import BaseTool


def get_mcp_url() -> str:
    raw = (os.environ.get("TODO_MCP_URL") or "").strip().rstrip("/")
    if not raw:
        raise ValueError(
            "TODO_MCP_URL is required (Streamable HTTP MCP endpoint, e.g. https://…/mcp)"
        )
    return raw


def _strip_gemini_unsupported_keys(node: Any) -> Any:
    """Remove JSON Schema keys Gemini / langchain-google-genai reject (e.g. $schema)."""
    if isinstance(node, dict):
        return {
            key: _strip_gemini_unsupported_keys(value)
            for key, value in node.items()
            if key not in {"$schema", "definitions"}
        }
    if isinstance(node, list):
        return [_strip_gemini_unsupported_keys(item) for item in node]
    return node


def _schema_as_dict(schema: Any) -> dict[str, Any] | None:
    if isinstance(schema, dict):
        return schema
    if isinstance(schema, type) and hasattr(schema, "model_json_schema"):
        return schema.model_json_schema()  # type: ignore[no-any-return]
    return None


def _sanitize_tool_schemas(tools: list[BaseTool]) -> list[BaseTool]:
    """Rewrite args schemas as cleaned dicts so Gemini does not warn on `$schema`."""
    for tool in tools:
        raw = _schema_as_dict(getattr(tool, "args_schema", None))
        if raw is not None:
            tool.args_schema = _strip_gemini_unsupported_keys(raw)
    return tools


async def load_mcp_tools_from_url(url: str | None = None) -> list[BaseTool]:
    """Discover tools via MCP tools/list and wrap them for LangGraph."""
    mcp_url = url or get_mcp_url()

    from langchain_mcp_adapters.client import MultiServerMCPClient

    # Transport "http" = Streamable HTTP in current langchain-mcp-adapters.
    client = MultiServerMCPClient(
        {
            "todo": {
                "transport": "http",
                "url": mcp_url,
            }
        }
    )
    tools = await client.get_tools()
    return _sanitize_tool_schemas(list(tools))


async def list_mcp_tool_names(url: str | None = None) -> list[str]:
    tools = await load_mcp_tools_from_url(url)
    return [t.name for t in tools]
