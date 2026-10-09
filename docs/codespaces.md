# Codespaces

Run the API and UI in a GitHub Codespace — no local Node install required. Anyone with repo access (or anyone, if the repo is public) can create **their own** Codespace; each session is isolated and billed to their GitHub/org quota.

## Create a Codespace

1. Open the repo on GitHub.
2. **Code → Codespaces → Create codespace on `main`** (or another branch).
3. Wait for the container to finish. `.devcontainer/post-create.sh` will:
   - Copy `server/config/.env.example` → `.env.local` and `web/config/.env.example` → `.env.local` when missing
   - Enable Yarn classic and run `yarn install --frozen-lockfile`

The image is Node 24 (`mcr.microsoft.com/devcontainers/javascript-node:24`). `HOST=0.0.0.0` so forwarded ports accept connections. Ports **3000** (UI) and **8000** (API) are forwarded; the UI may open in the browser automatically.

## Run the app

In two Codespace terminals:

```bash
yarn dev:server
```

```bash
yarn dev:web
```

1. Open the forwarded **UI** port (`3000`) from the Ports panel.
2. The page talks to the API at `https://<codespace-name>-8000.app.github.dev`.
3. `CORS_ORIGINS` allows `localhost`, `127.0.0.1`, and `*.app.github.dev`.

Use the **SQLite** example env (default from `.env.example`). This is a live session, not a deployment — the machine stops when idle.

## Run tests

```bash
yarn test                 # lint + integration
yarn test:integration
yarn test:e2e
```

Playwright e2e installs Chromium on first run (`yarn playwright install --with-deps chromium` if needed). More detail: [Testing](testing.md).

## What not to expect

- **SQL Server / `docker compose`** — not the Codespaces path. Prefer SQLite here; use [Quick start](getting-started.md) Docker steps on a machine with Docker Desktop.
- **Shared state** — your Codespace does not share data with someone else’s.

## Related

- [Quick start](getting-started.md) (local and Docker)
- [Testing](testing.md)
- [CI/CD](ci-cd.md)
