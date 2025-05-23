// scripts/prod/config.ts
// ✅ This config is used by the production resume embedding and sync pipeline

/**
 * CONFIGURATION FOR RESUME EMBEDDING METADATA SCRIPT
 *
 * This file defines constants used by `generate-embeddings-metadata.ts`
 * to inform GPT scoring logic for chunked resume content.
 *
 * You can update these values to match the resume context being analyzed.
 */

/**
 * Strategic context for guiding GPT scoring decisions.
 * This is injected into the system prompt to help GPT understand the persona and priorities.
 * Update this string to reflect the key themes and roles relevant to the resume.
 */
export const ROLE_CONTEXT = 'This resume belongs to a VP of Revenue Operations and AI strategy. Prioritize sections that reflect that strategic identity: RevOps, GTM, AI, leadership, pricing, transformation.'

/**
 * Most recent employer to guide boost logic.
 * Used to identify top-of-resume chunks and ensure scoring accuracy.
 * Update this to the current or most relevant employer name on the resume.
 */
export const MOST_RECENT_EMPLOYER = 'EmployBridge' // Update this to match the current resume