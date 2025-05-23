/**
 * CONFIGURATION MODULE
 *
 * This config dynamically resolves paths and constants for both DEV and PROD environments.
 * The environment is detected based on the ENV_FILE or NODE_ENV variables.
 *
 * Shared constants (e.g., role context, employer name) and environment-specific paths
 * are exported for use by scripts such as generate-embeddings-metadata.ts and sync-resume-blurbs.ts.
 *
 * Update ROLE_CONTEXT or MOST_RECENT_EMPLOYER to reflect resume context.
 * Files will be written to either `.dev` or production output locations accordingly.
 */
import path from 'path'

const envFile = process.env.ENV_FILE?.toLowerCase() || ''
const isDev = envFile.includes('.env.dev') || process.env.NODE_ENV === 'development'

export const ROLE_CONTEXT = 'This resume belongs to a VP of Revenue Operations and AI strategy. Prioritize sections that reflect that strategic identity: RevOps, GTM, AI, leadership, pricing, transformation.'

export const MOST_RECENT_EMPLOYER = 'EmployBridge'

// Shared path to source resume markdown
export const RESUME_BLURBS_PATH = path.resolve(__dirname, '../../private/resume-blurbs.md')

// Dynamic output path for metadata JSON
export const CHUNKED_JSON_PATH = path.resolve(
  __dirname,
  `../../data/chunks-with-metadata${isDev ? '.dev' : ''}.json`
)

export const OUTPUT_PATH = path.resolve(
  __dirname,
  `../../output${isDev ? '.dev' : ''}`
)
