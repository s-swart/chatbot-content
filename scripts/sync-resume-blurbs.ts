import dotenv from 'dotenv'
dotenv.config()
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const RESUME_BLURBS_PATH = path.resolve(__dirname, '../resume-blurbs.md')
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

function splitIntoChunks(text: string, size: number): string[] {
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size))
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
  const sections: string[] = fileContent.split(/^##\s+/m).filter(Boolean)

  let globalIndex = 0
  let upsertedChunks = 0
  let totalExpectedChunks = 0

  for (const section of sections) {
    const [headingLine, ...rest] = section.split('\n')
    const safeHeading = headingLine?.trim() || 'Untitled Section'
    const content = rest.join('\n').trim()

    const chunks = splitIntoChunks(content, CHUNK_SIZE)

    for (const chunk of chunks as string[]) {
      totalExpectedChunks++
      const trimmed = chunk.trim()
      const chunkHash = hashText(trimmed)
      allHashes.push(chunkHash)
      const embedding = await embedText(trimmed)

      try {
        await upsertToSupabase({
          heading: safeHeading,
          chunk: trimmed,
          hash: chunkHash,
          embedding,
          position: globalIndex++,
        });
        console.log(`✅ Upserted chunk from "${safeHeading}"`);
        upsertedChunks++;
      } catch (err: any) {
        if (
          err?.message?.includes('duplicate key value') ||
          err?.details?.includes('already exists')
        ) {
          console.log(`🔁 Skipped existing chunk from "${safeHeading}" (already upserted)`);
        } else {
          console.error(`❌ Failed to upsert chunk from "${safeHeading}"`, err);
        }
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

  console.log(`✨ Done. Upserted ${upsertedChunks} new chunks from ${sections.length} sections.`)

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