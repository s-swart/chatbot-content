// test-openai.ts
//
// PURPOSE:
// This script checks that your OpenAI API key is working by generating a test embedding.
// It ensures the embedding API is reachable and returns a valid result.
//
// USE THIS WHEN:
// - You are setting up your environment and want to validate OpenAI credentials
// - You need to debug API access issues or rate limiting
// - You want a lightweight test before running full embedding pipelines

import 'dotenv/config'
import OpenAI from 'openai'

console.log("🚀 Starting OpenAI test…")

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

async function testOpenAI() {
  try {
    const result = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: 'Test embedding',
    })
    console.log('✅ OpenAI key works. Sample embedding:', result.data[0].embedding.slice(0, 5))
  } catch (err) {
    console.error('❌ OpenAI key failed:', err)
  }
}

testOpenAI()