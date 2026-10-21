# -----------------------------------------------------------------------------
# variables.tf — Project-level stack (APIs, AR, WIF, SQL instance)
#
# Tfvars: ../envs/nonprod.tfvars (and later prod for a second GCP project).
# -----------------------------------------------------------------------------

variable "project_id" {
  type        = string
  description = "GCP project id where billing/credits apply."
}

variable "environment" {
  type        = string
  description = "Name tag for this GCP project's stack (nonprod | prod)."

  validation {
    condition     = contains(["nonprod", "prod"], var.environment)
    error_message = "environment must be nonprod or prod."
  }
}

variable "region" {
  type        = string
  description = "Region for Artifact Registry and Cloud SQL."
  default     = "us-central1"
}

variable "name_prefix" {
  type        = string
  description = "Base name prefix (SQL: {prefix}-{env}-pg; AR: {prefix}-{env}-api)."
  default     = "todo"
}

variable "github_repository" {
  type        = string
  description = "GitHub repository (owner/name) for WIF deploy."
  default     = "valgeny/todo-app"
}

# IAP is project-scoped (one OAuth client for HTTPS LBs in this GCP project).
variable "iap_oauth_client_id" {
  type        = string
  description = "OAuth 2.0 client ID for IAP (APIs & Services → Credentials)."
}

variable "iap_oauth_client_secret" {
  type        = string
  description = "OAuth 2.0 client secret for IAP."
  sensitive   = true
}

variable "iap_members" {
  type        = list(string)
  description = "Principals allowed through IAP (user:/group:/domain:)."
}
