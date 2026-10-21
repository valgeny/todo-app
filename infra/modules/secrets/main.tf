# -----------------------------------------------------------------------------
# modules/secrets — Secret Manager secrets + versions (CORS_ORIGINS, secret_env)
# Accessor IAM is granted by the apis module (needs the runtime SA).
# -----------------------------------------------------------------------------

resource "google_secret_manager_secret" "app" {
  for_each = local.secret_keys

  secret_id = "${var.prefix}-${lower(replace(each.key, "_", "-"))}"
  labels    = var.labels

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "app" {
  for_each = local.secret_keys

  secret      = google_secret_manager_secret.app[each.key].id
  secret_data = var.secrets[each.key]
}

locals {
  # Values may be sensitive; keys must not be — for_each forbids sensitive maps.
  secret_keys = nonsensitive(toset(keys(var.secrets)))
}
