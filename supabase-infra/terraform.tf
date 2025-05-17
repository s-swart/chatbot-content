terraform {
  required_providers {
    postgresql = {
      source  = "cyrilgdn/postgresql"
      version = "~> 1.20.0"
    }
  }

  backend "local" {
    path = "./terraform.tfstate"
  }
}
