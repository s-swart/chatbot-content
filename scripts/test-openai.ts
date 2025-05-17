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