// PDF text extraction using pdf.js (pdfjs-dist). Loaded lazily so the ~1MB
// library only downloads when a user actually imports a PDF.
//
// The worker is served from unpkg, matching the installed pdf.js version, so it
// works under both the Vite build (Cloudflare) and the esbuild offline build
// without any bundler-specific url import. Only the worker code is fetched --
// the PDF itself is parsed entirely in the browser and never uploaded.
import * as pdfjsLib from "pdfjs-dist"

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://unpkg.com/pdfjs-dist@" + pdfjsLib.version + "/build/pdf.worker.min.mjs"

interface RowItem {
  x: number
  w: number
  s: string
}
interface Row {
  y: number
  items: RowItem[]
}

// Extract text from a PDF, reconstructing reading order line-by-line using the
// glyph positions pdf.js reports. This keeps headings/bullets on their own
// lines, which the resume parser relies on.
export async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise
  const out: string[] = []

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const rows: Row[] = []

    for (const raw of content.items as any[]) {
      if (typeof raw.str !== "string" || raw.str === "") continue
      const tr = raw.transform as number[]
      const x = tr[4]
      const y = tr[5]
      const w = typeof raw.width === "number" ? raw.width : 0
      let row = rows.find((r) => Math.abs(r.y - y) < 3)
      if (!row) {
        row = { y, items: [] }
        rows.push(row)
      }
      row.items.push({ x, w, s: raw.str })
    }

    rows.sort((a, b) => b.y - a.y) // top-to-bottom
    for (const row of rows) {
      row.items.sort((a, b) => a.x - b.x)
      let line = ""
      let prevEnd: number | null = null
      for (const it of row.items) {
        if (prevEnd !== null && it.x - prevEnd > 1 && !/\s$/.test(line)) line += " "
        line += it.s
        prevEnd = it.x + it.w
      }
      line = line.replace(/\s+/g, " ").trim()
      if (line) out.push(line)
    }
    out.push("") // blank line between pages
  }

  try {
    await pdf.cleanup()
  } catch {
    /* noop */
  }
  return out.join("\n")
}
