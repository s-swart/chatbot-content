provider "postgresql" {
  host            = var.db_host
  port            = 5432
  database        = "postgres"
  username        = "postgres"
  password        = var.db_password
  sslmode         = "require"
}