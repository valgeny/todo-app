"""LangGraph ReAct agent wired to Gemini and todo REST tools."""

from __future__ import annotations

import os
from typing import Any

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.prebuilt import create_react_agent

from todo_agent.tools import build_tools

SYSTEM_PROMPT = """You are a helpful assistant for a personal to-do list.
Use the provided tools to list, create, update, complete, incomplete, or delete todos.
Prefer tools over guessing. When listing, use sensible defaults unless the user specifies filters.
Respond clearly with titles and todoIds when relevant.
"""


def build_agent(model_name: str | None = None):
    model_id = model_name or os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
    llm = ChatGoogleGenerativeAI(model=model_id, temperature=0)
    tools = build_tools()
    return create_react_agent(llm, tools, prompt=SYSTEM_PROMPT)


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


def run_agent(user_text: str, agent=None) -> dict[str, Any]:
    """Invoke the graph once; return answer + trajectory for evals."""
    graph = agent or build_agent()
    result = graph.invoke({"messages": [HumanMessage(content=user_text)]})
    messages: list[BaseMessage] = result["messages"]
    return {
        "answer": final_assistant_text(messages),
        "trajectory": extract_trajectory(messages),
        "messages": messages,
    }
