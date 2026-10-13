# -----------------------------------------------------------------------------
# modules/mcp — variables
# -----------------------------------------------------------------------------

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
  description = "Full container image URI for the MCP service."
}

variable "api_uri" {
  type        = string
  description = "Todo REST API base URL (injected as TODO_API_ORIGIN)."
}

variable "artifact_registry_location" {
  type        = string
  description = "Artifact Registry location."
}

variable "artifact_registry_name" {
  type        = string
  description = "Artifact Registry repository name (shared with API images)."
}

variable "deploy_members" {
  type        = list(string)
  description = "Principals allowed to act as the MCP runtime SA (e.g. CI deploy SA)."
  default     = []
}

variable "app_env" {
  type        = string
  description = "APP_ENV value."
  default     = "cloudrun"
}

variable "port" {
  type        = number
  description = "Container port (Cloud Run sets PORT automatically)."
  default     = 8080
}
