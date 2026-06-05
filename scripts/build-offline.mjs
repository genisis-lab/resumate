// Offline production build using esbuild (no network / no Vite required).
// Produces a static `dist/` deployable directly to Cloudflare Pages.
// The standard `npm run build` (Vite) is the recommended path when you have
// network access; this script exists so the app can be built in restricted
// environments and for quick verification.

import { build } from "esbuild"
import { mkdirSync, copyFileSync, writeFileSync, readdirSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const dist = join(root, "dist")
const assets = join(dist, "assets")

// Allow resolving react/react-dom from a shared/global node_modules if a local
// one is not present (useful in sandboxes).
const nodePaths = [join(root, "node_modules")]
for (const p of ["/vercel/sandbox/node_modules", "/node_modules"]) {
  if (existsSync(p)) nodePaths.push(p)
}

mkdirSync(assets, { recursive: true })

await build({
  entryPoints: [join(root, "src/main.tsx")],
  bundle: true,
  minify: true,
  sourcemap: false,
  format: "esm",
  target: ["es2020"],
  jsx: "automatic",
  loader: { ".tsx": "tsx", ".ts": "ts" },
  define: { "process.env.NODE_ENV": '"production"' },
  nodePaths,
  outfile: join(assets, "app.js"),
  logLevel: "info",
})

// index.html for the built site (references the bundled asset).
const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="ResuMate - Build an ATS-optimized resume in minutes. No signup. Free PDF & Word export. AI-powered ATS scoring." />
    <title>ResuMate — Free AI Resume Builder & ATS Checker</title>
    <link rel="stylesheet" href="/assets/app.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/app.js"></script>
  </body>
</html>
`
writeFileSync(join(dist, "index.html"), html)

// Copy public/ assets into dist/.
const pub = join(root, "public")
if (existsSync(pub)) {
  for (const f of readdirSync(pub)) copyFileSync(join(pub, f), join(dist, f))
}

console.log("\n✓ Offline build complete -> dist/")
