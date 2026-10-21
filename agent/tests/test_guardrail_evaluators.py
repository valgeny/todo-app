"""Unit tests for deterministic guardrail evaluators (no network)."""

from __future__ import annotations

from evaluators import guardrail_no_tools, trajectory_subsequence


def _ex(*, slice_name: str, expect: str, trajectory: list | None = None) -> dict:
    return {
        "inputs": {"messages": [{"role": "human", "content": "x"}]},
        "outputs": {
            "reference": "r",
            "trajectory": [] if trajectory is None else trajectory,
        },
        "metadata": {"slice": slice_name, "expect": expect},
    }


def test_guardrail_no_tools_pass_and_fail() -> None:
    ex = _ex(slice_name="guardrail", expect="negative")
    ok = guardrail_no_tools({"outputs": {"trajectory": [], "answer": "no"}}, ex)
    assert ok["key"] == "guardrail_no_tools"
    assert ok["score"] == 1.0

    bad = guardrail_no_tools(
        {"outputs": {"trajectory": [{"tool": "list_todos", "args": {}}], "answer": "x"}},
        ex,
    )
    assert bad["score"] == 0.0


def test_guardrail_no_tools_skips_positive_trajectory() -> None:
    ex = _ex(
        slice_name="trajectory",
        expect="positive",
        trajectory=[{"tool": "list_todos", "args": {"status": "all"}}],
    )
    skipped = guardrail_no_tools(
        {"outputs": {"trajectory": [{"tool": "list_todos", "args": {"status": "all"}}]}},
        ex,
    )
    assert skipped["score"] == 1.0
    assert "skipped" in (skipped.get("comment") or "")


def test_trajectory_subsequence_empty_expected() -> None:
    ex = _ex(slice_name="capability_gap", expect="negative", trajectory=[])
    assert (
        trajectory_subsequence({"outputs": {"trajectory": []}}, ex)["score"] == 1.0
    )
    assert (
        trajectory_subsequence(
            {"outputs": {"trajectory": [{"tool": "list_todos", "args": {}}]}},
            ex,
        )["score"]
        == 0.0
    )


def test_dataset_json_loads() -> None:
    import json
    from pathlib import Path

    path = Path(__file__).resolve().parents[1] / "evals/datasets/todo-agent-v1/examples.json"
    rows = json.loads(path.read_text(encoding="utf-8"))
    assert len(rows) >= 20
    slices = { (r.get("metadata") or {}).get("slice") for r in rows }
    assert {"trajectory", "guardrail", "capability_gap"} <= slices
    ids = {r["id"] for r in rows}
    assert "unsupported-list-this-week" in ids
    assert "guard-pii-exfil" in ids
    assert "guard-injection-delimiter" in ids
    assert "guard-multilingual-coding" in ids
