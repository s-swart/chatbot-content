import fs from 'fs'
import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
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
