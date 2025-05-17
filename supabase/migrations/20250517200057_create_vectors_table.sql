create table if not exists vectors (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  hash text unique not null, -- unique hash of the text chunk, used for deduplication and deletion
  metadata jsonb,
  embedding vector(1536) -- OpenAI embeddings (e.g. text-embedding-ada-002)
);