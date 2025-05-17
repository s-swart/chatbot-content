variable "db_host" {
  description = "Supabase Postgres host URL"
  type        = string
}

variable "db_password" {
  description = "Password for Supabase Postgres user"
  type        = string
  sensitive   = true
}