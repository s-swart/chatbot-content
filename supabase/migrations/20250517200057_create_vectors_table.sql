create table if not exists vectors (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  hash text unique not null, -- unique hash of the text chunk, used for deduplication and deletion
  metadata jsonb,
  embedding vector(1536) -- OpenAI embeddings (e.g. text-embedding-ada-002)
);

import 'dotenv/config'; // Loads variables from .env
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const RESUME_BLURBS_PATH = path.resolve(__dirname, '../resume-blurbs.md');
const CHUNK_SIZE = 2000; // Approximate characters for ~500 tokens

// Load sensitive credentials from .env file
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function embedText(text: string) {
  // Placeholder function to generate embeddings
  return Promise.resolve(null);
}

function upsertToSupabase(data: any) {
  // Placeholder function to upsert data to Supabase
  return Promise.resolve(null);
}

function hashText(text: string) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function splitIntoChunks(text: string, size: number) {
  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

async function main() {
  const fileContent = fs.readFileSync(RESUME_BLURBS_PATH, 'utf-8');

  // Split on level-2 headings '## '
  const sections = fileContent.split(/^##\s+/m).filter(Boolean);

  let globalIndex = 0;

  for (const section of sections) {
    // The first line is the heading title
    const [headingLine, ...rest] = section.split('\n');
    const heading = headingLine ? headingLine.trim() : 'Untitled Section';
    const content = rest.join('\n').trim();

    // Split content into ~500 token chunks (~2000 chars)
    const chunks = splitIntoChunks(content, CHUNK_SIZE);

    for (const chunk of chunks) {
      const trimmedChunk = chunk.trim();
      const chunkHash = hashText(trimmedChunk);
      const metadata = {
        section: heading,
        position: globalIndex,
      };

      console.log({
        heading,
        chunk: trimmedChunk,
        hash: chunkHash,
        metadata,
      });

      // Placeholder calls for embedding and upserting
      // const embedding = await embedText(trimmedChunk);
      // await upsertToSupabase({ heading, chunk: trimmedChunk, hash: chunkHash, embedding, metadata });

      globalIndex++;
    }
  }
}

main().catch(console.error);