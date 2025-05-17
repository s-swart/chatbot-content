resource "postgresql_schema" "public" {
  name = "public"
}

resource "postgresql_extension" "vector" {
  name = "vector"
}

resource "postgresql_table" "vectors" {
  name     = "vectors"
  schema   = postgresql_schema.public.name

  owner    = "postgres"

  depends_on = [postgresql_extension.vector]

  column {
    name = "id"
    type = "uuid"
    default = "gen_random_uuid()"
  }

  column {
    name = "content"
    type = "text"
    null = false
  }

  column {
    name = "metadata"
    type = "jsonb"
  }

  column {
    name = "embedding"
    type = "vector(1536)"
  }

  primary_key {
    name    = "vectors_pkey"
    columns = ["id"]
  }
}