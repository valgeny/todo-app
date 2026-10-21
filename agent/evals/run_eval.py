"""Run a LangSmith experiment against a synced dataset (local graph or RemoteGraph)."""

from __future__ import annotations

import argparse
import os
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
    require_judge_env,
    require_langsmith_env,
)
from evaluators import (  # noqa: E402
    answer_min_chars,
    final_response_judge,
    guardrail_no_tools,
    guardrail_refusal_judge,
    intent_satisfied,
    trajectory_llm_judge,
    trajectory_subsequence,
)
from report import (  # noqa: E402
    aggregate_scores,
    check_thresholds,
    experiment_url_from_results,
    write_html_report,
    write_json_report,
)
from todo_agent.graph import run_agent  # noqa: E402

DEFAULT_EVALUATORS = [
    answer_min_chars,  # static: answer length
    trajectory_subsequence,  # static: tool subsequence + args
    guardrail_no_tools,  # static: no tools on guardrail / capability_gap
    trajectory_llm_judge,  # LLM: tool-calling / trajectory
    intent_satisfied,  # LLM: polarity-aware intent (metadata.expect)
    final_response_judge,  # LLM: final answer (also polarity-aware)
    guardrail_refusal_judge,  # LLM: refusal quality for guardrail / red-team / gaps
]


def make_local_target():
    def target(inputs: dict) -> dict:
        question = question_from_inputs(inputs)
        out = run_agent(question)
        return {"answer": out["answer"], "trajectory": out["trajectory"]}

    return target


def make_remote_target(deployment_url: str | None = None):
    from remote_target import build_remote_graph, invoke_remote

    graph = build_remote_graph(url=deployment_url)

    def target(inputs: dict) -> dict:
        question = question_from_inputs(inputs)
        out = invoke_remote(question, graph=graph)
        return {"answer": out["answer"], "trajectory": out["trajectory"]}

    return target


def run_experiment(
    client: Client,
    *,
    dataset_name: str = DEFAULT_DATASET,
    dataset_source: str = "repo",
    target_mode: str = "local",
    deployment_url: str | None = None,
    experiment_prefix: str = "todo-agent",
    max_concurrency: int = 2,
    metadata: dict | None = None,
):
    """
    Evaluate against a LangSmith dataset; results are pushed to LangSmith.

    dataset_source:
      repo — push local examples.json then evaluate
      langsmith — use remote dataset as-is (must already exist)
    target_mode:
      local — run_agent in-process (needs TODO_MCP_URL + Gemini)
      remote — RemoteGraph against LANGSMITH_DEPLOYMENT_URL / deployment_url
    """
    if dataset_source == "repo":
        push_local_to_remote(client, dataset_name)
    elif dataset_source == "langsmith":
        ensure_remote_dataset(client, dataset_name)
    else:
        raise ValueError(f"Unknown dataset_source: {dataset_source}")

    if target_mode == "local":
        target = make_local_target()
    elif target_mode == "remote":
        target = make_remote_target(deployment_url)
    else:
        raise ValueError(f"Unknown target_mode: {target_mode}")

    return client.evaluate(
        target,
        data=dataset_name,
        evaluators=DEFAULT_EVALUATORS,
        experiment_prefix=experiment_prefix,
        max_concurrency=max_concurrency,
        metadata=metadata or {},
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Run LangSmith eval experiment")
    parser.add_argument("--name", default=DEFAULT_DATASET, help="Dataset name")
    parser.add_argument(
        "--sync",
        action="store_true",
        help="Deprecated alias for --dataset-source repo",
    )
    parser.add_argument(
        "--dataset-source",
        choices=("repo", "langsmith"),
        default=os.environ.get("DATASET_SOURCE", "repo"),
        help="repo = push local goldens; langsmith = use remote dataset only",
    )
    parser.add_argument(
        "--target",
        choices=("local", "remote"),
        default=os.environ.get("EVAL_TARGET", "local"),
        help="local = in-process graph; remote = LangSmith Deployment (RemoteGraph)",
    )
    parser.add_argument(
        "--deployment-url",
        default=os.environ.get("LANGSMITH_DEPLOYMENT_URL", ""),
        help="Agent Server URL when --target remote",
    )
    parser.add_argument(
        "--experiment-prefix",
        default=os.environ.get("EVAL_EXPERIMENT_PREFIX", "todo-agent"),
    )
    parser.add_argument(
        "--max-concurrency",
        type=int,
        default=int(os.environ.get("EVAL_MAX_CONCURRENCY", "2")),
    )
    parser.add_argument(
        "--report-dir",
        default=os.environ.get("EVAL_REPORT_DIR", "evals/out"),
        help="Directory for eval-summary.json and eval-report.html",
    )
    parser.add_argument(
        "--skip-thresholds",
        action="store_true",
        help="Do not fail the process when EVAL_MIN_PASS_RATE / EVAL_THRESHOLD_* are missed",
    )
    args = parser.parse_args()

    load_agent_env()
    require_langsmith_env()
    if args.target == "local":
        require_eval_env()
    else:
        require_judge_env()
        if args.deployment_url:
            os.environ["LANGSMITH_DEPLOYMENT_URL"] = args.deployment_url

    dataset_source = "repo" if args.sync else args.dataset_source
    label = os.environ.get("ENVIRONMENT") or os.environ.get("APP_ENV") or ""
    metadata = {
        "eval_target": args.target,
        "dataset_source": dataset_source,
    }
    if label:
        metadata["environment"] = label

    client = Client()
    results = run_experiment(
        client,
        dataset_name=args.name,
        dataset_source=dataset_source,
        target_mode=args.target,
        deployment_url=args.deployment_url or None,
        experiment_prefix=args.experiment_prefix,
        max_concurrency=args.max_concurrency,
        metadata=metadata,
    )

    summary = aggregate_scores(results)
    exp_url = experiment_url_from_results(results)
    report_dir = Path(args.report_dir)
    if not report_dir.is_absolute():
        report_dir = Path.cwd() / report_dir
    write_json_report(report_dir / "eval-summary.json", summary, experiment_url=exp_url)
    write_html_report(
        report_dir / "eval-report.html",
        summary,
        experiment_url=exp_url,
        title=f"Eval {args.experiment_prefix}",
    )

    print(results)
    print(f"Summary: {summary}")
    if exp_url:
        print(f"Experiment: {exp_url}")
    print(f"Wrote {report_dir / 'eval-report.html'}")

    if not args.skip_thresholds:
        failures = check_thresholds(summary)
        if failures:
            print("Threshold failures:", file=sys.stderr)
            for msg in failures:
                print(f"  - {msg}", file=sys.stderr)
            raise SystemExit(1)


if __name__ == "__main__":
    main()
