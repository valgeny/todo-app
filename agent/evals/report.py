"""Summarize LangSmith experiment results → JSON + HTML; enforce pass thresholds."""

from __future__ import annotations

import html
import json
import os
from collections import defaultdict
from pathlib import Path
from typing import Any


def _feedback_rows(results: Any) -> list[dict[str, Any]]:
    """Best-effort flatten of Client.evaluate return value / ExperimentResults."""
    rows: list[dict[str, Any]] = []
    # langsmith ExperimentResults behaves like an iterable of ResultRow / dicts
    try:
        for item in results:
            rows.append(_normalize_row(item))
    except TypeError:
        if hasattr(results, "to_pandas"):
            try:
                df = results.to_pandas()
                for record in df.to_dict(orient="records"):
                    rows.append(record)
            except Exception:  # noqa: BLE001
                pass
    return rows


def _normalize_row(item: Any) -> dict[str, Any]:
    if isinstance(item, dict):
        return item
    if hasattr(item, "model_dump"):
        return item.model_dump()
    if hasattr(item, "dict"):
        return item.dict()
    out: dict[str, Any] = {}
    for attr in ("example", "run", "evaluation_results", "feedback"):
        if hasattr(item, attr):
            out[attr] = getattr(item, attr)
    return out or {"raw": repr(item)}


def aggregate_scores(results: Any) -> dict[str, Any]:
    """
    Compute per-evaluator mean score and overall pass rate.
    Pass = score >= 0.5 (covers 0/0.5/1 trajectory subsequence).
    """
    per_key: dict[str, list[float]] = defaultdict(list)
    for row in _feedback_rows(results):
        feedback = (
            row.get("evaluation_results")
            or row.get("feedback")
            or row.get("results")
            or []
        )
        if isinstance(feedback, dict):
            # {key: {score, …}} or EvaluationResults
            results_list = feedback.get("results") if "results" in feedback else None
            if results_list is None:
                for key, val in feedback.items():
                    score = _score_of(val)
                    if score is not None:
                        per_key[str(key)].append(score)
                continue
            feedback = results_list
        if isinstance(feedback, list):
            for entry in feedback:
                if not isinstance(entry, dict):
                    key = getattr(entry, "key", None)
                    score = getattr(entry, "score", None)
                    if key is not None and score is not None:
                        per_key[str(key)].append(float(score))
                    continue
                key = entry.get("key") or entry.get("name")
                score = _score_of(entry)
                if key is not None and score is not None:
                    per_key[str(key)].append(score)

    metrics: dict[str, Any] = {}
    all_scores: list[float] = []
    for key, scores in sorted(per_key.items()):
        mean = sum(scores) / len(scores) if scores else 0.0
        passed = sum(1 for s in scores if s >= 0.5)
        metrics[key] = {
            "n": len(scores),
            "mean": round(mean, 4),
            "pass_rate": round(passed / len(scores), 4) if scores else 0.0,
        }
        all_scores.extend(scores)

    overall_pass = (
        round(sum(1 for s in all_scores if s >= 0.5) / len(all_scores), 4)
        if all_scores
        else 0.0
    )
    return {
        "metrics": metrics,
        "overall_pass_rate": overall_pass,
        "n_scores": len(all_scores),
    }


def _score_of(val: Any) -> float | None:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, dict) and "score" in val:
        try:
            return float(val["score"])
        except (TypeError, ValueError):
            return None
    if hasattr(val, "score"):
        try:
            return float(val.score)
        except (TypeError, ValueError):
            return None
    return None


def thresholds_from_env() -> dict[str, float]:
    """
    EVAL_MIN_PASS_RATE → overall (default 0.8).
    EVAL_THRESHOLD_<KEY> → per-evaluator mean (e.g. EVAL_THRESHOLD_intent_satisfied=0.9).
    """
    out: dict[str, float] = {}
    overall = os.environ.get("EVAL_MIN_PASS_RATE", "0.8")
    out["__overall__"] = float(overall)
    prefix = "EVAL_THRESHOLD_"
    for key, value in os.environ.items():
        if key.startswith(prefix) and value.strip():
            metric = key[len(prefix) :].lower()
            out[metric] = float(value)
    return out


def check_thresholds(summary: dict[str, Any], thresholds: dict[str, float] | None = None) -> list[str]:
    """Return list of human-readable failure messages (empty = pass)."""
    thresholds = thresholds or thresholds_from_env()
    failures: list[str] = []
    overall_need = thresholds.get("__overall__", 0.8)
    overall = float(summary.get("overall_pass_rate") or 0.0)
    if overall < overall_need:
        failures.append(f"overall_pass_rate {overall:.3f} < {overall_need:.3f}")
    metrics = summary.get("metrics") or {}
    for key, need in thresholds.items():
        if key == "__overall__":
            continue
        # match case-insensitively
        matched = None
        for mk, mv in metrics.items():
            if mk.lower() == key.lower():
                matched = mv
                break
        if matched is None:
            continue
        mean = float(matched.get("mean") or 0.0)
        if mean < need:
            failures.append(f"{key} mean {mean:.3f} < {need:.3f}")
    return failures


def write_json_report(path: Path, summary: dict[str, Any], *, experiment_url: str = "") -> None:
    payload = {**summary, "experiment_url": experiment_url}
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def write_html_report(
    path: Path,
    summary: dict[str, Any],
    *,
    experiment_url: str = "",
    title: str = "Todo agent eval",
) -> None:
    metrics = summary.get("metrics") or {}
    rows = []
    for key, m in metrics.items():
        rows.append(
            "<tr>"
            f"<td>{html.escape(key)}</td>"
            f"<td>{m.get('n', 0)}</td>"
            f"<td>{m.get('mean', 0):.3f}</td>"
            f"<td>{m.get('pass_rate', 0):.3f}</td>"
            "</tr>"
        )
    link = (
        f'<p><a href="{html.escape(experiment_url)}">Open experiment in LangSmith</a></p>'
        if experiment_url
        else ""
    )
    body = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>{html.escape(title)}</title>
  <style>
    body {{ font-family: ui-sans-serif, system-ui, sans-serif; margin: 2rem; }}
    table {{ border-collapse: collapse; }}
    th, td {{ border: 1px solid #ccc; padding: 0.4rem 0.75rem; text-align: left; }}
    th {{ background: #f4f4f4; }}
  </style>
</head>
<body>
  <h1>{html.escape(title)}</h1>
  {link}
  <p>Overall pass rate: <strong>{summary.get("overall_pass_rate", 0):.3f}</strong>
     ({summary.get("n_scores", 0)} scores)</p>
  <table>
    <thead><tr><th>Evaluator</th><th>N</th><th>Mean</th><th>Pass rate</th></tr></thead>
    <tbody>
      {"".join(rows) or "<tr><td colspan='4'>No scores collected</td></tr>"}
    </tbody>
  </table>
</body>
</html>
"""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")


def experiment_url_from_results(results: Any) -> str:
    for attr in ("experiment_url", "url"):
        val = getattr(results, attr, None)
        if isinstance(val, str) and val.startswith("http"):
            return val
    exp = getattr(results, "experiment", None)
    if exp is not None:
        for attr in ("url", "experiment_url"):
            val = getattr(exp, attr, None)
            if isinstance(val, str) and val.startswith("http"):
                return val
    return (os.environ.get("LANGSMITH_EXPERIMENT_URL") or "").strip()
