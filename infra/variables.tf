# -----------------------------------------------------------------------------
# variables.tf — Input variables for the todo-app GCP stack
#
# Required: project_id, environment
# Env-specific values: envs/{nonprod,sandbox,staging,prod}.tfvars
# Use a matching backends/*.hcl so each env has its own local state.
# -----------------------------------------------------------------------------

variable "project_id" {
  type        = string
  description = "GCP project id where billing/credits apply."
}

variable "environment" {
  type        = string
  description = <<-EOT
    nonprod  — Cloud SQL instance only (todo-nonprod-pg); apply once before sandbox/staging
    sandbox | staging — app stack + logical DB on todo-nonprod-pg
    prod — own Cloud SQL (todo-prod-pg) + app stack
  EOT

  validation {
    condition     = contains(["nonprod", "sandbox", "staging", "prod"], var.environment)
    error_message = "environment must be one of: nonprod, sandbox, staging, prod."
  }
}

variable "region" {
  type        = string
  description = "Region for Artifact Registry, Cloud Run, Cloud SQL, and the optional FE bucket."
  default     = "us-central1"
}

variable "name_prefix" {
  type        = string
  description = "Base name prefix (instances: {prefix}-nonprod-pg / {prefix}-prod-pg; apps: {prefix}-{env}-…)."
  default     = "todo"
}

variable "image" {
  type        = string
  description = <<-EOT
    Full container image URI for the API (Artifact Registry). Ignored for nonprod.
    Leave empty to use the default …/{prefix}-api:latest path.
  EOT
  default     = ""
}

variable "create_frontend_bucket" {
  type        = bool
  description = "Create a public GCS bucket for static web hosting (app envs only)."
  default     = true
}

variable "secret_env" {
  type        = map(string)
  description = <<-EOT
    Extra sensitive env vars for app envs (Secret Manager). CORS_ORIGINS and
    DB_PASSWORD are managed automatically — do not set DB_PASSWORD here.
  EOT
  sensitive   = true
  default     = {}
}

variable "github_repository" {
  type        = string
  description = "GitHub repository (owner/name) for WIF deploy (app envs only)."
  default     = "valgeny/todo-app"
}

variable "mcp_image" {
  type        = string
  description = "Full container image URI for the MCP service. Empty = default …/{prefix}-mcp:latest."
  default     = ""
}
