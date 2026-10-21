"""Pytest fixtures for agent evals (LangSmith)."""

from __future__ import annotations

import os
import sys
from collections.abc import Callable, Iterator
from pathlib import Path

import pytest
from langsmith import Client

EVALS_DIR = Path(__file__).resolve().parents[1] / "evals"
SRC_DIR = Path(__file__).resolve().parents[1] / "src"
for path in (str(EVALS_DIR), str(SRC_DIR)):
    if path not in sys.path:
        sys.path.insert(0, path)

from dataset_io import (  # noqa: E402
    DEFAULT_DATASET,
    load_agent_env,
)
from run_eval import run_experiment  # noqa: E402


def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line(
        "markers",
        "langsmith: needs LANGSMITH_API_KEY, TODO_MCP_URL, and Gemini auth; pushes to LangSmith",
    )


@pytest.fixture(scope="session")
def agent_env() -> None:
    load_agent_env()


@pytest.fixture(scope="session")
def langsmith_ready(agent_env: None) -> None:
    missing = []
    if not os.environ.get("LANGSMITH_API_KEY"):
        missing.append("LANGSMITH_API_KEY")
    if not os.environ.get("TODO_MCP_URL"):
        missing.append("TODO_MCP_URL")
    if not os.environ.get("GOOGLE_API_KEY") and not os.environ.get("GOOGLE_CLOUD_PROJECT"):
        missing.append("GOOGLE_API_KEY or GOOGLE_CLOUD_PROJECT")
    if missing:
        pytest.skip("Missing env for LangSmith eval: " + ", ".join(missing))


@pytest.fixture
def langsmith_client(langsmith_ready: None) -> Client:
    return Client()


@pytest.fixture
def dataset_name() -> str:
    return os.environ.get("TODO_EVAL_DATASET", DEFAULT_DATASET)


@pytest.fixture
def push_eval_to_langsmith(
    langsmith_client: Client,
    dataset_name: str,
) -> Iterator[Callable[..., object]]:
    """
    Fixture that runs the agent eval and pushes experiment results to LangSmith.

    Usage:
        def test_eval(push_eval_to_langsmith):
            results = push_eval_to_langsmith(sync_local=True)
    """

    def _run(
        *,
        sync_local: bool = True,
        experiment_prefix: str = "todo-agent-pytest",
        target_mode: str | None = None,
        dataset_source: str | None = None,
        deployment_url: str | None = None,
    ):
        mode = target_mode or os.environ.get("EVAL_TARGET", "local")
        source = dataset_source or (
            "repo" if sync_local else os.environ.get("DATASET_SOURCE", "langsmith")
        )
        if sync_local and dataset_source is None:
            source = "repo"
        return run_experiment(
            langsmith_client,
            dataset_name=dataset_name,
            dataset_source=source,
            target_mode=mode,
            deployment_url=deployment_url or os.environ.get("LANGSMITH_DEPLOYMENT_URL"),
            experiment_prefix=experiment_prefix,
        )

    yield _run
