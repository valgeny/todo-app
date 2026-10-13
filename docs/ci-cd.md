# CI/CD

GitHub Actions pipelines, report publishing, and GitHub Pages.

## Workflows

| Workflow | File | When |
| --- | --- | --- |
| **CI** | `.github/workflows/ci.yml` | Every `push`; `pull_request` targeting `main` |
| **Linter** | `.github/workflows/linter.yml` | PRs targeting `main` (Biome via reviewdog, inline comments) |
| **Deploy GCP** | `.github/workflows/deploy-gcp.yml` | Push to `main`, or `workflow_dispatch` (needs `GCP_SA_KEY`) |

Concurrency is keyed by **event + branch** so a PR run cannot cancel the push that deploys Pages.

## CI jobs

```text
Build ──┐
OpenAPI ┼─→ (on push only) Publish reports → Deploy reports to GitHub Pages
Test  ──┘
```

| Job | What it does |
| --- | --- |
| **Build** | Install, lint, build web |
| **OpenAPI** | `yarn openapi:build`; upload Redoc artifact |
| **Test** | Integration + Playwright e2e; upload Allure and Playwright HTML artifacts |
| **Publish reports** | Assemble Pages site (`latest` + unix timestamp slots); upload Pages artifact |
| **Deploy reports** | `actions/deploy-pages` → `github-pages` environment |

### Why Publish / Deploy are skipped on pull requests

Those jobs run only when `github.event_name == 'push'`. The `github-pages` environment rejects deployments from `refs/pull/*/merge`. On a PR, look at the **push** run for the branch to see Pages publish/deploy.

## Deploy GCP (Cloud Run + FE bucket)

Workflow: `.github/workflows/deploy-gcp.yml`. Targets the **sandbox** stack (`todo-sandbox-*`). Infra is applied locally with `envs/sandbox.tfvars` ([infra/README.md](../infra/README.md)).

| Step | Action |
| --- | --- |
| Auth | `google-github-actions/auth` via **Workload Identity Federation** (GitHub OIDC → deploy SA; no JSON key) |
| API | `docker build` → Artifact Registry → `gcloud run deploy` |
| Smoke | `GET /health` expects 204 |
| FE | `yarn build` with `VITE_API_ORIGIN` = Cloud Run URL → `upload-cloud-storage` |

### One-time GitHub / GCP setup

1. Apply Terraform (creates SA + WIF pool/provider + IAM):

```bash
cd infra
terraform apply -var-file=envs/sandbox.tfvars
terraform output -raw workload_identity_provider
terraform output -raw github_deploy_sa_email
```

2. Repo **Settings → Environments → `sandbox` → Variables** (or `gh variable set --env sandbox`):

| Variable | Sandbox value source |
| --- | --- |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `terraform output -raw workload_identity_provider` |
| `GCP_SERVICE_ACCOUNT` | `terraform output -raw github_deploy_sa_email` |
| `GCP_PROJECT_ID` / `GCP_REGION` / `AR_REPO` / `CLOUD_RUN_SERVICE` / `IMAGE_NAME` / `FRONTEND_BUCKET` | match sandbox resource names |

3. You do **not** need `GCP_SA_KEY`.
4. Push to `main` or run **Deploy GCP** via Actions → workflow_dispatch.

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
