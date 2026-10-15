# -----------------------------------------------------------------------------
# main.tf — Project-level stack (once per GCP project)
#
# Creates: project APIs, Artifact Registry, WIF + deploy SA, Cloud SQL instance.
# Does not create: Cloud Run, logical DB, FE, secrets.
#
# Apply before any env in this project:
#   terraform -chdir=stack init -reconfigure -backend-config=backends/nonprod.hcl
#   terraform -chdir=stack apply -var-file=../envs/nonprod.tfvars
# -----------------------------------------------------------------------------

locals {
  enabled_apis = [
    "sqladmin.googleapis.com",
    "iam.googleapis.com",
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
    "cloudbuild.googleapis.com",
    "secretmanager.googleapis.com",
  ]

  # AR: todo-nonprod-api. SQL: todo-nonprod-pg. SA: gh-deploy-nonprod.
  prefix = "${var.name_prefix}-${var.environment}"

  sql_instance_id = "${var.name_prefix}-${var.environment}-pg"

  common_labels = {
    app         = var.name_prefix
    environment = var.environment
    managed_by  = "terraform"
  }
}

module "project_apis" {
  source = "../modules/project_apis"

  project_id = var.project_id
  apis       = local.enabled_apis
}

module "sql_instance" {
  source = "../modules/sql_instance"

  depends_on = [module.project_apis]

  project_id          = var.project_id
  instance_name       = local.sql_instance_id
  region              = var.region
  labels              = local.common_labels
  deletion_protection = var.environment == "prod"
  enable_backups      = var.environment == "prod"
}

module "artifact_registry" {
  source = "../modules/artifact_registry"

  depends_on = [module.project_apis]

  project_id  = var.project_id
  region      = var.region
  prefix      = local.prefix
  environment = var.environment
  labels      = local.common_labels
}

module "github_deploy" {
  source = "../modules/github_deploy"

  depends_on = [module.project_apis, module.artifact_registry]

  project_id                 = var.project_id
  environment                = var.environment
  artifact_registry_location = module.artifact_registry.location
  artifact_registry_name     = module.artifact_registry.name
  github_repository          = var.github_repository
}
