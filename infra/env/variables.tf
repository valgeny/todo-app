# -----------------------------------------------------------------------------
# variables.tf — App environment stack (identical for sandbox / staging / prod)
#
# Required stack outputs: sql_*, artifact_registry_*, deploy_sa_email, iap_*.
# -----------------------------------------------------------------------------

variable "project_id" {
  type        = string
  description = "GCP project id where billing/credits apply."
}

variable "environment" {
  type        = string
  description = "App environment name (sandbox | staging | prod)."

  validation {
    condition     = contains(["sandbox", "staging", "prod"], var.environment)
    error_message = "environment must be one of: sandbox, staging, prod."
  }
}

variable "region" {
  type        = string
  description = "Region for Cloud Run and the FE bucket."
  default     = "us-central1"
}

variable "name_prefix" {
  type        = string
  description = "Base name prefix (apps: {prefix}-{env}-…)."
  default     = "todo"
}

variable "sql_instance_name" {
  type        = string
  description = "Cloud SQL instance name from the project stack output."
}

variable "sql_connection_name" {
  type        = string
  description = "Cloud SQL connection name from the project stack output."
}

variable "artifact_registry_repository_id" {
  type        = string
  description = "Artifact Registry repository id from the project stack output."
}

variable "artifact_registry_location" {
  type        = string
  description = "Artifact Registry location from the project stack output."
}

variable "artifact_registry_name" {
  type        = string
  description = "Full Artifact Registry repository name from the project stack output."
}

variable "deploy_sa_email" {
  type        = string
  description = "GitHub deploy SA email from the project stack output."
}

variable "iap_oauth_client_id" {
  type        = string
  description = "IAP OAuth client ID from the project stack output."
}

variable "iap_oauth_client_secret" {
  type        = string
  description = "IAP OAuth client secret from the project stack output."
  sensitive   = true
}

variable "iap_members" {
  type        = list(string)
  description = "IAP accessors from the project stack output."
}

variable "image" {
  type        = string
  description = "Full container image URI for the API. Empty = default …/{prefix}-api:latest."
  default     = ""
}

variable "mcp_image" {
  type        = string
  description = "Full container image URI for the MCP service. Empty = default …/{prefix}-mcp:latest."
  default     = ""
}

variable "agent_image" {
  type        = string
  description = "Full container image URI for the LangGraph agent. Empty = default …/{prefix}-agent:latest."
  default     = ""
}

variable "agent_iap_host" {
  type        = string
  description = "DNS hostname for the agent IAP HTTPS load balancer (e.g. agent.example.com)."
}

variable "agent_ui_host" {
  type        = string
  description = "DNS hostname for CopilotKit agent-ui on the same LB IP (e.g. ui.example.com)."
}

variable "agent_ui_image" {
  type        = string
  description = "Full container image URI for agent-ui. Empty = default …/{prefix}-agent-ui:latest."
  default     = ""
}

variable "agent_langsmith_api_key" {
  type        = string
  description = "LangSmith API key for the licensed LangGraph API image (sandbox/dev self-host)."
  sensitive   = true
}

variable "secret_env" {
  type        = map(string)
  description = <<-EOT
    Extra sensitive env vars (Secret Manager). CORS_ORIGINS and DB_PASSWORD are
    managed automatically — do not set DB_PASSWORD here.
  EOT
  sensitive   = true
  default     = {}
}
