# Terraform — Cloud Run + Cloud SQL

Two roots: **`stack/`** (once per GCP project) and **`env/`** (identical per app environment). Local laptop: SQLite or `docker compose` Postgres — not this stack.

## Layout

| Root | Apply | Creates |
| --- | --- | --- |
| **`stack/`** | once per GCP project | APIs, AR **`todo-nonprod-api`**, WIF + **`gh-deploy-nonprod`**, SQL **`todo-nonprod-pg`**, **IAP OAuth** |
| **`env/`** | once per environment | logical DB + API / MCP / agent (Cloud Run + LB using stack IAP) / FE |

| Identity | State | Tfvars |
| --- | --- | --- |
| **nonprod** (stack) | `states/nonprod.tfstate` | `envs/nonprod.tfvars` |
| **sandbox** (env) | `states/sandbox.tfstate` | `envs/sandbox.tfvars` |
| **staging** (env) | `states/staging.tfstate` | `envs/staging.tfvars` |
| **prod** (env) | `states/prod.tfstate` | `envs/prod.tfvars` |

Sandbox/staging/prod **require** the project stack first. Env tfvars must list stack outputs (`sql_*`, `artifact_registry_*`, `deploy_sa_email`, `iap_*`) — no flags, no fallbacks.

## Apply order

```bash
cd infra

# 1) Project stack (once)
cp envs/nonprod.tfvars.example envs/nonprod.tfvars   # set project_id
terraform -chdir=stack init -reconfigure -backend-config=backends/nonprod.hcl
terraform -chdir=stack apply -var-file=../envs/nonprod.tfvars
terraform -chdir=stack output

# 2) Sandbox env (copy stack outputs into sandbox.tfvars)
cp envs/sandbox.tfvars.example envs/sandbox.tfvars
terraform -chdir=env init -reconfigure -backend-config=backends/sandbox.hcl
terraform -chdir=env apply -var-file=../envs/sandbox.tfvars
```

First Cloud SQL create can take **10–15 minutes**. Then deploy images (CI uses nonprod WIF + AR):

```bash
gh workflow run deploy-gcp.yml --ref dev
```

## Modules

| Module | Used by | Role |
| --- | --- | --- |
| `project_apis` | stack | Enable GCP APIs |
| `artifact_registry` | stack | Docker repo (`todo-nonprod-api`) |
| `github_deploy` | stack | Deploy SA + WIF pool |
| `sql_instance` | stack | Cloud SQL instance (`db-f1-micro`, zonal, 10 GB HDD) |
| `sql_database` | env | Logical DB + user on the stack instance |
| `apis` / `mcp` / `agent` / `frontends` / `secrets` | env | App stack |

### Agent (LangGraph) + IAP

**IAP is stack-owned** (one OAuth client + accessor list per GCP project). Env wires Cloud Run + HTTPS LB and passes through stack `iap_*` outputs.

**Keep OAuth consent Internal** (`orgInternalOnly`). Accessors must be Cloud Identity / Workspace users in the same org — consumer Gmail accounts get `403: org_internal` even if they own the GCP project. Use an address on your verified org domain (e.g. `you@valeriangeny.dev`), not `user:…@gmail.com`.

On the OAuth consent screen, set **support email** to that org address (or an org Google Group). The brand `supportEmail` is shown on the consent UI; keep personal Gmail off it.

Before apply:

1. Ensure Cloud Identity (or Workspace) is linked to the GCP org and you have a directory user on the org domain.
2. Create an **OAuth 2.0 Web client** (APIs & Services → Credentials). Redirect URI: `https://iap.googleapis.com/v1/oauth/clientIds/<CLIENT_ID>:handleRedirect`.
3. Set `iap_oauth_client_*` and `iap_members` (org users only) in **stack** tfvars (`nonprod.tfvars`); re-apply stack (also enables `compute` / `iap` / `aiplatform`).
4. Copy stack `iap_*` outputs into env tfvars; set per-env `agent_iap_host` and `copilot_host`.
5. DNS **A** for both hosts → `terraform -chdir=env output -raw agent_iap_ip` (before the managed cert can go ACTIVE).

Public URLs: `agent_iap_url` (Agent Server API), `copilot_url` (CopilotKit). Both share one LB IP + IAP.

### CopilotKit copilot

Required `copilot_host` (e.g. `copilot.valeriangeny.dev`). Same HTTPS LB/IAP. Browser stays on `copilot.*` (`/api/copilotkit`); Next.js runtime calls the Agent Server `run.app` URL with a Google ID token (copilot SA is `roles/run.invoker`). Agent ingress is **internal + Cloud Load Balancing** (not public `run.app`); copilot uses **Direct VPC egress** (`ALL_TRAFFIC` + Private Google Access on a dedicated `/24`) so that call is treated as internal.

```bash
docker build -f copilot/Dockerfile -t "$(terraform -chdir=infra/env output -raw copilot_image)" .
docker push "$(terraform -chdir=infra/env output -raw copilot_image)"
```

Domain WHOIS for Cloud Domains registrations should stay **REDACTED_CONTACT_DATA** (not public registrant email).

## Cost

One micro SQL instance per GCP project for shared nonprod envs; a dedicated prod GCP project gets its own stack instance. No HA; Cloud SQL via Unix socket `/cloudsql/…`. Agent module adds a small VPC for copilot Direct VPC egress (no Serverless VPC Access connector). Agent + copilot share a global HTTPS LB + static IP + managed cert (IAP).
