# 📚 Chatbot Content Pipeline

This repository powers a personal AI assistant that can chat with recruiters and hiring managers about your resume and background. It uses OpenAI embeddings, a Supabase vector store, and a GitHub-managed content pipeline to enable semantic search and intelligent chatbot conversations.

---

## 🚀 Purpose

This repo enables:
- A chatbot to answer questions like “Does Sara have experience in X?”
- Semantically searching resume content stored as markdown
- Keeping a vector database in sync with your markdown updates via GitHub actions or manual syncs

---

## 🧱 Structure

### `resume-blurbs.md`
The source of truth. All experience is written here in markdown using level-2 headings (`##`) for sections.

### `scripts/`
Contains utility scripts:
- `sync-resume-blurbs.ts` – Reads `resume-blurbs.md`, generates embeddings, syncs them to Supabase with deduplication and cleanup
- `test-semantic-search.ts` – Tests how a query matches stored vectors
- `test-openai.ts` – Validates OpenAI key and embedding access

### `supabase/`
Contains Supabase schema and migrations:
- `migrations/` – SQL migrations for creating the `vectors` table and `match_vectors` function

---

## 🧪 Testing the Pipeline

To run the sync process:
```bash
npx tsx scripts/sync-resume-blurbs.ts
```

To test semantic search:
```bash
npx tsx scripts/test-semantic-search.ts
```

---

## 🛠 Prerequisites

Create a `.env` file in the root with:
```env
OPENAI_API_KEY=your-openai-key
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

> ⚠️ These environment variables must also be configured in Vercel for deployment.

---

## 🧠 Semantic Search SQL Function

Supabase includes a `match_vectors` function that finds similar content using cosine distance. See:
```
supabase/migrations/20250518145240_add-match-vectors-function.sql
```

---

## 🔁 Updates

Any changes to `resume-blurbs.md` should be followed by a sync using the script. GitHub Actions can automate this using a webhook.

---

## 💬 Example Use Case

A recruiter asks:
> "Does Sara have experience with GTM or pricing?"

The chatbot:
- Embeds the question
- Runs `match_vectors`
- Returns top relevant chunks from your resume

---

## 📎 TODO

- [ ] Add GitHub Actions integration for auto-sync
- ✅ Integrated into production chatbot (Vercel API route)
- [ ] Add CLI to customize sync/test behavior

---

## 🚀 Deployment Notes

To deploy successfully on Vercel:
- Set all required environment variables in your Vercel project:
  - `OPENAI_API_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Redeploy after environment variable changes.

---

## ✨ Maintained by Sara Swart

Built with ❤️ to empower a smarter career search experience.
