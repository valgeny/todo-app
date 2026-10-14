"""Upload seed examples (optional) and run a LangSmith experiment."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from langsmith import Client

# Allow `uv run python evals/run_eval.py` from agent/
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from todo_agent.graph import run_agent  # noqa: E402
from evaluators import final_response_judge, trajectory_subsequence  # noqa: E402

DATASET_NAME = "todo-agent-v1"
SEED_PATH = Path(__file__).with_name("dataset_seed.json")


def _load_env() -> None:
    config = Path(__file__).resolve().parents[1] / "config"
    load_dotenv(config / ".env")
    load_dotenv(config / ".env.local")
    sandbox = config / ".env.local2sandbox"
    if sandbox.is_file():
        load_dotenv(sandbox, override=False)


def ensure_dataset(client: Client) -> str:
    rows = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    existing = {d.name: d for d in client.list_datasets(dataset_name=DATASET_NAME)}
    if DATASET_NAME not in existing:
        dataset = client.create_dataset(
            dataset_name=DATASET_NAME,
            description="Golden set for the todo LangGraph agent (trajectory + final)",
        )
    else:
        dataset = existing[DATASET_NAME]

    # Idempotent-ish: skip create if examples already present
    examples = list(client.list_examples(dataset_id=dataset.id))
    if not examples:
        client.create_examples(
            dataset_id=dataset.id,
            examples=[
                {
                    "inputs": row["inputs"],
                    "outputs": row["outputs"],
                    "metadata": row.get("metadata") or {},
                }
                for row in rows
            ],
        )
    return DATASET_NAME


def target(inputs: dict) -> dict:
    question = inputs["question"]
    out = run_agent(question)
    return {"answer": out["answer"], "trajectory": out["trajectory"]}


def main() -> None:
    _load_env()
    if not os.environ.get("LANGSMITH_API_KEY"):
        raise SystemExit("Set LANGSMITH_API_KEY in agent/config/.env")
    if not os.environ.get("TODO_MCP_URL"):
        raise SystemExit("Set TODO_MCP_URL (MCP Streamable HTTP endpoint)")
    if not os.environ.get("GOOGLE_API_KEY") and not os.environ.get("GOOGLE_CLOUD_PROJECT"):
        raise SystemExit("Set GOOGLE_API_KEY or GOOGLE_CLOUD_PROJECT (Vertex ADC)")

    client = Client()
    dataset_name = ensure_dataset(client)
    results = client.evaluate(
        target,
        data=dataset_name,
        evaluators=[trajectory_subsequence, final_response_judge],
        experiment_prefix="todo-agent",
        max_concurrency=2,
    )
    print(results)
    print("Open the experiment in LangSmith to inspect scores.")


if __name__ == "__main__":
    main()
