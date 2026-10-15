# -----------------------------------------------------------------------------
# modules/sql_instance — Cloud SQL Postgres instance (shared nonprod or prod)
# -----------------------------------------------------------------------------

variable "project_id" {
  type        = string
  description = "GCP project id."
}

variable "instance_name" {
  type        = string
  description = "Cloud SQL instance name (e.g. todo-nonprod-pg, todo-prod-pg)."
}

variable "region" {
  type        = string
  description = "Cloud SQL region (match Cloud Run)."
}

variable "labels" {
  type        = map(string)
  description = "Labels for the instance."
  default     = {}
}

variable "tier" {
  type        = string
  description = "Machine tier. db-f1-micro is the cheapest shared-core Postgres tier."
  default     = "db-f1-micro"
}

variable "disk_size_gb" {
  type        = number
  description = "Disk size in GB (minimum 10)."
  default     = 10
}

variable "disk_type" {
  type        = string
  description = "PD_HDD is cheaper than PD_SSD for nonprod."
  default     = "PD_HDD"
}

variable "deletion_protection" {
  type        = bool
  description = "Block accidental instance destroy (true for prod)."
  default     = false
}

variable "enable_backups" {
  type        = bool
  description = "Enable automated backups (true for prod)."
  default     = false
}
