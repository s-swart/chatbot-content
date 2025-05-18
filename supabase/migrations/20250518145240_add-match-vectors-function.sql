-- Migration: add-match-vectors-function.sql
--
-- PURPOSE:
-- This SQL function enables semantic search by comparing OpenAI-generated embeddings
-- against vectors stored in the `vectors` table. It is used by the chatbot and
-- semantic search scripts to retrieve the most relevant resume blurbs.
--
-- USE THIS WHEN:
-- - You need to retrieve top-N most similar content chunks to a user query
-- - You are embedding a question and want to match it against existing vector data
--
-- INPUTS:
-- - query_embedding: a vector(1536) from OpenAI
-- - match_threshold: the maximum distance allowed for a match
-- - match_count: how many top matches to return
--
-- OUTPUT:
-- - Rows of matching content, metadata, and similarity score (1 - distance)

create or replace function match_vectors (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    id,
    content,
    metadata,
    1 - (embedding <=> query_embedding) as similarity
  from vectors
  where (embedding <=> query_embedding) < match_threshold
  order by (embedding <=> query_embedding) asc
  limit match_count;
$$;