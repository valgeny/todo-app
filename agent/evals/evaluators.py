"""Offline evaluators: trajectory match + final-answer LLM judge."""

from __future__ import annotations

from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from dataset_io import question_from_inputs
from todo_agent.graph import _build_llm


def _as_mapping(obj: Any) -> dict[str, Any]:
    """LangSmith may pass dicts or pydantic Example/Run objects."""
    if obj is None:
        return {}
    if isinstance(obj, dict):
        return obj
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    if hasattr(obj, "dict"):
        return obj.dict()
    return {
        "inputs": getattr(obj, "inputs", None) or {},
        "outputs": getattr(obj, "outputs", None) or {},
    }


def _tool_names(trajectory: list[dict[str, Any]] | None) -> list[str]:
    if not trajectory:
        return []
    return [str(step.get("tool") or "") for step in trajectory]


def trajectory_subsequence(run: Any, example: Any) -> dict[str, Any]:
    """
    Pass if expected tool names appear in order as a subsequence of actual calls.
    Arg equality is best-effort for keys present on the expected step.
    """
    example_map = _as_mapping(example)
    run_map = _as_mapping(run)
    expected = (example_map.get("outputs") or {}).get("trajectory") or []
    actual = (run_map.get("outputs") or {}).get("trajectory") or []
    exp_names = _tool_names(expected)
    act_names = _tool_names(actual)

    if not exp_names:
        score = 1.0 if not act_names else 0.0
        return {"key": "trajectory_subsequence", "score": score}

    i = 0
    for name in act_names:
        if i < len(exp_names) and name == exp_names[i]:
            i += 1
    name_ok = i == len(exp_names)

    args_ok = True
    if name_ok:
        # Align expected steps to first matching occurrences
        j = 0
        for step in actual:
            if j >= len(expected):
                break
            if step.get("tool") != expected[j].get("tool"):
                continue
            exp_args = expected[j].get("args") or {}
            act_args = step.get("args") or {}
            for key, value in exp_args.items():
                if act_args.get(key) != value:
                    args_ok = False
                    break
            j += 1
            if not args_ok:
                break

    score = 1.0 if name_ok and args_ok else (0.5 if name_ok else 0.0)
    return {
        "key": "trajectory_subsequence",
        "score": score,
        "comment": f"expected={exp_names} actual={act_names}",
    }


def final_response_judge(run: Any, example: Any) -> dict[str, Any]:
    """Gemini judges whether the answer matches the reference intent (0/1)."""
    example_map = _as_mapping(example)
    run_map = _as_mapping(run)
    reference = (example_map.get("outputs") or {}).get("reference") or ""
    answer = (run_map.get("outputs") or {}).get("answer") or ""
    try:
        question = question_from_inputs(example_map.get("inputs") or {})
    except ValueError:
        question = ""

    llm = _build_llm()  # API key or Vertex + ADC (same as agent)
    verdict = llm.invoke(
        [
            SystemMessage(
                content=(
                    "You grade a todo-assistant reply. Reply with ONLY PASS or FAIL.\n"
                    "PASS if the answer reasonably satisfies the user question given the reference intent.\n"
                    "FAIL if it is wrong, empty, or ignores the task."
                )
            ),
            HumanMessage(
                content=(
                    f"Question: {question}\n"
                    f"Reference intent: {reference}\n"
                    f"Assistant answer: {answer}\n"
                )
            ),
        ]
    )
    text = (verdict.content if isinstance(verdict.content, str) else str(verdict.content)).upper()
    if "FAIL" in text and text.strip().startswith("FAIL"):
        score = 0.0
    elif "PASS" in text:
        score = 1.0
    else:
        score = 0.0
    return {"key": "final_response_judge", "score": score, "comment": text[:200]}
