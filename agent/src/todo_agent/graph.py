"""LangGraph ReAct agent wired to Gemini and MCP-discovered todo tools."""

from __future__ import annotations

import asyncio
import os
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.prebuilt import create_react_agent

from todo_agent.google_auth import configure_google_credentials
from todo_agent.mcp_tools import load_mcp_tools_from_url


def _agent_now() -> datetime:
    """Current time in AGENT_TZ, or the host local timezone if unset."""
    name = (os.environ.get("AGENT_TZ") or "").strip()
    if name:
        return datetime.now(ZoneInfo(name))
    return datetime.now().astimezone()


def build_system_prompt() -> str:
    """System prompt rebuilt per model call (fresh date for relative due dates)."""
    now = _agent_now()
    tz_label = now.tzname() or str(now.tzinfo) or "local"
    today = now.strftime("%A, %Y-%m-%d")
    return f"""You are a helpful assistant for a personal to-do list.
Today is {today} ({tz_label}). Resolve relative dates like "tomorrow" or "next week" from that date.
When creating or updating todos, pass ISO due dates (YYYY-MM-DD) to tools; do not ask the user for today's date.
Use the provided tools to list, create, update, complete, incomplete, or delete todos.
Prefer tools over guessing. When listing, use sensible defaults unless the user specifies filters.
Respond clearly with titles and todoIds when relevant.
"""


def _dynamic_prompt(state: Any) -> list[BaseMessage]:
    """Callable prompt so Studio / long sessions always see the current date."""
    messages = state["messages"] if isinstance(state, dict) else state.messages
    return [SystemMessage(content=build_system_prompt()), *messages]


def _build_llm(model_name: str | None = None) -> ChatGoogleGenerativeAI:
    configure_google_credentials()
    model_id = model_name or os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
    # Treat empty GOOGLE_API_KEY= as unset (common in dotenv files).
    api_key = (os.environ.get("GOOGLE_API_KEY") or "").strip()
    project = os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("GCLOUD_PROJECT")
    location = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
    has_adc = bool(
        (os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") or "").strip()
        or (os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON") or "").strip()
    )
    use_vertex = (os.environ.get("GOOGLE_GENAI_USE_VERTEXAI") or "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    ) or (not api_key and bool(project))
    # Vertex via ADC / SA JSON (LangSmith). Do not pass AI Studio api_key here.
    if use_vertex:
        return ChatGoogleGenerativeAI(
            model=model_id,
            temperature=0,
            vertexai=True,
            project=project,
            location=location,
        )
    if not api_key and not has_adc:
        raise RuntimeError(
            "Set GOOGLE_API_KEY (AI Studio) or Vertex via GOOGLE_CLOUD_PROJECT + "
            "ADC / GOOGLE_SERVICE_ACCOUNT_JSON"
        )
    return ChatGoogleGenerativeAI(model=model_id, temperature=0, api_key=api_key)


async def build_agent_async(model_name: str | None = None):
    """Build agent after MCP tools/list discovery."""
    llm = _build_llm(model_name)
    tools = await load_mcp_tools_from_url()
    return create_react_agent(llm, tools, prompt=_dynamic_prompt)


def extract_trajectory(messages: list[BaseMessage]) -> list[dict[str, Any]]:
    """Collect tool calls in order from AI messages."""
    trajectory: list[dict[str, Any]] = []
    for message in messages:
        if not isinstance(message, AIMessage):
            continue
        for call in message.tool_calls or []:
            trajectory.append(
                {
                    "tool": call.get("name"),
                    "args": call.get("args") or {},
                }
            )
    return trajectory


def final_assistant_text(messages: list[BaseMessage]) -> str:
    for message in reversed(messages):
        if isinstance(message, AIMessage) and message.content and not message.tool_calls:
            content = message.content
            if isinstance(content, str):
                return content
            if isinstance(content, list):
                parts = []
                for block in content:
                    if isinstance(block, str):
                        parts.append(block)
                    elif isinstance(block, dict) and block.get("type") == "text":
                        parts.append(str(block.get("text", "")))
                return "".join(parts)
    return ""


async def run_agent_async(user_text: str, agent=None) -> dict[str, Any]:
    """Invoke once; tools come from TODO_MCP_URL."""
    graph = agent or await build_agent_async()
    result = await graph.ainvoke({"messages": [HumanMessage(content=user_text)]})
    messages: list[BaseMessage] = result["messages"]
    return {
        "answer": final_assistant_text(messages),
        "trajectory": extract_trajectory(messages),
        "messages": messages,
    }


def run_agent(user_text: str, agent=None) -> dict[str, Any]:
    """Sync wrapper for LangSmith evals (runs the async MCP path)."""
    return asyncio.run(run_agent_async(user_text, agent=agent))
