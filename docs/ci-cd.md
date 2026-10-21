# CI/CD

GitHub Actions pipelines, report publishing, and GitHub Pages.

## Workflows

| Workflow | File | When |
| --- | --- | --- |
| **CI** | `.github/workflows/ci.yml` | Every `push`; `pull_request` targeting `main` |
| **Linter** | `.github/workflows/linter.yml` | PRs targeting `main` (Biome via reviewdog, inline comments) |
| **Deploy GCP** | `.github/workflows/deploy-gcp.yml` | Every `push`, or `workflow_dispatch` (WIF; no JSON key) |
| **Deploy Cloud Run job** | `.github/workflows/deploy-cloudrun-job.yml` | Reusable (`workflow_call`); used by Deploy GCP |
| **Deploy LangSmith** | `.github/workflows/deploy-langsmith.yml` | `push` touching `agent/**`, or `workflow_dispatch` |

Concurrency is keyed by **event + branch** so a PR run cannot cancel the push that deploys Pages.

## CI jobs

```text
Lint ───┐
OpenAPI ┼─→ (on push only) Publish reports → Deploy reports to GitHub Pages
Test  ──┘
```

| Job | What it does |
| --- | --- |
| **Lint** | Install, lint, build web |
| **OpenAPI** | `yarn openapi:build`; upload Redoc artifact |
| **Test** | Integration + Playwright e2e; upload Allure and Playwright HTML artifacts |
| **Publish reports** | Assemble Pages site (`latest` + unix timestamp slots); upload Pages artifact |
| **Deploy reports** | `actions/deploy-pages` → `github-pages` environment |

### Why Publish / Deploy are skipped on pull requests

Those jobs run only when `github.event_name == 'push'`. The `github-pages` environment rejects deployments from `refs/pull/*/merge`. On a PR, look at the **push** run for the branch to see Pages publish/deploy.

## Deploy GCP (Cloud Run API + MCP + agent + copilot + FE bucket)

Workflow: `.github/workflows/deploy-gcp.yml`. Targets the **sandbox** env (`todo-sandbox-*`). Infra: apply **`stack/`** (nonprod) once, then **`env/`** with `envs/sandbox.tfvars` ([infra/README.md](../infra/README.md)). Agent IAP LB is Terraform-only; the workflow only builds/pushes the agent image.

Cloud Run services call reusable [`.github/workflows/deploy-cloudrun-job.yml`](../.github/workflows/deploy-cloudrun-job.yml) (WIF auth, docker build/push, `gcloud run deploy`, optional health/Ready smoke).

Jobs (API, MCP, and agent run **in parallel**; FE waits on API; copilot waits on agent):

| Job | Action |
| --- | --- |
| **API build + deploy** | `server/Dockerfile` → AR → deploy → `/health` |
| **MCP build + deploy** | `mcp/Dockerfile` → AR → deploy with `TODO_API_ORIGIN` from live API → `/health` |
| **Agent build + deploy** | `agent/Dockerfile` → AR → deploy with `TODO_MCP_URL` from live MCP → Ready check |
| **Copilot build + deploy** | `copilot/Dockerfile` → AR → deploy with `LANGGRAPH_URL` + graph id |
| **Frontend** | `yarn build` with `VITE_API_ORIGIN` → GCS upload |

Auth is **Workload Identity Federation** on every job (no JSON key).

### One-time GitHub / GCP setup

1. Apply **stack** (nonprod), then **env** (sandbox):

```bash
cd infra
terraform -chdir=stack init -reconfigure -backend-config=backends/nonprod.hcl
terraform -chdir=stack apply -var-file=../envs/nonprod.tfvars
terraform -chdir=stack output -raw workload_identity_provider
terraform -chdir=stack output -raw github_deploy_sa_email
terraform -chdir=stack output -raw artifact_registry_repo

terraform -chdir=env init -reconfigure -backend-config=backends/sandbox.hcl
terraform -chdir=env apply -var-file=../envs/sandbox.tfvars
terraform -chdir=env output -raw mcp_endpoint
```

2. Repo **Settings → Environments → `sandbox` → Variables** (or `gh variable set --env sandbox`):

| Variable | Sandbox value |
| --- | --- |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | stack `workload_identity_provider` |
| `GCP_SERVICE_ACCOUNT` | stack `github_deploy_sa_email` (`gh-deploy-nonprod@…`) |
| `AR_REPO` | stack `artifact_registry_repo` (`todo-nonprod-api`) |
| `GCP_PROJECT_ID` / `GCP_REGION` / `FRONTEND_BUCKET` | match sandbox |
| `API_CLOUD_RUN_SERVICE` / `API_IMAGE_NAME` | `todo-sandbox-api` |
| `MCP_CLOUD_RUN_SERVICE` / `MCP_IMAGE_NAME` | `todo-sandbox-mcp` |
| `AGENT_CLOUD_RUN_SERVICE` / `AGENT_IMAGE_NAME` | `todo-sandbox-agent` |
| `COPILOT_CLOUD_RUN_SERVICE` / `COPILOT_IMAGE_NAME` | `todo-sandbox-copilot` |

3. You do **not** need `GCP_SA_KEY`.
4. Push any branch or **Actions → Deploy GCP → Run workflow**.

## Deploy LangSmith (managed Agent Server)

Workflow: `.github/workflows/deploy-langsmith.yml`. Runs `langgraph deploy --remote` with `agent/langgraph.langsmith.json` (same graph as Cloud Run). Independent of the self-hosted Cloud Run agent above.

The job writes `agent/config/.env.langsmith` from the environment below; every key in it becomes a **deployment secret**. LangSmith workspace secrets are not injected into deployments, so `GOOGLE_API_KEY` must be set here too. There is no GCP identity on LangSmith, so Gemini uses the API key (not Vertex ADC).

GitHub **Environment** `langsmith`:

| Kind | Name | Value |
| --- | --- | --- |
| Secret | `LANGSMITH_API_KEY` | LangSmith API key with Deployments access |
| Secret | `GOOGLE_API_KEY` | Gemini (AI Studio) key |
| Variable | `TODO_MCP_URL` | Public MCP endpoint, e.g. `https://todo-sandbox-mcp-….run.app/mcp` |
| Variable | `LANGSMITH_DEPLOYMENT_NAME` | Optional; default `todo-agent` |
| Variable | `LANGSMITH_DEPLOYMENT_TYPE` | Optional; `serverless` (default) or `dedicated`; only used on create |
| Variable | `GEMINI_MODEL` / `AGENT_TZ` | Optional |
| Variable | `ENV` / `HOSTING` | Required; written as `ENVIRONMENT`/`APP_ENV`=`{ENV}-{HOSTING}` (e.g. `sandbox-managed`) |

Local equivalent (from `agent/`, with `LANGSMITH_API_KEY` exported and `config/.env.langsmith` filled in):

```bash
uvx --from langgraph-cli==0.4.37 langgraph deploy -c langgraph.langsmith.json --name todo-agent --remote
```

## GitHub Pages

Enable once: **Settings → Pages → Source: GitHub Actions**.

Site: [https://valgeny.github.io/todo-app/](https://valgeny.github.io/todo-app/)

| Path | Content |
| --- | --- |
| `/redoc/latest/` | API docs |
| `/allure/latest/` | Integration report |
| `/playwright/latest/` | E2E report |
| `/<report>/<unix-ts>/` | Historical slot (last 30 kept per report) |
| `/<branch>/…` | Branch preview (same layout under a sanitized branch folder) |

### Implementation

- Composite action: `.github/actions/publish-pages-report`
- Site assembly: `.github/scripts/pages-site.mjs` (`prepare`, `finalize`, `sanitize-branch`)
- History: previous `pages-site` artifact + main `github-pages` baseline when publishing a non-`main` branch

## Related

- [Quick start](getting-started.md)
- [API / Redoc](api.md)
- [Testing / reports](testing.md)
