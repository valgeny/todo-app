# -----------------------------------------------------------------------------
# variables.tf — Input variables for the todo-app GCP stack
#
# Required: project_id, environment
# Optional: region, name_prefix, image, create_frontend_bucket, secret_env
#
# Env-specific values live under envs/ (e.g. envs/sandbox.tfvars).
# Resource names use: {name_prefix}-{environment}-…  (e.g. todo-sandbox-api)
# -----------------------------------------------------------------------------

variable "project_id" {
  type        = string
  description = "GCP project id where billing/credits apply."
}

variable "environment" {
  type        = string
  description = <<-EOT
    Deployment environment. Drives resource names, labels, and Cloud Run
    ENVIRONMENT. Allowed: sandbox | staging | prod.
  EOT

  validation {
    condition     = contains(["sandbox", "staging", "prod"], var.environment)
    error_message = "environment must be one of: sandbox, staging, prod."
  }
}

variable "region" {
  type        = string
  description = "Region for Artifact Registry, Cloud Run, and the optional FE bucket."
  default     = "us-central1"
}

variable "name_prefix" {
  type        = string
  description = "Base name prefix; combined with environment as {name_prefix}-{environment}."
  default     = "todo"
}

variable "image" {
  type        = string
  description = <<-EOT
    Full container image URI for the API (Artifact Registry).
    Leave empty on first apply to use the default …/{prefix}-api:latest path;
    build/push that image, then re-apply or gcloud run deploy.
  EOT
  default     = ""
}

variable "create_frontend_bucket" {
  type        = bool
  description = "Create a public GCS bucket for static web hosting (no HTTPS load balancer)."
  default     = true
}

variable "secret_env" {
  type        = map(string)
  description = <<-EOT
    Extra sensitive env vars stored in Secret Manager and injected into Cloud Run
    (key = env name, value = secret data). CORS_ORIGINS is always managed.
    Example when adding Cloud SQL later: { DB_PASSWORD = "…", DB_USER = "todo" }.
  EOT
  sensitive   = true
  default     = {}
}

variable "github_repository" {
  type        = string
  description = "GitHub repository (owner/name) allowed to deploy via Workload Identity Federation."
  default     = "valgeny/todo-app"
}
