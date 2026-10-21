# -----------------------------------------------------------------------------
# versions.tf — Terraform & provider constraints + local state backend
#
# Identical apply per app environment:
#   terraform -chdir=env init -reconfigure -backend-config=backends/sandbox.hcl
#   terraform -chdir=env apply -var-file=../envs/sandbox.tfvars
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
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}
