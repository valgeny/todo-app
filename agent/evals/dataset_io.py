"""Local ↔ LangSmith dataset helpers (folder under evals/datasets/{name}/)."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from langsmith import Client

EVALS_DIR = Path(__file__).resolve().parent
DATASETS_DIR = EVALS_DIR / "datasets"
DEFAULT_DATASET = "todo-agent-v1"

# LangGraph Studio / chat experiments expect inputs.messages (not inputs.question).
INPUTS_SCHEMA = {
    "type": "object",
    "properties": {
        "messages": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "role": {"type": "string"},
                    "content": {"type": "string"},
                },
                "required": ["role", "content"],
            },
        }
    },
    "required": ["messages"],
}

OUTPUTS_SCHEMA = {
    "type": "object",
    "properties": {
        "reference": {"type": "string"},
        "trajectory": {"type": "array"},
    },
}


def question_from_inputs(inputs: dict[str, Any]) -> str:
    """Prefer last human message content; fall back to legacy inputs.question."""
    messages = inputs.get("messages")
    if isinstance(messages, list) and messages:
        last = messages[-1]
        if isinstance(last, dict):
            content = last.get("content")
            if isinstance(content, str) and content.strip():
                return content
            if isinstance(content, list):
                parts = [
                    p.get("text", "")
                    for p in content
                    if isinstance(p, dict) and p.get("type") == "text"
                ]
                text = "".join(parts).strip()
                if text:
                    return text
    question = inputs.get("question")
    if isinstance(question, str) and question.strip():
        return question
    raise ValueError("Example inputs need messages[].content or question")


def normalize_inputs(inputs: dict[str, Any]) -> dict[str, Any]:
    """Ensure inputs include messages for Studio / chat-compatible datasets."""
    if isinstance(inputs.get("messages"), list) and inputs["messages"]:
        return inputs
    question = inputs.get("question")
    if isinstance(question, str) and question.strip():
        return {"messages": [{"role": "human", "content": question}]}
    return inputs


def load_agent_env() -> None:
    config = EVALS_DIR.parent / "config"
    load_dotenv(config / ".env")
    load_dotenv(config / ".env.local")
    sandbox = config / ".env.local2sandbox"
    if sandbox.is_file():
        load_dotenv(sandbox, override=False)


def dataset_dir(name: str) -> Path:
    return DATASETS_DIR / name


def examples_path(name: str) -> Path:
    return dataset_dir(name) / "examples.json"


def read_local_examples(name: str) -> list[dict[str, Any]]:
    path = examples_path(name)
    if not path.is_file():
        raise FileNotFoundError(f"Local dataset not found: {path}")
    rows = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(rows, list):
        raise ValueError(f"{path} must be a JSON array")
    return rows


def write_local_examples(name: str, rows: list[dict[str, Any]]) -> Path:
    path = examples_path(name)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return path


def _row_to_example(row: dict[str, Any]) -> dict[str, Any]:
    local_id = row.get("id")
    metadata = dict(row.get("metadata") or {})
    if local_id and "local_id" not in metadata:
        metadata["local_id"] = local_id
    return {
        "inputs": normalize_inputs(dict(row.get("inputs") or {})),
        "outputs": row.get("outputs") or {},
        "metadata": metadata,
    }


def ensure_remote_dataset(client: Client, name: str, description: str | None = None) -> Any:
    existing = {d.name: d for d in client.list_datasets(dataset_name=name)}
    if name in existing:
        return existing[name]
    return client.create_dataset(
        dataset_name=name,
        description=description or f"Todo agent eval dataset ({name})",
        data_type="kv",
        inputs_schema=INPUTS_SCHEMA,
        outputs_schema=OUTPUTS_SCHEMA,
    )


def push_local_to_remote(client: Client, name: str) -> int:
    """Overwrite remote examples with local examples.json (same dataset name)."""
    rows = read_local_examples(name)
    dataset = ensure_remote_dataset(client, name)
    remote = list(client.list_examples(dataset_id=dataset.id))
    if remote:
        client.delete_examples([ex.id for ex in remote], hard_delete=True)
    if rows:
        client.create_examples(
            dataset_id=dataset.id,
            examples=[_row_to_example(row) for row in rows],
        )
    return len(rows)


def pull_remote_to_local(client: Client, name: str) -> int:
    """Overwrite local examples.json with remote examples (same dataset name)."""
    existing = {d.name: d for d in client.list_datasets(dataset_name=name)}
    if name not in existing:
        raise SystemExit(f"Remote dataset not found: {name}")
    dataset = existing[name]
    remote = list(client.list_examples(dataset_id=dataset.id))
    rows: list[dict[str, Any]] = []
    for ex in remote:
        meta = dict(ex.metadata or {})
        local_id = meta.get("local_id") or str(ex.id)
        rows.append(
            {
                "id": local_id,
                "inputs": ex.inputs or {},
                "outputs": ex.outputs or {},
                "metadata": meta,
            }
        )
    rows.sort(key=lambda r: str(r.get("id") or ""))
    write_local_examples(name, rows)
    return len(rows)


def require_langsmith_env() -> None:
    if not os.environ.get("LANGSMITH_API_KEY"):
        raise SystemExit("Set LANGSMITH_API_KEY in agent/config/.env")


def _ensure_gemini_auth() -> None:
    """Empty GOOGLE_API_KEY= in dotenv should not block Vertex + ADC."""
    api_key = (os.environ.get("GOOGLE_API_KEY") or "").strip()
    if not api_key:
        os.environ.pop("GOOGLE_API_KEY", None)
    project = os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("GCLOUD_PROJECT")
    if not api_key and not project:
        try:
            import subprocess

            gcloud_project = subprocess.check_output(
                ["gcloud", "config", "get-value", "project"],
                text=True,
                stderr=subprocess.DEVNULL,
            ).strip()
            if gcloud_project and gcloud_project != "(unset)":
                os.environ.setdefault("GOOGLE_CLOUD_PROJECT", gcloud_project)
                project = gcloud_project
        except Exception:  # noqa: BLE001
            pass
    if not api_key and not project:
        raise SystemExit(
            "Set GOOGLE_API_KEY, or GOOGLE_CLOUD_PROJECT for Vertex + ADC "
            "(gcloud auth application-default login)"
        )


def require_judge_env() -> None:
    """LangSmith + Gemini for evaluators (no MCP — used for remote-target CI)."""
    require_langsmith_env()
    _ensure_gemini_auth()


def require_eval_env() -> None:
    """Full local eval: LangSmith + MCP + Gemini."""
    require_judge_env()
    if not os.environ.get("TODO_MCP_URL"):
        raise SystemExit("Set TODO_MCP_URL (MCP Streamable HTTP endpoint)")
