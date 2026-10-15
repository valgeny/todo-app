output "db_name" {
  value       = google_sql_database.app.name
  description = "Logical database name (DB_NAME)."
}

output "db_user" {
  value       = google_sql_user.app.name
  description = "Database user (DB_USER)."
}

output "db_password" {
  value       = random_password.db.result
  description = "Database password (Secret Manager)."
  sensitive   = true
}

output "db_port" {
  value       = 5432
  description = "Postgres port (DB_PORT)."
}
