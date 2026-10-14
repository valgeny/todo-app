"""Offline evaluators: trajectory match + final-answer LLM judge."""

from __future__ import annotations

import os
from typing import Any

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage


def _tool_names(trajectory: list[dict[str, Any]] | None) -> list[str]:
    if not trajectory:
        return []
    return [str(step.get("tool") or "") for step in trajectory]


def trajectory_subsequence(run: dict[str, Any], example: dict[str, Any]) -> dict[str, Any]:
    """
    Pass if expected tool names appear in order as a subsequence of actual calls.
    Arg equality is best-effort for keys present on the expected step.
    """
    expected = (example.get("outputs") or {}).get("trajectory") or []
    actual = (run.get("outputs") or {}).get("trajectory") or []
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


def final_response_judge(run: dict[str, Any], example: dict[str, Any]) -> dict[str, Any]:
    """Gemini judges whether the answer matches the reference intent (0/1)."""
    reference = (example.get("outputs") or {}).get("reference") or ""
    answer = (run.get("outputs") or {}).get("answer") or ""
    question = (example.get("inputs") or {}).get("question") or ""

    model_id = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
    llm = ChatGoogleGenerativeAI(model=model_id, temperature=0)
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
    score = 1.0 if "PASS" in text and "FAIL" not in text.split("PASS")[0] else (1.0 if text.strip().startswith("PASS") else 0.0)
    if "FAIL" in text and text.strip().startswith("FAIL"):
        score = 0.0
    elif "PASS" in text:
        score = 1.0
    else:
        score = 0.0
    return {"key": "final_response_judge", "score": score, "comment": text[:200]}
