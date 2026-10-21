# -----------------------------------------------------------------------------
# versions.tf — Terraform & provider constraints + local state backend
#
# Once per GCP project (nonprod today; prod project later):
#   terraform -chdir=stack init -reconfigure -backend-config=backends/nonprod.hcl
#   terraform -chdir=stack apply -var-file=../envs/nonprod.tfvars
# -----------------------------------------------------------------------------

terraform {
  required_version = ">= 1.5.0"

  backend "local" {
    path = "../states/default.tfstate"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}
