"""Unit tests for eval report aggregation / thresholds (no network)."""

from __future__ import annotations

from report import aggregate_scores, check_thresholds, write_html_report


def test_aggregate_and_thresholds(tmp_path) -> None:
    rows = [
        {
            "evaluation_results": [
                {"key": "answer_min_chars", "score": 1.0},
                {"key": "intent_satisfied", "score": 0.0},
            ]
        },
        {
            "evaluation_results": [
                {"key": "answer_min_chars", "score": 1.0},
                {"key": "intent_satisfied", "score": 1.0},
            ]
        },
    ]
    summary = aggregate_scores(rows)
    assert summary["metrics"]["answer_min_chars"]["mean"] == 1.0
    assert summary["metrics"]["intent_satisfied"]["mean"] == 0.5
    assert summary["overall_pass_rate"] == 0.75

    fails = check_thresholds(summary, {"__overall__": 0.9})
    assert fails and "overall_pass_rate" in fails[0]

    ok = check_thresholds(summary, {"__overall__": 0.7})
    assert ok == []

    html_path = tmp_path / "eval-report.html"
    write_html_report(html_path, summary, experiment_url="https://example.test/exp")
    text = html_path.read_text(encoding="utf-8")
    assert "answer_min_chars" in text
    assert "https://example.test/exp" in text
