// test-semantic-search.ts
// 
// PURPOSE:
// This script is used to test your vector search setup in Supabase.
// It performs semantic search by:
// 1. Embedding a sample user query using OpenAI
// 2. Passing the embedding into Supabase to find similar vectors
// 3. Printing the top results with similarity scores
//
// USE THIS WHEN:
// - You want to verify that embeddings were correctly stored in Supabase
// - You want to test how well a question retrieves relevant resume blurbs
// - You’re debugging your vector search pipeline manually
//
// NOTE:
// Before running this, make sure the `match_vectors` SQL function exists in your Supabase DB.
// You can run the SQL migration manually if needed.
// Running the same SQL multiple times is safe because `create or replace function` is idempotent.

import 'dotenv/config'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  // 🔧 Customize this query to test how your chatbot matches against your stored resume blurbs.
  const query = 'experience with GTM strategy and pricing analytics'

  console.log(`🔍 Embedding query: "${query}"`)
  const embeddingRes = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: query,
  })
  const embedding = embeddingRes.data[0].embedding

  const { data, error } = await supabase.rpc('match_vectors', {
    query_embedding: embedding,
    match_threshold: 0.75,
    match_count: 5,
  })

  if (error) {
    console.error('❌ Error querying Supabase match_vectors:', error)
    return
  }

  console.log(`\n🧠 Top matches:`)
  data.forEach((row: any, i: number) => {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`\x1b[1m#${i + 1} (score: ${row.similarity.toFixed(3)})\x1b[0m`)
    console.log(`Heading: ${row.metadata?.heading || 'No heading'}`)
    console.log(row.content)
  })
}

main().catch(console.error)