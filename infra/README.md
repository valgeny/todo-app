# Terraform — Cloud Run (SQLite) + optional FE bucket

Local Terraform state (`backend "local"`). **SQLite on Cloud Run is ephemeral**: data resets when the instance scales to zero / is replaced. Fine for demos; not for durable storage.

## Modules

| Module | Path | Responsibility |
| --- | --- | --- |
| `project_apis` | `modules/project_apis` | Enable GCP APIs |
| `artifact_registry` | `modules/artifact_registry` | Docker repo + Cloud Run pull IAM |
| `secrets` | `modules/secrets` | Secret Manager secrets + versions |
| **`apis`** | `modules/apis` | Cloud Run backend + runtime SA |
| **`frontends`** | `modules/frontends` | Public GCS website bucket + deploy writers IAM (optional) |
| **`mcp`** | `modules/mcp` | Cloud Run Streamable HTTP MCP + runtime SA (calls `apis` URI) |
| `github_deploy` | `modules/github_deploy` | CI deploy SA + WIF + AR writer + Run admin (runtime act-as / FE write via each module’s `deploy_members`) |

Do **not** reuse `modules/apis` for MCP: different image, no SQLite/secrets, and `TODO_API_ORIGIN` instead of DB/CORS env.

Root `main.tf` only wires modules. `moved.tf` migrates existing flat state into modules without recreate.

## Environments

| Env | Var file | Resource prefix |
| --- | --- | --- |
| **sandbox** (current) | `envs/sandbox.tfvars` | `todo-sandbox` |
| staging | `envs/staging.tfvars` (add when needed) | `todo-staging` |
| prod | `envs/prod.tfvars` (add when needed) | `todo-prod` |

`environment` is required (`sandbox` \| `staging` \| `prod`). Names, labels, and Cloud Run `ENVIRONMENT` all use it so multiple envs can share one GCP project.

## Cost notes

| Resource | Idle cost |
| --- | --- |
| Cloud Run (`min=0`, `max=1`) | ~$0 when idle; pay per request / CPU while serving |
| SQLite | In-container file only — no Cloud SQL bill |
| FE GCS bucket (small SPA) | Often **$0** under Always Free (5 GB-mo + 100 GB egress NA in `us-central1` / `us-east1` / `us-west1`). List price ~$0.020/GB-mo if over free tier. |
| Custom HTTPS domain for GCS | Usually needs a **Load Balancer (~$18+/mo)** — skip for cheap demos; use the `storage.googleapis.com` object URL or Firebase Hosting later |
| Secret Manager | ~**$0.06**/secret-version/month + tiny access fees — fine for a handful of secrets |

## Config vs secrets

| Kind | Where | Examples |
| --- | --- | --- |
| **Config** (non-secret) | Cloud Run plain `env` from `modules/apis` (module defaults) | `APP_ENV`, `PORT`, `HOST`, `LOG_FORMAT`, `DB_DIALECT`, `DB_NAME`, `ENVIRONMENT` |
| **Secrets** | Secret Manager → `secret_key_ref` | `CORS_ORIGINS` (always), plus `secret_env` in tfvars |

Cloud Run does **not** use a committed `.env.cloudrun` — Terraform injects env. Local/dev still uses gitignored `.env.local` (from `.env.example`); committed test fixtures (`.env.test`, `.env.playwright`) are unchanged.

## Prerequisites

- `gcloud` auth: `gcloud auth application-default login` and `gcloud config set project PROJECT_ID`
- Terraform >= 1.5
- Docker (to build the API image)

## Apply (sandbox)

```bash
cd infra
cp envs/sandbox.tfvars.example envs/sandbox.tfvars   # set project_id
terraform init
terraform apply -var-file=envs/sandbox.tfvars
```

Build and deploy API + MCP via **GitHub Actions** (Docker on the runner; no local Docker):

```bash
gh workflow run deploy-gcp.yml --ref mcp-cloud-run
# or push to main
```

After the first successful image push, re-apply Terraform if the MCP service was missing an image:

```bash
terraform -chdir=infra apply -var-file=envs/sandbox.tfvars
```

Terraform prints `api_uri` and `mcp_endpoint`. Health: `curl -i "$API_URI/health"` and `curl -i "$MCP_URI/health"`.

### Frontend (optional bucket)

```bash
yarn build
# set VITE_API_ORIGIN to the Cloud Run URL before build
gsutil -m rsync -R -d web/dist "gs://$(terraform -chdir=infra output -raw frontend_bucket)"
```

Open `frontend_website_url` from outputs.

## Destroy

```bash
cd infra
terraform destroy -var-file=envs/sandbox.tfvars
```

## CI deploy (Workload Identity Federation)

Terraform creates SA `gh-deploy-<env>`, a GitHub OIDC identity pool/provider, and binds the repo (`github_repository`) as `roles/iam.workloadIdentityUser` on that SA. **No JSON keys** (works with `iam.disableServiceAccountKeyCreation`).

```bash
terraform apply -var-file=envs/sandbox.tfvars
terraform output -raw workload_identity_provider
terraform output -raw github_deploy_sa_email
```

Set them as GitHub Environment **`sandbox`** variables (`GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`, plus project/region/bucket names). See [CI/CD — Deploy GCP](../docs/ci-cd.md#deploy-gcp-cloud-run--fe-bucket).
