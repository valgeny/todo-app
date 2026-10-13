# -----------------------------------------------------------------------------
# providers.tf — Google provider (project / region from variables)
#
# Auth: Application Default Credentials
#   gcloud auth application-default login
#   gcloud config set project <project_id>
# -----------------------------------------------------------------------------

provider "google" {
  project = var.project_id
  region  = var.region
}
