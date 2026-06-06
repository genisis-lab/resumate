# ResuMate — Free AI Resume Builder & ATS Checker

A fast, **no-signup**, privacy-first resume builder built with **React + Vite**. Edit with a live split-screen preview, get an **AI-powered ATS score** against any job description, and export to **PDF** and **Word (.docx)**. Everything is stored in your browser's `localStorage` — no account, nothing uploaded to a server. Installable as an offline app (PWA).

> **Live:** https://resumate.pages.dev

## Highlights

- ⚡ **No sign-up** — open and start typing
- 🔒 **Privacy-first** — data lives in `localStorage`; nothing is uploaded except the text you explicitly send to the AI ATS check
- 📱 **Installable PWA** — add to your home screen and keep working **offline**
- 📝 **Live split-screen editor** — structured form + real-time preview
- 🤖 **AI ATS scoring** — paste a job description for a match score, missing keywords, and section-by-section suggestions
- 📄 **PDF & Word export** — vector, selectable, ATS-parseable PDF + a genuine, editable `.docx`

## Features

### Editing & content quality

- **Live writing coach** — each bullet gets a strength meter (Needs work / Good / Strong) and flags weak openers, passive voice, missing metrics, first-person phrasing, and bullets that are too long or too short.
- **Action-verb helper** — inline verb suggestions on weak bullets, plus a categorized verb bank (Leadership, Achievement, Building, Analysis, Communication, Improvement) that rewrites a bullet's opener in one click.
- **Proofreader** — on-demand pass that flags common misspellings, double spaces, repeated words, and stray lowercase “i”, with one-click “Fix spelling”.
- **Custom sections** — add Awards, Languages, Volunteering, Publications, and more; each with entries, dates, descriptions, and bullets. They render in the preview and all exports.
- **Completeness meter** + real-time quality flags.
- **Multiple resumes** — create, duplicate, switch, and delete; autosave with **undo / redo** history.

### Layout & design

- **6 templates** — Modern, Classic, Minimal, ATS-Safe, Two-Column, and Creative.
- **Accent color, font-size, and density** controls (Compact / Cozy / Roomy).
- **Fit to one page** — auto-shrinks density and font scale until the resume fits, with a live page-count badge.
- **Drag-and-drop reordering** — reorder bullets and resume sections via drag handles (arrow buttons as a fallback).
- **Dark mode**, fully responsive, with a dedicated mobile editor/preview experience.

### Import, export & sharing

- **Import** — PDF or plain-text résumé parsing, native ResuMate JSON, and the open **JSON Resume** standard (auto-detected).
- **Export** — PDF, Word (`.docx`), Markdown (`.md`), plain text (`.txt`), native JSON, and JSON Resume.
- **Backup & restore** — export/import every saved resume at once.
- **Share link + QR code** — generate a read-only link (the resume is encoded in the URL; nothing is uploaded) and a scannable QR code. Rich link previews via Open Graph / Twitter metadata.

### Beyond the resume

- **AI ATS analyzer** — keyword match, section-by-section breakdown, and a tailored-summary suggestion, with matched keywords highlighted in a preview.
- **Cover letter generator** and **interview prep** helpers.
- **Offline fallback analyzer** — instant on-device keyword + structure analysis when no AI key is configured.
- **Bring-your-own-key (BYOK)** option in Settings.

### Accessibility & power use

- **Keyboard shortcuts** — press `?` for the cheat sheet. `Ctrl/Cmd+Z` / `Shift+Z` undo/redo, `Ctrl/Cmd+S` to export PDF, `Esc` to close dialogs.
- **Accessibility** — skip-to-content link, visible focus outlines, ARIA labels on icon buttons and drag handles, and live-region save status.

## Tech

- React 18 + TypeScript + Vite
- Custom hash router, pure-JS `.docx`/zip writer, native print-to-PDF, `pdfjs-dist` for PDF import, `qrcode` for share QR codes
- PWA: web app manifest + a service worker (network-first for navigation, stale-while-revalidate for assets)
- Cloudflare Pages + Pages Functions (`/api/*`) that securely proxy an LLM API (the key stays server-side)

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
npm run build          # tsc + Vite build -> dist/   (recommended)
npm run build:offline  # esbuild-only build (no network needed) -> dist/
```

## Deploy to Cloudflare Pages

### Option A — Connect a Git repo (recommended)

1. Push this repo to GitHub/GitLab.
2. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Build settings:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Production branch:** `main`
4. Add environment variables (Settings → Variables and Secrets):
   - `AI_API_KEY` — your OpenAI (or compatible) key, marked **Encrypted**
   - `AI_API_URL` *(optional)* — defaults to `https://api.openai.com/v1/chat/completions`
   - `AI_MODEL` *(optional)* — defaults to `gpt-4o-mini`
   - `NODE_VERSION` *(recommended)* — `20`
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
functions/api/             Cloudflare Pages Functions (LLM proxy; key stays server-side)
public/                    favicon, manifest.webmanifest, sw.js, og.svg, _headers
src/
  components/              editor form, reusable fields, custom sections, modals (share, shortcuts)
  templates/               ResumePreview (all 6 templates)
  pages/                   Landing, Builder, Templates, Analyze, CoverLetter, Interview, Settings
  lib/                     storage, ats, exportPdf, exportDocx, exportText, zip, quality,
                           resumeText, share, jsonResume, proofread, writingCoach, actionVerbs,
                           fitPage, pwa, importResume, ai, byok, pdf
  hooks/useResume.ts       localStorage-backed autosave with undo/redo
  types/resume.ts          data model
scripts/build-offline.mjs  esbuild build (no Vite/network)
```

## Privacy

Resume content is stored only in your browser. It is sent to the serverless function **only** when you click “Analyze with AI”, solely to generate your ATS score — it is not stored or logged by the app. Share links encode the resume directly in the URL, so shared data never touches a server either.

## License

[MIT](./LICENSE)
