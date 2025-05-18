// embed-resume.ts
//
// PURPOSE:
// This script reads `resume-blurbs.md`, splits the content into chunks,
// generates embeddings using OpenAI, and stores the vectors in the Supabase `documents` table.
// It is a simplified embedding pipeline using LangChain's OpenAIEmbeddings.
//
// USE THIS WHEN:
// - You want to test or seed a basic vector store with manually chunked content
// - You need to quickly embed static text into your Supabase database
// - You’re experimenting with embedding flows before building full RAG/chatbot pipelines
//
// REQUIREMENTS:
// - OpenAI API key via environment variables
// - Supabase credentials (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)
// - A `resume-blurbs.md` file present in the project
import fs from 'fs'
import { OpenAIEmbeddings } from '@langchain/openai'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Not the anon key for inserts
)

async function run() {
  const content = fs.readFileSync('./chatbot-content/resume-blurbs.md', 'utf8')
  const embeddings = new OpenAIEmbeddings()

  const chunks = content.match(/.{1,1000}/g) || [] // Chunk manually, or use LangChain splitter

  for (const chunk of chunks) {
    const [embedding] = await embeddings.embedDocuments([chunk])
    await supabase.from('documents').insert([
      {
        content: chunk,
        embedding,
        metadata: { source: 'resume-blurbs.md' }
      }
    ])
  }

  console.log('Embedding complete')
}

run()
