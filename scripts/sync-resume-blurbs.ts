// sync-resume-blurbs.ts
//
// PURPOSE:
// This script reads your `resume-blurbs.md` file, splits it into content chunks,
// generates OpenAI embeddings for each chunk, and stores them in the Supabase `vectors` table.
// It also deletes outdated vectors that are no longer in the source file.
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
dotenv.config()

const DEBUG_CHUNKS = true // Set to false to disable logging chunks
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { marked } from 'marked'

const RESUME_BLURBS_PATH = path.resolve(__dirname, '../private/resume-blurbs.md')
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

function smartChunkMarkdown(input: string, maxLen = 1800): string[] {
  // Split at every level-2 heading (## ...)
  const sections = input.split(/^##\s+/gm).filter(Boolean)
  const chunks: string[] = []

  for (const section of sections) {
    const lines = section.trim().split('\n')
    const heading = lines[0]?.trim()
    const body = lines.slice(1).join('\n').trim()

    if (!body) continue

    let currentChunk = `## ${heading}\n`
    let currentLength = currentChunk.length

    // Split body into paragraphs (by two or more newlines)
    const paragraphs = body.split(/\n{2,}/)

    for (const para of paragraphs) {
      const paraLen = para.length + 2 // +2 for spacing

      if (currentLength + paraLen > maxLen) {
        chunks.push(currentChunk.trim())
        currentChunk = ''
        currentLength = 0
      }

      // If starting a new chunk, add heading
      if (!currentChunk) {
        currentChunk = `## ${heading}\n`
        currentLength = currentChunk.length
      }

      currentChunk += para + '\n\n'
      currentLength += paraLen
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim())
    }
  }

  return chunks
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

async function main() {
  const allHashes: string[] = []

  const fileContent = fs.readFileSync(RESUME_BLURBS_PATH, 'utf-8')
  
  const chunks = smartChunkMarkdown(fileContent)
  let globalIndex = 0
  let upsertedChunks = 0
  let totalExpectedChunks = chunks.length

  for (const chunk of chunks) {
    const trimmed = chunk.trim()
    if (DEBUG_CHUNKS) {
      console.log(`🔍 Chunk #${globalIndex + 1}/${chunks.length}: ${trimmed.slice(0, 100)}...`)
    }
    const chunkHash = hashText(trimmed)
    allHashes.push(chunkHash)
    const embedding = await embedText(trimmed)

    try {
      await upsertToSupabase({
        heading: 'Resume', // Generic heading since we're chunking the full doc
        chunk: trimmed,
        hash: chunkHash,
        embedding,
        position: globalIndex++,
      });
      console.log(`✅ Upserted chunk #${globalIndex}`);
      upsertedChunks++;
    } catch (err: any) {
      if (
        err?.message?.includes('duplicate key value') ||
        err?.details?.includes('already exists')
      ) {
        console.log(`🔁 Skipped existing chunk #${globalIndex} (already upserted)`);
      } else {
        console.error(`❌ Failed to upsert chunk #${globalIndex}`, err);
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
    const { error: deleteError } = await supabase
      .from('vectors')
      .delete()
      .in('hash', hashesToDelete)

    if (deleteError) {
      console.error('❌ Failed to delete outdated hashes:', deleteError)
    } else {
      console.log(`🧹 Deleted ${hashesToDelete.length} outdated vector(s).`)
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

main().catch(console.error)