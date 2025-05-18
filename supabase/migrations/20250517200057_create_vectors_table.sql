-- Migration: create_vectors_table.sql
--
-- PURPOSE:
-- This SQL file defines the `vectors` table, which stores text content chunks
-- along with their OpenAI embedding vectors, hashes for deduplication, and metadata.
--
-- USE THIS WHEN:
-- - You are setting up the database schema to support embedding-based semantic search
-- - You want to persist vectorized representations of markdown or resume blurbs
--
-- TABLE DETAILS:
-- - `id`: unique UUID for each row
-- - `content`: the original text chunk
-- - `hash`: a unique SHA-256 hash of the chunk to avoid duplication
-- - `metadata`: additional information like the section heading
-- - `embedding`: vector(1536) from OpenAI models (e.g. ada-002)

create table if not exists vectors (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  hash text unique not null, -- unique hash of the text chunk, used for deduplication and deletion
  metadata jsonb,
  embedding vector(1536) -- OpenAI embeddings (e.g. text-embedding-ada-002)
);