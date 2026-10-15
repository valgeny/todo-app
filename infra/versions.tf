# -----------------------------------------------------------------------------
# versions.tf — Terraform & provider constraints + local state backend
#
# Each environment must use its own state file:
#   terraform init -reconfigure -backend-config=backends/nonprod.hcl
#   terraform apply -var-file=envs/nonprod.tfvars
#   terraform init -reconfigure -backend-config=backends/sandbox.hcl
#   terraform apply -var-file=envs/sandbox.tfvars
# -----------------------------------------------------------------------------

terraform {
  required_version = ">= 1.5.0"

  backend "local" {
    # Overridden by backends/*.hcl (-backend-config). Default avoids clobbering.
    path = "states/default.tfstate"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}
