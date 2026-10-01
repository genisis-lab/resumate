# ResuMate — self-serve resume builder

A browser-first resume builder built with **React + Vite**. Users enter their own details, choose from seventeen original templates (3 free, 14 Premium), run a local job-description match check, and export to **PDF** or **Word (.docx)**. Editing stays in browser storage unless a future sync feature is deliberately enabled. Verified accounts manage software access and the future upgrade path; creating an account does not upload existing resumes.

> **Live:** https://resume.builtwai.com/

## Highlights

- ⚡ **Start immediately** — the editor still works before sign-up
- ✉️ **Verified accounts** — Cloudflare D1-backed accounts with transactional email verification
- 🔒 **Privacy-first** — editing and offline checks stay in `localStorage`; AI sends only the text you explicitly submit through the proxy
- 📱 **Installable PWA** — add to your home screen and keep working **offline**
- 📝 **Live split-screen editor** — structured form + real-time preview
- 🎯 **Local ATS check** — paste a job description for on-device keyword and structure feedback
- 📄 **PDF & Word export** — vector, selectable, ATS-parseable PDF + a genuine, editable `.docx`
- 🖨️ **True-to-print preview** — the page renders at its printed size, so line breaks and the page counter match the PDF

## Features

### Editing & content quality

- **Live writing coach** — each bullet gets a strength meter (Needs work / Good / Strong) and flags weak openers, passive voice, missing metrics, first-person phrasing, and bullets that are too long or too short.
- **Action-verb helper** — inline verb suggestions on weak bullets, plus a categorized verb bank (Leadership, Achievement, Building, Analysis, Communication, Improvement) that rewrites a bullet's opener in one click.
- **Proofreader** — on-demand pass that flags common misspellings, double spaces, repeated words, and stray lowercase “i”, with one-click “Fix spelling”.
- **Custom sections** — add Awards, Languages, Volunteering, Publications, and more; each with entries, dates, descriptions, and bullets. They render in the preview and all exports.
- **Completeness meter** + real-time quality flags.
- **Multiple resumes** — create, duplicate, switch, and delete; autosave with **undo / redo** history.

### Layout & design

- **17 templates** registered in `src/templates/registry.ts`. Free: Modern, Classic, ATS-Safe. Premium: Horizon, Elegant, Timeline, Swiss Grid, Bold, Developer, Monogram, Professional Serif, Minimal, Two-Column, Creative, Executive, Compact, and Technical. Free plans can preview Premium templates on their own resume; PDF download requires Career Sprint or Pro.
- **Accent color (presets or custom), font-size, density, and paper size** (US Letter or A4).
- **Fit to one page** — auto-shrinks density and font scale until the resume fits, with an exact page-count badge and page-break guides.
- **ATS-safe PDFs** — template fonts are static TrueType files (Chromium embeds variable fonts as Type 3, which parsers read without word spaces), no text opacity, and capped letter-spacing so headings extract intact.
- **Drag-and-drop reordering** — reorder bullets and resume sections via drag handles (arrow buttons as a fallback).
- **Dark mode**, fully responsive, with a dedicated mobile editor/preview experience.

### Import, export & sharing

- **Import** — PDF or plain-text résumé parsing, native ResuMate JSON, and the open **JSON Resume** standard (auto-detected).
- **Export** — PDF, Word (`.docx`), Markdown (`.md`), plain text (`.txt`), native JSON, and JSON Resume.
- **Backup & restore** — export/import every saved resume at once.
- **Share link + QR code** — generate a read-only link (the resume is encoded in the URL; nothing is uploaded) and a scannable QR code. Rich link previews via Open Graph / Twitter metadata.

### Beyond the resume

- **Local ATS analyzer** — keyword match and section breakdown with matched keywords highlighted in a preview.
- **Cover letter generator**, **interview prep** with outreach, follow-up, thank-you, and networking emails, and a **LinkedIn optimizer**.
- **AI coach** — full resume review, role builder, grammar, job-evidence mapping, consistency check, and interview practice. Suggestions are shown as a word diff and applied only when accepted.
- **Job decoder** — must-haves, nice-to-haves, keywords, things to clarify, and questions to ask.
- **Hosted AI** on Cloudflare Workers AI for Career Sprint and Pro, metered per action.
- **Bring-your-own-key (BYOK)** option in Settings.

### Accessibility & power use

- **Keyboard shortcuts** — press `?` for the cheat sheet. `Ctrl/Cmd+Z` / `Shift+Z` undo/redo, `Ctrl/Cmd+S` to export PDF, `Esc` to close dialogs.
- **Accessibility** — skip-to-content link, visible focus outlines, ARIA labels on icon buttons and drag handles, and live-region save status.

## Tech

- React 18 + TypeScript + Vite, with route-level code splitting
- Radix UI primitives (menus, popovers, dialogs), lucide icons, and sonner toasts, styled with plain CSS
- Custom hash router, pure-JS `.docx`/zip writer, native print-to-PDF, `pdfjs-dist` for PDF import, `qrcode` for share QR codes
- PWA: web app manifest + a service worker (network-first for navigation, stale-while-revalidate for assets)
- Cloudflare Pages + Pages Functions, D1 account storage, and Resend transactional email
- Provider-neutral plan and entitlement boundaries with authenticated Whop checkout

## Local development

```bash
npm install
npm run dev          # http://localhost:5173
```

Optional online analysis calls `/api/analyze`. During `vite dev` that route doesn't exist, so the app uses the **local analyzer**. To test online AI or account functions locally, run with Wrangler and a local D1 database:

```bash
npm run build
npx wrangler pages dev dist
```

Hosted AI uses the Workers AI binding (`AI` in `wrangler.jsonc`) with `@cf/qwen/qwen3-30b-a3b-fp8` by default. Set `AI_HOSTED_MODEL` to another allowlisted model (see `HOSTED_MODEL_ALLOWLIST` in `server/ai-proxy.ts`, for example `@cf/openai/gpt-oss-120b`) to switch models without a code change. Every structured response is schema-validated, grounded against the supplied text where possible, and retried once with the validation error before failing; failed requests do not consume an AI action.

`.dev.vars` example:

```
AI_API_KEY=sk-your-key
AI_MODEL=gpt-4o-mini
RESEND_API_KEY=re_your_test_key
EMAIL_FROM=ResuMate <verification@contact.builtwai.com>
APP_URL=http://localhost:8788
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
   - `AI_API_KEY` — optional OpenAI-compatible key, marked **Encrypted**
   - `AI_API_URL` *(optional)* — defaults to `https://api.openai.com/v1/chat/completions`
   - `AI_MODEL` *(optional)* — defaults to `gpt-4o-mini`
   - `NODE_VERSION` *(recommended)* — `24`
5. Deploy. The `functions/` directory is automatically wired up as Pages Functions.

### Option B — Direct upload via Wrangler

```bash
npm run build
npx wrangler d1 migrations apply resumate-accounts --remote
npx wrangler pages secret put RESEND_API_KEY --project-name resumate
npx wrangler pages deploy dist --project-name resumate
```

`wrangler.jsonc` is the source of truth for the Pages output directory, the `DB` binding, the production app URL, and the verified Resend sender. Keep API keys in encrypted Pages secrets only.

> Without an `AI_API_KEY`, the site still works fully — the ATS checker falls back to the on-device analyzer. Add the key whenever you want LLM-quality suggestions.

## Project structure

```
functions/api/             Cloudflare Pages Functions (auth, email verification, billing, LLM proxy)
server/                    shared server logic: AI proxy and quotas, structured generation, coach, billing
public/                    favicon, manifest.webmanifest, sw.js, og.svg, _headers
src/
  components/              editor form, reusable fields, custom sections, modals (share, shortcuts)
  templates/               registry.ts (template metadata), ResumePreview, templates.css, fonts.ts
  pages/                   Landing, Builder, Templates, Analyze, Coach, CoverLetter, Interview, LinkedIn, Applications, Settings, …
  lib/                     storage, ats, exportPdf, exportDocx, exportText, zip, quality,
                           resumeText, share, jsonResume, proofread, writingCoach, actionVerbs,
                           fitPage, pwa, importResume, ai, byok, pdf
  hooks/useResume.ts       localStorage-backed autosave with undo/redo
  types/resume.ts          data model
scripts/build-offline.mjs  esbuild build (no Vite/network)
```

## Privacy

Resume editing and local ATS checks run in your browser. Account records contain identity, verification, session, and plan data, but existing resumes are not uploaded. When you deliberately choose an online AI feature, the selected resume and/or job-description text is sent through the serverless proxy to the configured AI provider. Share links encode the resume in the URL fragment, so the payload is not included in ordinary HTTP requests, but it is not encrypted and should be treated as public.

## License

[MIT License](https://opensource.org/license/mit)
