# -----------------------------------------------------------------------------
# modules/agent — variables (LangGraph API Cloud Run + IAP HTTPS LB)
# -----------------------------------------------------------------------------

variable "project_id" {
  type        = string
  description = "GCP project id."
}

variable "prefix" {
  type        = string
  description = "Resource name prefix (e.g. todo-sandbox)."
}

variable "environment" {
  type        = string
  description = "Deployment environment."
}

variable "region" {
  type        = string
  description = "Cloud Run region."
}

variable "labels" {
  type        = map(string)
  description = "Resource labels."
  default     = {}
}

variable "image" {
  type        = string
  description = "Full container image URI for the agent LangGraph API service."
}

variable "mcp_endpoint" {
  type        = string
  description = "TODO_MCP_URL — Streamable HTTP MCP endpoint."
}

variable "artifact_registry_location" {
  type        = string
  description = "Artifact Registry location."
}

variable "artifact_registry_name" {
  type        = string
  description = "Artifact Registry repository name."
}

variable "deploy_members" {
  type        = list(string)
  description = "Principals allowed to act as the agent runtime SA."
  default     = []
}

variable "app_env" {
  type        = string
  description = "APP_ENV value."
  default     = "cloudrun"
}

variable "port" {
  type        = number
  description = "Container port (Cloud Run sets PORT)."
  default     = 8080
}

variable "iap_host" {
  type        = string
  description = "Public hostname for the Agent Server (DNS A → static IP)."
}

variable "ui_host" {
  type        = string
  description = <<-EOT
    Public hostname for CopilotKit agent-ui (DNS A → same LB IP as iap_host).
    Browser stays on this host (/api/copilotkit); runtime calls Agent Server IAM.
  EOT
}

variable "ui_image" {
  type        = string
  description = "Full container image URI for agent-ui."
}

variable "ui_assistant_id" {
  type        = string
  description = "LANGGRAPH_GRAPH_ID / CopilotKit agent key (must match langgraph.json)."
  default     = "todo_agent"
}

variable "iap_oauth_client_id" {
  type        = string
  description = "OAuth 2.0 client ID for IAP (Desktop/Web client created in GCP Console)."
}

variable "iap_oauth_client_secret" {
  type        = string
  description = "OAuth 2.0 client secret for IAP."
  sensitive   = true
}

variable "iap_members" {
  type        = list(string)
  description = <<-EOT
    Principals allowed through IAP (e.g. user:you@example.com,
    group:eng@example.com, domain:example.com).
  EOT
}

variable "langsmith_api_key" {
  type        = string
  description = "LANGSMITH_API_KEY — required by the licensed langgraph-api image for self-host."
  sensitive   = true
}
