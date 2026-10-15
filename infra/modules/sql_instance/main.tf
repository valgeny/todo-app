# -----------------------------------------------------------------------------
# modules/sql_instance — cheapest Cloud SQL Postgres for Cloud Run (Unix socket)
#
# nonprod stack → todo-nonprod-pg (shared by sandbox + staging)
# prod stack    → todo-prod-pg
# -----------------------------------------------------------------------------

resource "google_sql_database_instance" "main" {
  name                = var.instance_name
  project             = var.project_id
  database_version    = "POSTGRES_16"
  region              = var.region
  deletion_protection = var.deletion_protection

  settings {
    tier              = var.tier
    edition           = "ENTERPRISE"
    availability_type = "ZONAL"
    disk_size         = var.disk_size_gb
    disk_type         = var.disk_type
    user_labels       = var.labels

    ip_configuration {
      ipv4_enabled = true
      # Empty authorized networks: Cloud Run uses the Cloud SQL connector only.
    }

    backup_configuration {
      enabled = var.enable_backups
    }
  }
}
