"""Offline evaluators: static checks + trajectory / final-answer LLM judges."""

from __future__ import annotations

import json
import os
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from dataset_io import question_from_inputs
from todo_agent.graph import _build_llm

# Static floor for a non-empty assistant reply (override with EVAL_MIN_ANSWER_CHARS).
DEFAULT_MIN_ANSWER_CHARS = 20


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


def _pass_fail_score(text: str) -> tuple[float, str]:
    upper = text.upper()
    if "FAIL" in upper and upper.strip().startswith("FAIL"):
        return 0.0, text[:200]
    if "PASS" in upper:
        return 1.0, text[:200]
    return 0.0, text[:200]


def answer_min_chars(run: Any, example: Any) -> dict[str, Any]:
    """
    Static check: assistant answer length >= EVAL_MIN_ANSWER_CHARS (default 20).
    Score 1.0 if long enough, else 0.0.
    """
    del example  # unused; signature matches LangSmith evaluators
    run_map = _as_mapping(run)
    answer = str((run_map.get("outputs") or {}).get("answer") or "")
    minimum = int(os.environ.get("EVAL_MIN_ANSWER_CHARS", DEFAULT_MIN_ANSWER_CHARS))
    length = len(answer.strip())
    score = 1.0 if length >= minimum else 0.0
    return {
        "key": "answer_min_chars",
        "score": score,
        "comment": f"len={length} min={minimum}",
    }


def trajectory_subsequence(run: Any, example: Any) -> dict[str, Any]:
    """
    Static check: expected tool names appear in order as a subsequence of actual calls.
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


def trajectory_llm_judge(run: Any, example: Any) -> dict[str, Any]:
    """LLM-as-judge: did tool calls match the expected trajectory / task?"""
    example_map = _as_mapping(example)
    run_map = _as_mapping(run)
    expected = (example_map.get("outputs") or {}).get("trajectory") or []
    actual = (run_map.get("outputs") or {}).get("trajectory") or []
    reference = (example_map.get("outputs") or {}).get("reference") or ""
    try:
        question = question_from_inputs(example_map.get("inputs") or {})
    except ValueError:
        question = ""

    llm = _build_llm()
    verdict = llm.invoke(
        [
            SystemMessage(
                content=(
                    "You grade a todo-assistant's tool-calling trajectory. "
                    "Reply with ONLY PASS or FAIL.\n"
                    "PASS if the tools called (names and key args) reasonably match the expected "
                    "trajectory for the question. Extra harmless tools may be OK; missing required "
                    "tools or wrong args are FAIL. Empty expected trajectory means no tools should run."
                )
            ),
            HumanMessage(
                content=(
                    f"Question: {question}\n"
                    f"Reference intent: {reference}\n"
                    f"Expected trajectory JSON: {json.dumps(expected)}\n"
                    f"Actual trajectory JSON: {json.dumps(actual)}\n"
                )
            ),
        ]
    )
    text = verdict.content if isinstance(verdict.content, str) else str(verdict.content)
    score, comment = _pass_fail_score(text)
    return {"key": "trajectory_llm_judge", "score": score, "comment": comment}


def _expect_polarity(example_map: dict[str, Any]) -> str:
    """positive | negative from metadata.expect (default positive)."""
    meta = example_map.get("metadata") or {}
    expect = str(meta.get("expect") or "positive").strip().lower()
    if expect in {"negative", "neg", "refuse", "reject"}:
        return "negative"
    return "positive"


def intent_satisfied(run: Any, example: Any) -> dict[str, Any]:
    """
    LLM-as-judge for intent success, polarity-aware via metadata.expect:
      positive — fulfill the todo request (tools + useful answer)
      negative — refuse / stay in scope (no todo tools when none expected)
    """
    example_map = _as_mapping(example)
    run_map = _as_mapping(run)
    polarity = _expect_polarity(example_map)
    reference = (example_map.get("outputs") or {}).get("reference") or ""
    expected_traj = (example_map.get("outputs") or {}).get("trajectory") or []
    answer = (run_map.get("outputs") or {}).get("answer") or ""
    actual_traj = (run_map.get("outputs") or {}).get("trajectory") or []
    try:
        question = question_from_inputs(example_map.get("inputs") or {})
    except ValueError:
        question = ""

    if polarity == "negative":
        system = (
            "You grade a NEGATIVE test case for a todo-only assistant. "
            "Reply with ONLY PASS or FAIL.\n"
            "PASS if the assistant correctly refuses or stays out of scope "
            "(does not pretend to complete an off-topic task with todo tools).\n"
            "FAIL if it calls todo tools unnecessarily or fully answers as if it were a general assistant "
            "when the reference says it should decline."
        )
    else:
        system = (
            "You grade a POSITIVE test case for a todo assistant. "
            "Reply with ONLY PASS or FAIL.\n"
            "PASS if the assistant's tools and answer reasonably fulfill the user's todo intent "
            "given the reference.\n"
            "FAIL if it refuses, misses the task, or produces an empty/wrong result."
        )

    llm = _build_llm()
    verdict = llm.invoke(
        [
            SystemMessage(content=system),
            HumanMessage(
                content=(
                    f"Expect polarity: {polarity}\n"
                    f"Question: {question}\n"
                    f"Reference intent: {reference}\n"
                    f"Expected trajectory JSON: {json.dumps(expected_traj)}\n"
                    f"Actual trajectory JSON: {json.dumps(actual_traj)}\n"
                    f"Assistant answer: {answer}\n"
                )
            ),
        ]
    )
    text = verdict.content if isinstance(verdict.content, str) else str(verdict.content)
    score, comment = _pass_fail_score(text)
    return {
        "key": "intent_satisfied",
        "score": score,
        "comment": f"expect={polarity}; {comment}",
    }


def final_response_judge(run: Any, example: Any) -> dict[str, Any]:
    """LLM-as-judge: does the final answer match the reference intent?"""
    example_map = _as_mapping(example)
    run_map = _as_mapping(run)
    polarity = _expect_polarity(example_map)
    reference = (example_map.get("outputs") or {}).get("reference") or ""
    answer = (run_map.get("outputs") or {}).get("answer") or ""
    try:
        question = question_from_inputs(example_map.get("inputs") or {})
    except ValueError:
        question = ""

    if polarity == "negative":
        system = (
            "You grade a NEGATIVE-case reply. Reply with ONLY PASS or FAIL.\n"
            "PASS if the answer declines or stays scoped to todos (per reference).\n"
            "FAIL if it fully answers the off-topic question as a general assistant."
        )
    else:
        system = (
            "You grade a POSITIVE-case reply. Reply with ONLY PASS or FAIL.\n"
            "PASS if the answer reasonably satisfies the user question given the reference intent.\n"
            "FAIL if it is wrong, empty, refuses, or ignores the task."
        )

    llm = _build_llm()
    verdict = llm.invoke(
        [
            SystemMessage(content=system),
            HumanMessage(
                content=(
                    f"Expect polarity: {polarity}\n"
                    f"Question: {question}\n"
                    f"Reference intent: {reference}\n"
                    f"Assistant answer: {answer}\n"
                )
            ),
        ]
    )
    text = verdict.content if isinstance(verdict.content, str) else str(verdict.content)
    score, comment = _pass_fail_score(text)
    return {"key": "final_response_judge", "score": score, "comment": f"expect={polarity}; {comment}"}
