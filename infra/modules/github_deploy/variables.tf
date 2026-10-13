# -----------------------------------------------------------------------------
# modules/github_deploy — variables
# -----------------------------------------------------------------------------

variable "project_id" {
  type        = string
  description = "GCP project id."
}

variable "environment" {
  type        = string
  description = "Deployment environment (drives SA account_id)."
}

variable "artifact_registry_location" {
  type        = string
  description = "Artifact Registry location."
}

variable "artifact_registry_name" {
  type        = string
  description = "Artifact Registry repository name."
}

variable "api_service_account_name" {
  type        = string
  description = "API runtime SA resource name (for roles/iam.serviceAccountUser)."
}

variable "create_mcp" {
  type        = bool
  description = "When true, grant the deploy SA act-as on the MCP runtime SA (count must be plan-known)."
  default     = false
}

variable "mcp_service_account_name" {
  type        = string
  description = "MCP runtime SA resource name (for roles/iam.serviceAccountUser). Required when create_mcp."
  default     = ""
}

variable "github_repository" {
  type        = string
  description = "GitHub repo (owner/name) allowed to impersonate the deploy SA via WIF."
}
