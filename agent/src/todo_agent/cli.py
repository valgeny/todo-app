"""Interactive CLI for the todo agent (MCP tools only)."""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

from todo_agent.graph import build_agent_async, run_agent_async
from todo_agent.mcp_tools import get_mcp_url, list_mcp_tool_names


def _agent_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _config_dir() -> Path:
    return _agent_root() / "config"


def _resolve_env_path(env_file: str) -> Path:
    """Resolve env file under agent/config/ (same layout as server/config, web/config)."""
    path = Path(env_file)
    if path.is_absolute():
        return path
    # --env .env.local2sandbox → agent/config/.env.local2sandbox
    candidates = [_config_dir() / path.name, _config_dir() / path, _agent_root() / path]
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    raise SystemExit(f"Env file not found: {env_file} (looked under agent/config/)")


def _load_env(env_file: str | None) -> Path | None:
    config = _config_dir()
    # Defaults first; explicit file overrides.
    load_dotenv(config / ".env")
    load_dotenv(config / ".env.local")
    if env_file:
        path = _resolve_env_path(env_file)
        load_dotenv(path, override=True)
        return path
    sandbox = config / ".env.local2sandbox"
    if sandbox.is_file():
        load_dotenv(sandbox, override=True)
        return sandbox
    return None


def _auth_mode() -> str:
    if (os.environ.get("GOOGLE_API_KEY") or "").strip():
        return "api-key (AI Studio)"
    project = os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("GCLOUD_PROJECT") or "?"
    location = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
    return f"vertex ADC ({project} / {location})"


async def _async_main(list_tools_only: bool) -> None:
    print(f"auth> {_auth_mode()}", flush=True)
    mcp_url = get_mcp_url()
    print(f"mcp> {mcp_url}  (deployed)", flush=True)
    names = await list_mcp_tool_names()
    print(f"discovered> {', '.join(names)}", flush=True)

    if list_tools_only:
        return

    # Build once — rediscovering MCP + binding tools every turn feels like a hang.
    print("building> agent…", flush=True)
    agent = await build_agent_async()
    print(
        "Todo agent (Gemini + LangGraph + MCP). Empty line or Ctrl-D to exit.\n",
        flush=True,
    )
    while True:
        try:
            line = input("you> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not line:
            break
        try:
            print("…", flush=True)
            out = await run_agent_async(line, agent=agent)
        except Exception as exc:  # noqa: BLE001 — CLI surface
            print(f"error> {exc}", file=sys.stderr)
            continue
        traj = out["trajectory"]
        if traj:
            tools = ", ".join(f"{t['tool']}" for t in traj)
            print(f"tools> {tools}")
        print(f"agent> {out['answer']}\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Todo agent CLI (MCP tools)")
    parser.add_argument(
        "--env",
        default=os.environ.get("TODO_AGENT_ENV"),
        help="Env file under agent/config/ (default: .env.local2sandbox if present)",
    )
    parser.add_argument(
        "--list-tools",
        action="store_true",
        help="Discover and print MCP tool names, then exit",
    )
    args = parser.parse_args()
    loaded = _load_env(args.env)
    if loaded:
        print(f"env> {loaded}", flush=True)
    if not os.environ.get("GOOGLE_API_KEY") and not (
        os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("GCLOUD_PROJECT")
    ):
        try:
            import subprocess

            project = subprocess.check_output(
                ["gcloud", "config", "get-value", "project"],
                text=True,
                stderr=subprocess.DEVNULL,
            ).strip()
            if project and project != "(unset)":
                os.environ.setdefault("GOOGLE_CLOUD_PROJECT", project)
        except Exception:  # noqa: BLE001
            pass

    asyncio.run(_async_main(list_tools_only=args.list_tools))


if __name__ == "__main__":
    main()
