# -----------------------------------------------------------------------------
# modules/project_apis — variables
# -----------------------------------------------------------------------------

variable "project_id" {
  type        = string
  description = "GCP project id."
}

variable "apis" {
  type        = list(string)
  description = "API service names to enable (e.g. run.googleapis.com)."
}
