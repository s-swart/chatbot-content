// scripts/dev/sync-resume-blurbs.ts
// ⚠️ This script uses DEV config and expects .env.dev unless overridden
//
// This script reads `chunks-with-metadata.json`, generates OpenAI embeddings for each chunk,
// and stores them in the Supabase `vectors` table. It deletes outdated entries not in the source.
//
// USE THIS WHEN:
// - You’ve made updates to your resume-blurbs content and want to sync it with your vector DB
// - You’re building a semantic search or chatbot that relies on up-to-date resume context
// - You want to verify vector counts and perform safe deduplication and deletion
//
// REQUIREMENTS:
// - OpenAI API key (OPENAI_API_KEY)
// - Supabase credentials (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)
// - `resume-blurbs.md` must exist in the root folder
import dotenv from 'dotenv'
dotenv.config({ path: process.env.ENV_FILE || '.env' })

const DRY_RUN = process.env.DRY_RUN === 'true'
const DEBUG_CHUNKS = true // Set to false to disable logging chunks
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { marked } from 'marked'

import { RESUME_BLURBS_PATH, OUTPUT_PATH as METADATA_PATH } from '../env/config'
const CHUNK_SIZE = 2000 // Approximate characters for ~500 tokens

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY } = process.env

// Uncomment the following for testing/debugging purposes only.
/*
console.log({
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: SUPABASE_SERVICE_ROLE_KEY?.slice(0, 5) + '...', // avoid leaking full key
  OPENAI_API_KEY: OPENAI_API_KEY?.slice(0, 5) + '...',
})
*/

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
  throw new Error("Missing one of SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or OPENAI_API_KEY in environment variables.")
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY })
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function hashText(text: string) {
  return crypto.createHash('sha256').update(text).digest('hex')
}

async function embedText(text: string): Promise<number[]> {
  try {
    const result = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    })
    return result.data[0].embedding
  } catch (err) {
    console.error('❌ Embedding failed for chunk:', text.slice(0, 30), err)
    throw err
  }
}

async function upsertToSupabase(data: {
  heading: string
  chunk: string
  hash: string
  embedding: number[]
  position: number
}) {
  const { error } = await supabase.from('vectors').upsert({
    content: data.chunk,
    hash: data.hash,
    metadata: {
      heading: data.heading,
      position: data.position,
    },
    embedding: data.embedding,
  })
  if (error) throw error
}

function validateChunk(chunk: any): boolean {
  return (
    typeof chunk.content === 'string' &&
    typeof chunk.hash === 'string' &&
    typeof chunk.metadata?.section_label === 'string' &&
    typeof chunk.metadata?.recency_score === 'number' &&
    chunk.metadata.recency_score >= 0 &&
    chunk.metadata.recency_score <= 1
  )
}

async function main() {
  const allHashes: string[] = []

  // 💡 Using DEV-specific metadata file
  const chunks = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf-8'))

  let upsertedChunks = 0
  let totalExpectedChunks = chunks.length

  for (const [index, chunkData] of chunks.entries()) {
    if (!validateChunk(chunkData)) {
      console.warn(`⚠️ Skipping invalid chunk #${index + 1}`, chunkData)
      continue
    }

    if (chunkData.metadata.recency_score === 0 || chunkData.metadata.recency_score === 1) {
      console.warn(`⚠️ Extreme score on chunk #${index + 1}:`, chunkData.metadata)
    }

    if (allHashes.includes(chunkData.hash)) {
      console.warn(`⚠️ Duplicate hash found at chunk #${index + 1}: ${chunkData.hash}`)
    }

    const { content, hash, metadata } = chunkData
    if (DEBUG_CHUNKS) {
      console.log(`🔍 Chunk #${index + 1}: ${content.slice(0, 100)}...`)
    }
    allHashes.push(hash)
    const embedding = await embedText(content)

    try {
      if (!DRY_RUN) {
        await upsertToSupabase({
          heading: metadata.section_label || 'Resume',
          chunk: content,
          hash,
          embedding,
          position: metadata.position ?? index,
        });
        console.log(`✅ Upserted chunk #${index + 1}`);
        upsertedChunks++
      } else {
        console.log(`🧪 Dry run — would upsert chunk #${index + 1}: ${metadata.section_label}`)
      }
    } catch (err: any) {
      if (
        err?.message?.includes('duplicate key value') ||
        err?.details?.includes('already exists')
      ) {
        console.log(`🔁 Skipped existing chunk #${index + 1} (already upserted)`)
      } else {
        console.error(`❌ Failed to upsert chunk #${index + 1}`, err)
      }
    }
  }

  const { data: existingRows, error: fetchError } = await supabase
    .from('vectors')
    .select('hash')

  if (fetchError) {
    console.error('❌ Failed to fetch existing vector hashes:', fetchError)
    return
  }

  const existingHashes = new Set((existingRows ?? []).map((row) => row.hash))
  const currentHashes = new Set(allHashes)
  const hashesToDelete = [...existingHashes].filter((h) => !currentHashes.has(h))

  if (hashesToDelete.length > 0) {
    if (!DRY_RUN) {
      const { error: deleteError } = await supabase
        .from('vectors')
        .delete()
        .in('hash', hashesToDelete)

      if (deleteError) {
        console.error('❌ Failed to delete outdated hashes:', deleteError)
      } else {
        console.log(`🧹 Deleted ${hashesToDelete.length} outdated vector(s).`)
      }
    } else {
      console.log(`🧪 Dry run — would delete ${hashesToDelete.length} outdated vector(s).`)
    }
  }

  console.log(`✨ Done. Upserted ${upsertedChunks} new chunks from ${chunks.length} chunks.`)

  // Verify that the number of vectors in the database matches the number of chunks sent over
  const { count, error: countError } = await supabase
    .from('vectors')
    .select('*', { count: 'exact', head: true })

  if (countError) {
    console.error('❌ Failed to count vectors in database:', countError)
  } else if (count !== totalExpectedChunks) {
    console.warn(`⚠️ Vector count mismatch: expected ${totalExpectedChunks}, but found ${count} in database.`)
  } else {
    console.log(`✅ Vector count verified: ${count} vectors present.`)
  }
}

async function run() {
  if (!DRY_RUN) {
    const readline = await import('node:readline/promises')
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    const confirm = await rl.question('⚠️ This will write to your production Supabase database. Type YES to continue: ')
    rl.close()
    if (confirm !== 'YES') {
      console.log('❌ Aborted by user.')
      process.exit(0)
    }
  }
  await main()
}

run().catch(console.error)