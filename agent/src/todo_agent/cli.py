"""Interactive CLI for the todo agent (no web UI)."""

from __future__ import annotations

import sys
from pathlib import Path

from dotenv import load_dotenv

from todo_agent.graph import run_agent


def _load_env() -> None:
    root = Path(__file__).resolve().parents[2]
    load_dotenv(root / ".env")
    load_dotenv(root / ".env.local")


def main() -> None:
    _load_env()
    print("Todo agent (Gemini + LangGraph). Empty line or Ctrl-D to exit.")
    print("Ensure the API is up: yarn dev:server (repo root)\n")
    while True:
        try:
            line = input("you> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not line:
            break
        try:
            out = run_agent(line)
        except Exception as exc:  # noqa: BLE001 — CLI surface
            print(f"error> {exc}", file=sys.stderr)
            continue
        traj = out["trajectory"]
        if traj:
            tools = ", ".join(f"{t['tool']}" for t in traj)
            print(f"tools> {tools}")
        print(f"agent> {out['answer']}\n")


if __name__ == "__main__":
    main()
