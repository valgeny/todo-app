"""LangSmith eval integration — pushes experiment results to the workspace."""

from __future__ import annotations

import pytest


@pytest.mark.langsmith
def test_eval_pushes_results_to_langsmith(push_eval_to_langsmith) -> None:
    results = push_eval_to_langsmith(sync_local=True)
    assert results is not None
