output "instance_name" {
  value       = google_sql_database_instance.main.name
  description = "Cloud SQL instance name."
}

output "connection_name" {
  value       = google_sql_database_instance.main.connection_name
  description = "project:region:instance for Cloud Run / Unix socket."
}
