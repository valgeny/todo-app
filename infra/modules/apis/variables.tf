# -----------------------------------------------------------------------------
# modules/apis — variables
#
# Non-secret Cloud Run env: defaults here; override per env from the root module
# when needed. Secrets come from secret_resources (Secret Manager).
# -----------------------------------------------------------------------------

variable "prefix" {
  type        = string
  description = "Resource name prefix (e.g. todo-sandbox)."
}

variable "environment" {
  type        = string
  description = "Deployment environment (sandbox | staging | prod). Also set as ENVIRONMENT."
}

variable "region" {
  type        = string
  description = "Cloud Run region."
}

variable "labels" {
  type        = map(string)
  description = "Labels applied to the service and SA-related resources."
  default     = {}
}

variable "image" {
  type        = string
  description = "Full container image URI for Cloud Run."
}

variable "artifact_registry_location" {
  type        = string
  description = "Artifact Registry location (for runtime SA reader IAM)."
}

variable "artifact_registry_name" {
  type        = string
  description = "Artifact Registry repository name (for runtime SA reader IAM)."
}

variable "secret_resources" {
  type = map(object({
    id        = string
    secret_id = string
  }))
  description = "Secrets to mount as Cloud Run env (and grant secretAccessor)."
}

variable "deploy_members" {
  type        = list(string)
  description = "Principals allowed to act as the API runtime SA (e.g. CI deploy SA)."
  default     = []
}

# --- Non-secret app env (platform-injected; no .env file on Cloud Run) ---

variable "app_env" {
  type        = string
  description = "APP_ENV value (selects optional local dotenv file name when present)."
  default     = "cloudrun"
}

variable "port" {
  type        = number
  description = "Container listen port (Cloud Run PORT + container_port)."
  default     = 8080
}

variable "host" {
  type        = string
  description = "Bind address (HOST)."
  default     = "0.0.0.0"
}

variable "log_format" {
  type        = string
  description = "Morgan LOG_FORMAT (combined | common | dev | short | tiny)."
  default     = "tiny"
}

variable "db_dialect" {
  type        = string
  description = "DB_DIALECT (sqlite | postgres)."
  default     = "sqlite"
}

variable "db_name" {
  type        = string
  description = "DB_NAME (sqlite path or postgres database name)."
  default     = "data/todo.sqlite"
}

variable "db_host" {
  type        = string
  description = "DB_HOST (Cloud SQL Unix socket path)."
}

variable "db_port" {
  type        = number
  description = "DB_PORT (5432)."
}

variable "db_user" {
  type        = string
  description = "DB_USER."
}

variable "cloud_sql_instances" {
  type        = list(string)
  description = "Cloud SQL instance connection names to mount at /cloudsql."
  default     = []
}
