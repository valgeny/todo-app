# -----------------------------------------------------------------------------
# modules/frontends — outputs
# -----------------------------------------------------------------------------

output "bucket_name" {
  value       = google_storage_bucket.frontend.name
  description = "GCS bucket name for web/dist uploads."
}

output "website_url" {
  value       = "https://storage.googleapis.com/${google_storage_bucket.frontend.name}/index.html"
  description = "Public object URL for the SPA (not a custom domain)."
}
