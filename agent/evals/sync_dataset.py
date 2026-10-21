"""Sync local evals/datasets/{name}/examples.json ↔ LangSmith dataset of the same name.

  # Local overwrites remote
  uv run python evals/sync_dataset.py --name todo-agent-v1 --push

  # Remote overwrites local
  uv run python evals/sync_dataset.py --name todo-agent-v1 --pull
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from langsmith import Client

sys.path.insert(0, str(Path(__file__).resolve().parent))

from dataset_io import (  # noqa: E402
    DEFAULT_DATASET,
    examples_path,
    load_agent_env,
    pull_remote_to_local,
    push_local_to_remote,
    require_langsmith_env,
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync local dataset folder ↔ LangSmith")
    parser.add_argument(
        "--name",
        default=DEFAULT_DATASET,
        help=f"Dataset name / local folder under evals/datasets/ (default: {DEFAULT_DATASET})",
    )
    direction = parser.add_mutually_exclusive_group(required=True)
    direction.add_argument(
        "--push",
        action="store_true",
        help="Overwrite remote with local examples.json",
    )
    direction.add_argument(
        "--pull",
        action="store_true",
        help="Overwrite local examples.json with remote",
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Skip confirmation on destructive overwrite",
    )
    args = parser.parse_args()

    load_agent_env()
    require_langsmith_env()
    client = Client()

    if args.push:
        path = examples_path(args.name)
        if not args.yes:
            confirm = input(
                f"Push local → remote dataset '{args.name}' "
                f"(replace ALL remote examples from {path})? [y/N] "
            )
            if confirm.strip().lower() not in {"y", "yes"}:
                raise SystemExit("Aborted.")
        n = push_local_to_remote(client, args.name)
        print(f"Pushed {n} example(s) to LangSmith dataset '{args.name}'.")
        return

    if not args.yes:
        confirm = input(
            f"Pull remote → local dataset '{args.name}' "
            f"(overwrite {examples_path(args.name)})? [y/N] "
        )
        if confirm.strip().lower() not in {"y", "yes"}:
            raise SystemExit("Aborted.")
    n = pull_remote_to_local(client, args.name)
    print(f"Pulled {n} example(s) into {examples_path(args.name)}.")


if __name__ == "__main__":
    main()
