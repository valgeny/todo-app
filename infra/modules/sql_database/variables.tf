# -----------------------------------------------------------------------------
# modules/sql_database — logical DB + user on an existing Cloud SQL instance
# -----------------------------------------------------------------------------

variable "instance_name" {
  type        = string
  description = "Existing Cloud SQL instance name (e.g. todo-nonprod-pg)."
}

variable "db_name" {
  type        = string
  description = "Logical database name (e.g. todo_sandbox)."
}

variable "db_user" {
  type        = string
  description = "Database user name (e.g. todo_sandbox)."
}
