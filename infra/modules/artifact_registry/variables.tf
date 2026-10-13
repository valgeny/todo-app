# -----------------------------------------------------------------------------
# modules/artifact_registry — variables
# -----------------------------------------------------------------------------

variable "project_id" {
  type        = string
  description = "GCP project id."
}

variable "region" {
  type        = string
  description = "Artifact Registry location."
}

variable "prefix" {
  type        = string
  description = "Resource name prefix (e.g. todo-sandbox)."
}

variable "environment" {
  type        = string
  description = "Deployment environment (for description / labels context)."
}

variable "labels" {
  type        = map(string)
  description = "Labels applied to the repository."
  default     = {}
}
