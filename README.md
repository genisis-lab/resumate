# ResuMate — Free AI Resume Builder & ATS Checker

A fast, **no-signup**, privacy-first resume builder built with **React + Vite**. Edit with a live split-screen preview, get an **AI-powered ATS score** against any job description, and export to **PDF** and **Word (.docx)**. All your data is stored in your browser's `localStorage` — nothing is uploaded to a server.

## Features

- ⚡ **No sign-up** — open and start typing
- 🔒 **Privacy-first** — data lives in `localStorage`; JSON import/export for backups
- 📝 **Live split-screen editor** — structured form + real-time preview
- 🎨 **4 templates** — Modern, Classic, Minimal, ATS-Safe (with accent color + font size controls)
- 🤖 **AI ATS scoring** — paste a job description for a match score, missing keywords, and section-by-section suggestions
- 📊 **Offline fallback** — instant on-device keyword + structure analysis when no AI key is configured
- 📄 **PDF export** — vector, selectable, ATS-parseable (via the browser print engine)
- 📄 **Word export** — genuine `.docx` generated client-side, fully editable
- ✅ **Completeness meter** + real-time quality checks (weak verbs, missing metrics, etc.)
- 🌙 **Dark mode**, responsive, keyboard-friendly

## Tech

- React 18 + TypeScript + Vite
- Zero runtime dependencies beyond React (custom hash router, pure-JS `.docx`/zip writer, native print-to-PDF)
- Cloudflare Pages + a Pages Function (`/api/analyze`) that securely proxies an LLM API

## Local development

```bash
npm install
npm run dev          # http://localhost:5173
```

The AI ATS check calls `/api/analyze`. During `vite dev` that route doesn't exist, so the app automatically uses the **offline analyzer**. To test the real AI path locally, run with Wrangler:

```bash
npm run build
npx wrangler pages dev dist   # provide AI_API_KEY via .dev.vars
```

`.dev.vars` example:

```
AI_API_KEY=sk-your-key
AI_MODEL=gpt-4o-mini
```

## Build

```bash
npm run build        # Vite build -> dist/   (recommended)
npm run build:offline  # esbuild-only build (no network needed) -> dist/
```

## Deploy to Cloudflare Pages

### Option A — Connect a Git repo (recommended)

1. Push this folder to GitHub/GitLab.
2. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Build settings:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Add environment variables (Settings → Variables and Secrets):
   - `AI_API_KEY` — your OpenAI (or compatible) key, marked **Encrypted**
   - `AI_API_URL` *(optional)* — defaults to `https://api.openai.com/v1/chat/completions`
   - `AI_MODEL` *(optional)* — defaults to `gpt-4o-mini`
5. Deploy. The `functions/` directory is automatically wired up as Pages Functions.

### Option B — Direct upload via Wrangler

```bash
npm run build
npx wrangler pages deploy dist --project-name resumate
# then add AI_API_KEY in the dashboard (or: npx wrangler pages secret put AI_API_KEY)
```

> Without an `AI_API_KEY`, the site still works fully — the ATS checker falls back to the on-device analyzer. Add the key whenever you want LLM-quality suggestions.

## Project structure

```
functions/api/analyze.ts   Cloudflare Pages Function (LLM proxy, key stays server-side)
public/                    favicon, _headers
src/
  components/              editor form + reusable fields
  templates/               ResumePreview (all 4 templates)
  pages/                   Landing, Builder, Templates, Analyze
  lib/                     storage, ats, exportPdf, exportDocx, zip, quality, resumeText
  hooks/useResume.ts       localStorage-backed autosave
  types/resume.ts          data model
scripts/build-offline.mjs  esbuild build (no Vite/network)
```

## Privacy

Resume content is stored only in your browser. It is sent to the serverless function **only** when you click “Analyze with AI”, solely to generate your ATS score — it is not stored or logged by the app.
