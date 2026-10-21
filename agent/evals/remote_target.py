"""Invoke a LangSmith Deployment via RemoteGraph and map outputs for evaluators."""

from __future__ import annotations

import os
from typing import Any

from langchain_core.messages import BaseMessage, convert_to_messages
from langgraph.pregel.remote import RemoteGraph

from todo_agent.graph import extract_trajectory, final_assistant_text


def deployment_url_from_env() -> str:
    url = (os.environ.get("LANGSMITH_DEPLOYMENT_URL") or "").strip().rstrip("/")
    if not url:
        raise SystemExit(
            "Set LANGSMITH_DEPLOYMENT_URL to the Agent Server URL "
            "(e.g. https://…us.langgraph.app)"
        )
    return url


def build_remote_graph(
    *,
    url: str | None = None,
    graph_name: str | None = None,
    api_key: str | None = None,
) -> RemoteGraph:
    return RemoteGraph(
        graph_name or os.environ.get("LANGGRAPH_GRAPH_ID", "todo_agent"),
        url=url or deployment_url_from_env(),
        api_key=api_key or os.environ.get("LANGSMITH_API_KEY"),
    )


def _as_messages(raw: Any) -> list[BaseMessage]:
    if not raw:
        return []
    if isinstance(raw, list) and raw and isinstance(raw[0], BaseMessage):
        return raw  # type: ignore[return-value]
    return convert_to_messages(raw)


def invoke_remote(question: str, graph: RemoteGraph | None = None) -> dict[str, Any]:
    """
    Call the remote graph with a single human turn.
    Returns the same shape as local run_agent: answer + trajectory.
    """
    remote = graph or build_remote_graph()
    result = remote.invoke({"messages": [{"role": "human", "content": question}]})
    messages = _as_messages(result.get("messages") if isinstance(result, dict) else result)
    return {
        "answer": final_assistant_text(messages),
        "trajectory": extract_trajectory(messages),
        "messages": messages,
    }
