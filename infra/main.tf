# -----------------------------------------------------------------------------
# main.tf — Root stack: wire modules for Cloud Run API + optional FE bucket
#
# Modules:
#   project_apis      → enable GCP APIs
#   artifact_registry → Docker repo + Cloud Run pull IAM
#   secrets           → Secret Manager (CORS_ORIGINS + secret_env)
#   apis              → Cloud Run backend (SQLite) + runtime SA
#   frontends         → public GCS website bucket (optional)
#   github_deploy     → CI deploy SA + GitHub OIDC (WIF, no JSON keys)
#
# Naming: {name_prefix}-{environment}-…  (e.g. todo-sandbox-api)
# Apply:  terraform apply -var-file=envs/sandbox.tfvars
# Docs:   README.md | ../docs/ci-cd.md
#
# Caveat: SQLite on Cloud Run is ephemeral (lost on scale-to-zero / replace).
# -----------------------------------------------------------------------------

locals {
  enabled_apis = [
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
    "cloudbuild.googleapis.com",
    "secretmanager.googleapis.com",
  ]

  # e.g. todo-sandbox — keeps sandbox / staging / prod resources distinct in one project.
  prefix = "${var.name_prefix}-${var.environment}"

  common_labels = {
    app         = var.name_prefix
    environment = var.environment
    managed_by  = "terraform"
  }

  fe_bucket_name = "${var.project_id}-${local.prefix}-web"

  cors_origins = var.create_frontend_bucket ? "localhost,127.0.0.1,*.run.app,storage.googleapis.com,${local.fe_bucket_name}.storage.googleapis.com" : "localhost,127.0.0.1,*.run.app"

  managed_secrets = merge(
    {
      CORS_ORIGINS = local.cors_origins
    },
    var.secret_env
  )

  image = var.image != "" ? var.image : "${var.region}-docker.pkg.dev/${var.project_id}/${module.artifact_registry.repository_id}/${local.prefix}-api:latest"
}

# -----------------------------------------------------------------------------
# Modules
# -----------------------------------------------------------------------------

module "project_apis" {
  source = "./modules/project_apis"

  project_id = var.project_id
  apis       = local.enabled_apis
}

module "artifact_registry" {
  source = "./modules/artifact_registry"

  depends_on = [module.project_apis]

  project_id  = var.project_id
  region      = var.region
  prefix      = local.prefix
  environment = var.environment
  labels      = local.common_labels
}

module "secrets" {
  source = "./modules/secrets"

  depends_on = [module.project_apis]

  prefix  = local.prefix
  labels  = local.common_labels
  secrets = local.managed_secrets
}

module "apis" {
  source = "./modules/apis"

  depends_on = [module.project_apis, module.artifact_registry, module.secrets]

  prefix                     = local.prefix
  environment                = var.environment
  region                     = var.region
  labels                     = local.common_labels
  image                      = local.image
  artifact_registry_location = module.artifact_registry.location
  artifact_registry_name     = module.artifact_registry.name
  secret_resources           = module.secrets.secret_resources
}

module "github_deploy" {
  source = "./modules/github_deploy"

  depends_on = [module.project_apis]

  project_id                 = var.project_id
  environment                = var.environment
  artifact_registry_location = module.artifact_registry.location
  artifact_registry_name     = module.artifact_registry.name
  api_service_account_name   = module.apis.service_account_name
  github_repository          = var.github_repository
}

module "frontends" {
  source = "./modules/frontends"
  count  = var.create_frontend_bucket ? 1 : 0

  bucket_name = local.fe_bucket_name
  region      = var.region
  labels      = local.common_labels
  deploy_members = [
    "serviceAccount:${module.github_deploy.email}",
  ]
}
