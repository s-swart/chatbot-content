// scripts/dev/generate-embeddings-metadata.ts
// ⚠️ This script uses the DEV config and expects .env.dev unless overridden
//
// PURPOSE:
// This script reads your `resume-blurbs.md` file, splits it into content chunks,
// and uses GPT to generate metadata for each chunk including:
// - section_label: a human-readable section tag (e.g. 'EmployBridge')
// - recency_score: a float between 0.0–1.0 indicating relevance to current identity
//
// CONTEXT:
// - Strategic evaluation is guided by ROLE_CONTEXT (from config.ts)
// - Recency and relevance scoring leverages keywords, job titles, and years
//
// OUTPUT:
// The result is saved as `chunks-with-metadata.json` in the `data/` folder for QA and embedding.
//
// USE THIS WHEN:
// - You want to review and version control all semantic chunks before embedding
// - You want to add recency weighting to prioritize more recent or strategic experience
//
// REQUIREMENTS:
// - OpenAI API key (OPENAI_API_KEY)
// - `resume-blurbs.md` must exist in the private folder
// - `config.ts` must export ROLE_CONTEXT and MOST_RECENT_EMPLOYER for guidance logic

import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import crypto from 'crypto'
import OpenAI from 'openai'
import { ROLE_CONTEXT, MOST_RECENT_EMPLOYER, RESUME_BLURBS_PATH, OUTPUT_PATH } from '../env/config'

dotenv.config({ path: process.env.ENV_FILE || '.env' })

// CONFIGURATION CONSTANTS

const CHUNK_SIZE = 1800

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

type ChunkMetadata = {
  section_label: string
  recency_score: number
}

type ChunkEntry = {
  chunk_id: string
  content: string
  hash: string
  metadata: ChunkMetadata
}

/**
 * Post-processes the recency_score for a chunk, applying strategic boosts and header/short downweighting.
 * @param label Section label returned by GPT
 * @param score Raw recency_score returned by GPT
 * @param content The chunk's content
 * @param index The chunk's index (0-based)
 * @param total Total number of chunks
 */
function postProcessScore(
  label: string,
  score: number,
  content: string,
  index: number,
  total: number
): number {
  const lowered = label.toLowerCase().trim();

  // Avoid underweighting key categories
  if (['education', 'ventures', 'entrepreneurial experience'].some(term => lowered.includes(term))) {
    score = Math.max(score, 0.5);
  }

  // Boost strategic sections: Q&A, Methodology, Core Capabilities, Executive Summary
  if (
    lowered.includes('q&a') ||
    lowered.includes('methodology') ||
    lowered.includes('core capabilities') ||
    lowered.includes('executive summary')
  ) {
    score = Math.max(score, 0.8);
  }

  // Cap Education, Ventures, Thought Leadership, Speaking at 0.9 max
  if (
    ['education', 'ventures', 'thought leadership', 'speaking'].some(term => lowered.includes(term))
  ) {
    score = Math.min(score, 0.9);
  }

  // Downweight short or header-only chunks more clearly
  const wordCount = content.trim().split(/\s+/).length;
  if (wordCount < 30) {
    score = Math.min(score, 0.6);
  }

  // Soft penalty for inflated 1.0s that aren’t clearly current
  if (score === 1 && !content.toLowerCase().includes('2023') && !content.toLowerCase().includes('2024')) {
    score = 0.8;
  }

  // Boost if actively described
  if (/currently|present|today|executive sponsor|ongoing/.test(content.toLowerCase())) {
    score = Math.max(score, 0.9);
  }

  // Penalize education, speaking, ventures without recent year signal
  if (
    ['education', 'speaking', 'ventures'].some(term => lowered.includes(term)) &&
    !content.match(/202[3-5]/)
  ) {
    score = Math.min(score, 0.7);
  }

  const recentYearRegex = /202[3-5]/;
  if (index === 0 && (recentYearRegex.test(content) || content.includes(MOST_RECENT_EMPLOYER))) {
    score = Math.max(score, 1.0);
  }

  return score;
}

// ---

function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex')
}

function smartChunkMarkdown(input: string, maxLen = CHUNK_SIZE): string[] {
  const sections = input.split(/^##\s+/gm).filter(Boolean)
  const chunks: string[] = []

  for (const section of sections) {
    const lines = section.trim().split('\n')
    const heading = lines[0]?.trim()
    const body = lines.slice(1).join('\n').trim()
    if (!body) continue

    let currentChunk = `## ${heading}\n`
    let currentLength = currentChunk.length
    const paragraphs = body.split(/\n{2,}/)

    for (const para of paragraphs) {
      const paraLen = para.length + 2

      if (currentLength + paraLen > maxLen) {
        chunks.push(currentChunk.trim())
        currentChunk = ''
        currentLength = 0
      }

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

async function labelChunkWithMetadata(chunk: string, index: number, total: number): Promise<ChunkMetadata> {
  const prompt = `You are reviewing a chunk of a professional resume and assigning:
- section_label (e.g., “EmployBridge”, “Education”)
- recency_score (0.0 to 1.0): how recent and strategically relevant this content is to the person’s identity today.

Use date ranges (e.g., “2023–present”) and keywords (e.g., “AI transformation”, “VP of…”) to assess time and relevance.

When no date is given, infer recency based on job titles or language such as “currently,” “today,” or references to recent technology or strategic roles.

Avoid assigning 1.0 unless the section clearly includes:
- current or active role OR
- clearly relevant strategic framing like executive summary or methodology

Return a JSON object with:
- section_label
- recency_score

Chunk:

"""\n${chunk}\n"""`;

  const res = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: `${ROLE_CONTEXT} Return JSON only.` },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3
  })

  try {
    const tool = res.choices?.[0]?.message?.content
    if (!tool) throw new Error('Missing GPT content')

    let json
    try {
      json = JSON.parse(tool)
    } catch (parseErr) {
      console.warn('⚠️ GPT returned non-JSON content. Falling back to default metadata.')
      return { section_label: 'Unlabeled', recency_score: 0.5 }
    }

    if (
      typeof json.section_label !== 'string' ||
      typeof json.recency_score !== 'number'
    ) {
      console.warn('⚠️ GPT returned invalid structure. Falling back to default metadata.')
      return { section_label: 'Unlabeled', recency_score: 0.5 }
    }

    const rawScore = parseFloat(json.recency_score)
    return {
      section_label: json.section_label,
      recency_score: postProcessScore(json.section_label, rawScore, chunk, index, total)
    }
  } catch (err) {
    console.error('❌ Failed to process metadata for chunk:', chunk.slice(0, 100), err)
    return { section_label: 'Unlabeled', recency_score: 0.5 }
  }
}

async function processResumeChunks(): Promise<ChunkEntry[]> {
  const raw = fs.readFileSync(RESUME_BLURBS_PATH, 'utf-8')
  const chunks = smartChunkMarkdown(raw)
  const entries: ChunkEntry[] = []

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i].trim()
    const hash = hashText(chunk)
    const metadata = await labelChunkWithMetadata(chunk, i, chunks.length)

    const entry: ChunkEntry = {
      chunk_id: `chunk_${i + 1}`,
      content: chunk,
      hash,
      metadata
    }

    console.log(`✅ Labeled chunk ${i + 1}:`, metadata.section_label, metadata.recency_score)
    entries.push(entry)
  }

  return entries
}

async function saveMetadataToFile(entries: ChunkEntry[]) {
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(entries, null, 2))
  console.log(`✨ Saved metadata-labeled chunks to ${OUTPUT_PATH}`)
}

async function main() {
  try {
    const entries = await processResumeChunks()
    await saveMetadataToFile(entries)
  } catch (err) {
    console.error('💥 Unhandled error during execution:', err)
  }
}

main()