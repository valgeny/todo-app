"""Vertex ADC helpers for LangSmith / CI (service-account JSON in env)."""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

_CREDENTIALS_FILE: Path | None = None


def clear_empty_api_key() -> None:
    if not (os.environ.get("GOOGLE_API_KEY") or "").strip():
        os.environ.pop("GOOGLE_API_KEY", None)


def materialize_service_account_credentials() -> Path | None:
    """
    Write GOOGLE_SERVICE_ACCOUNT_JSON to a temp file and set
    GOOGLE_APPLICATION_CREDENTIALS. Accepts raw JSON or base64(JSON).
    """
    global _CREDENTIALS_FILE
    if _CREDENTIALS_FILE is not None and _CREDENTIALS_FILE.is_file():
        os.environ.setdefault("GOOGLE_APPLICATION_CREDENTIALS", str(_CREDENTIALS_FILE))
        return _CREDENTIALS_FILE

    raw = (os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON") or "").strip()
    if not raw:
        return None

    try:
        info = json.loads(raw)
    except json.JSONDecodeError:
        import base64

        try:
            info = json.loads(base64.b64decode(raw).decode("utf-8"))
        except Exception as exc:  # noqa: BLE001
            raise RuntimeError(
                "GOOGLE_SERVICE_ACCOUNT_JSON must be JSON or base64(JSON)"
            ) from exc

    if not isinstance(info, dict) or info.get("type") != "service_account":
        raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_JSON is not a service account key")

    fd, path_str = tempfile.mkstemp(prefix="gcp-sa-", suffix=".json")
    path = Path(path_str)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(info, handle)
        path.chmod(0o600)
    except Exception:
        path.unlink(missing_ok=True)
        raise

    _CREDENTIALS_FILE = path
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(path)
    if info.get("project_id"):
        os.environ.setdefault("GOOGLE_CLOUD_PROJECT", str(info["project_id"]))
    return path


def configure_google_credentials() -> None:
    clear_empty_api_key()
    materialize_service_account_credentials()
