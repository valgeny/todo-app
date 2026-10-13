# -----------------------------------------------------------------------------
# modules/secrets — outputs
# -----------------------------------------------------------------------------

output "secret_ids" {
  value       = { for k, s in google_secret_manager_secret.app : k => s.secret_id }
  description = "Map of env name → Secret Manager secret_id."
}

output "secret_resources" {
  value = {
    for k, s in google_secret_manager_secret.app : k => {
      id        = s.id
      secret_id = s.secret_id
    }
  }
  description = "Secrets for IAM / Cloud Run secret_key_ref (id + secret_id)."
}
