# -----------------------------------------------------------------------------
# modules/apis — Cloud Run API (SQLite) + runtime SA + secret accessor + AR reader
#
# Non-secret config = plain env (defaults in variables.tf).
# Secrets = Secret Manager via secret_resources.
# Caveat: SQLite on Cloud Run is ephemeral (lost on scale-to-zero / replace).
# -----------------------------------------------------------------------------

locals {
  # Do not set PORT — Cloud Run reserves it and injects the container port.
  plain_env = {
    APP_ENV     = var.app_env
    ENVIRONMENT = var.environment
    HOST        = var.host
    LOG_FORMAT  = var.log_format
    DB_DIALECT  = var.db_dialect
    DB_NAME     = var.db_name
  }
}

resource "google_service_account" "api" {
  account_id   = "${var.prefix}-api"
  display_name = "Todo API Cloud Run (${var.environment})"
}

resource "google_artifact_registry_repository_iam_member" "api_reader" {
  location   = var.artifact_registry_location
  repository = var.artifact_registry_name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.api.email}"
}

resource "google_secret_manager_secret_iam_member" "api_accessor" {
  for_each = var.secret_resources

  secret_id = each.value.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.api.email}"
}

# CI / deploy identities that may gcloud run deploy this service (act-as runtime SA).
resource "google_service_account_iam_member" "deploy_acts_as" {
  for_each = toset(var.deploy_members)

  service_account_id = google_service_account.api.name
  role               = "roles/iam.serviceAccountUser"
  member             = each.value
}

resource "google_cloud_run_v2_service" "api" {
  depends_on = [
    google_artifact_registry_repository_iam_member.api_reader,
    google_secret_manager_secret_iam_member.api_accessor,
  ]

  name     = "${var.prefix}-api"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"
  labels   = var.labels

  # Allow terraform destroy / replace (provider default is true).
  deletion_protection = false

  template {
    service_account = google_service_account.api.email
    labels          = var.labels

    scaling {
      min_instance_count = 0
      max_instance_count = 1
    }

    containers {
      image = var.image

      ports {
        container_port = var.port
      }

      dynamic "env" {
        for_each = local.plain_env
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = var.secret_resources
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value.secret_id
              version = "latest"
            }
          }
        }
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle = true
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  # Ignore gcloud client metadata; image may be missing on first apply.
  lifecycle {
    ignore_changes = [
      client,
      client_version,
    ]
  }
}

resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.api.name
  location = google_cloud_run_v2_service.api.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
