"""Run a LangSmith experiment against a synced dataset."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from langsmith import Client

# Allow `uv run python evals/run_eval.py` from agent/
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from dataset_io import (  # noqa: E402
    DEFAULT_DATASET,
    ensure_remote_dataset,
    load_agent_env,
    push_local_to_remote,
    question_from_inputs,
    require_eval_env,
)
from evaluators import (  # noqa: E402
    answer_min_chars,
    final_response_judge,
    intent_satisfied,
    trajectory_llm_judge,
    trajectory_subsequence,
)
from todo_agent.graph import run_agent  # noqa: E402

DEFAULT_EVALUATORS = [
    answer_min_chars,  # static: answer length
    trajectory_subsequence,  # static: tool subsequence + args
    trajectory_llm_judge,  # LLM: tool-calling / trajectory
    intent_satisfied,  # LLM: polarity-aware intent (metadata.expect)
    final_response_judge,  # LLM: final answer (also polarity-aware)
]


def target(inputs: dict) -> dict:
    question = question_from_inputs(inputs)
    out = run_agent(question)
    return {"answer": out["answer"], "trajectory": out["trajectory"]}


def run_experiment(
    client: Client,
    *,
    dataset_name: str = DEFAULT_DATASET,
    sync_local: bool = False,
    experiment_prefix: str = "todo-agent",
    max_concurrency: int = 2,
):
    """Evaluate against a LangSmith dataset; results are pushed to LangSmith."""
    if sync_local:
        push_local_to_remote(client, dataset_name)
    else:
        ensure_remote_dataset(client, dataset_name)

    return client.evaluate(
        target,
        data=dataset_name,
        evaluators=DEFAULT_EVALUATORS,
        experiment_prefix=experiment_prefix,
        max_concurrency=max_concurrency,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Run LangSmith eval experiment")
    parser.add_argument("--name", default=DEFAULT_DATASET, help="Dataset name")
    parser.add_argument(
        "--sync",
        action="store_true",
        help="Push local examples.json to remote before evaluating (full override)",
    )
    args = parser.parse_args()

    load_agent_env()
    require_eval_env()
    client = Client()
    results = run_experiment(client, dataset_name=args.name, sync_local=args.sync)
    print(results)
    print("Open the experiment in LangSmith to inspect scores.")


if __name__ == "__main__":
    main()
