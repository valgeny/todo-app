# -----------------------------------------------------------------------------
# modules/apis — Cloud Run API + runtime SA + secret accessor + AR reader
#
# Non-secret config = plain env (defaults in variables.tf).
# Secrets = Secret Manager via secret_resources (e.g. DB_PASSWORD, CORS_ORIGINS).
# Postgres: mount Cloud SQL Unix sockets at /cloudsql; set DB_HOST to that path.
# -----------------------------------------------------------------------------

locals {
  # Do not set PORT — Cloud Run reserves it and injects the container port.
  # App envs always use Postgres (DB_* set from root).
  plain_env = {
    APP_ENV     = var.app_env
    ENVIRONMENT = var.environment
    HOST        = var.host
    LOG_FORMAT  = var.log_format
    DB_DIALECT  = var.db_dialect
    DB_NAME     = var.db_name
    DB_HOST     = var.db_host
    DB_PORT     = tostring(var.db_port)
    DB_USER     = var.db_user
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

    dynamic "volumes" {
      for_each = length(var.cloud_sql_instances) > 0 ? [1] : []
      content {
        name = "cloudsql"
        cloud_sql_instance {
          instances = var.cloud_sql_instances
        }
      }
    }

    containers {
      image = var.image

      ports {
        container_port = var.port
      }

      dynamic "volume_mounts" {
        for_each = length(var.cloud_sql_instances) > 0 ? [1] : []
        content {
          name       = "cloudsql"
          mount_path = "/cloudsql"
        }
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

  # Ignore gcloud client metadata and API-injected service-level scaling
  # (manual_instance_count / min) that drifts every refresh when unset.
  lifecycle {
    ignore_changes = [
      client,
      client_version,
      scaling,
    ]
  }
}

resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.api.name
  location = google_cloud_run_v2_service.api.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
