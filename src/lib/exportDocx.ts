import { Resume, SectionKey, SECTION_LABELS } from "../types/resume"
import { createZip, strToBytes, ZipEntry } from "./zip"
import { triggerDownload, sanitize } from "./storage"

// Build a genuine .docx (Office Open XML) entirely client-side. The file stays
// fully editable in Word / Google Docs and is single-column + standard headings
// so it parses cleanly in ATS systems.

function esc(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function para(text: string, opts: { bold?: boolean; size?: number; heading?: boolean; spacingBefore?: number } = {}): string {
  const size = opts.size ?? 22 // half-points => 11pt
  const runProps = `<w:rPr>${opts.bold ? "<w:b/>" : ""}<w:sz w:val=\"${size}\"/></w:rPr>`
  const pPr = `<w:pPr><w:spacing w:before=\"${opts.spacingBefore ?? 0}\" w:after=\"60\"/></w:pPr>`
  return `<w:p>${pPr}<w:r>${runProps}<w:t xml:space=\"preserve\">${esc(text)}</w:t></w:r></w:p>`
}

function sectionHeading(text: string): string {
  return (
    `<w:p><w:pPr><w:spacing w:before=\"200\" w:after=\"40\"/><w:pBdr><w:bottom w:val=\"single\" w:sz=\"6\" w:space=\"1\" w:color=\"888888\"/></w:pBdr></w:pPr>` +
    `<w:r><w:rPr><w:b/><w:caps/><w:sz w:val=\"24\"/></w:rPr><w:t>${esc(text)}</w:t></w:r></w:p>`
  )
}

function bullet(text: string): string {
  return `<w:p><w:pPr><w:numPr><w:ilvl w:val=\"0\"/><w:numId w:val=\"1\"/></w:numPr><w:spacing w:after=\"40\"/></w:pPr><w:r><w:rPr><w:sz w:val=\"22\"/></w:rPr><w:t xml:space=\"preserve\">${esc(text)}</w:t></w:r></w:p>`
}

function body(r: Resume): string {
  const out: string[] = []
  const c = r.contact
  out.push(
    `<w:p><w:pPr><w:jc w:val=\"center\"/><w:spacing w:after=\"40\"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val=\"40\"/></w:rPr><w:t>${esc(c.fullName)}</w:t></w:r></w:p>`,
  )
  if (c.headline)
    out.push(`<w:p><w:pPr><w:jc w:val=\"center\"/></w:pPr><w:r><w:rPr><w:sz w:val=\"24\"/></w:rPr><w:t>${esc(c.headline)}</w:t></w:r></w:p>`)
  const contactLine = [c.email, c.phone, c.location, c.website, c.linkedin, c.github]
    .filter(Boolean)
    .join("  |  ")
  if (contactLine)
    out.push(`<w:p><w:pPr><w:jc w:val=\"center\"/><w:spacing w:after=\"120\"/></w:pPr><w:r><w:rPr><w:sz w:val=\"20\"/></w:rPr><w:t>${esc(contactLine)}</w:t></w:r></w:p>`)

  const order = r.settings.sectionOrder.filter((s) => !r.settings.hidden.includes(s))
  for (const key of order) renderSection(key, r, out)
  return out.join("")
}

function renderSection(key: SectionKey, r: Resume, out: string[]) {
  const has =
    (key === "summary" && r.summary) ||
    (key === "experience" && r.experience.length) ||
    (key === "education" && r.education.length) ||
    (key === "skills" && r.skills.length) ||
    (key === "projects" && r.projects.length) ||
    (key === "certifications" && r.certifications.length)
  if (!has) return
  out.push(sectionHeading(SECTION_LABELS[key]))
  switch (key) {
    case "summary":
      out.push(para(r.summary))
      break
    case "experience":
      for (const e of r.experience) {
        const dates = `${e.startDate}${e.startDate || e.endDate || e.current ? " \u2013 " : ""}${e.current ? "Present" : e.endDate}`
        out.push(para(`${e.role}${e.company ? ", " + e.company : ""}`, { bold: true }))
        const meta = [e.location, dates.trim()].filter(Boolean).join("  |  ")
        if (meta) out.push(para(meta, { size: 20 }))
        e.bullets.filter(Boolean).forEach((b) => out.push(bullet(b)))
      }
      break
    case "education":
      for (const e of r.education) {
        out.push(para(`${e.degree} ${e.field}`.trim(), { bold: true }))
        const meta = [e.school, e.location, [e.startDate, e.endDate].filter(Boolean).join(" \u2013 ")]
          .filter(Boolean)
          .join("  |  ")
        if (meta) out.push(para(meta, { size: 20 }))
        if (e.details) out.push(para(e.details, { size: 20 }))
      }
      break
    case "skills":
      for (const g of r.skills) {
        out.push(
          `<w:p><w:pPr><w:spacing w:after=\"40\"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val=\"22\"/></w:rPr><w:t xml:space=\"preserve\">${esc(g.category)}: </w:t></w:r><w:r><w:rPr><w:sz w:val=\"22\"/></w:rPr><w:t>${esc(g.items.join(", "))}</w:t></w:r></w:p>`,
        )
      }
      break
    case "projects":
      for (const p of r.projects) {
        out.push(para(`${p.name}${p.link ? " (" + p.link + ")" : ""}`, { bold: true }))
        if (p.description) out.push(para(p.description, { size: 20 }))
        p.bullets.filter(Boolean).forEach((b) => out.push(bullet(b)))
      }
      break
    case "certifications":
      for (const c of r.certifications) {
        out.push(para(`${c.name}${c.issuer ? " \u2014 " + c.issuer : ""}${c.date ? " (" + c.date + ")" : ""}`))
      }
      break
  }
}

const CONTENT_TYPES = `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">
<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>
<Default Extension=\"xml\" ContentType=\"application/xml\"/>
<Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/>
<Override PartName=\"/word/numbering.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml\"/>
</Types>`

const RELS = `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">
<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/>
</Relationships>`

const DOC_RELS = `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">
<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering\" Target=\"numbering.xml\"/>
</Relationships>`

const NUMBERING = `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<w:numbering xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">
<w:abstractNum w:abstractNumId=\"0\"><w:lvl w:ilvl=\"0\"><w:start w:val=\"1\"/><w:numFmt w:val=\"bullet\"/><w:lvlText w:val=\"\u2022\"/><w:lvlJc w:val=\"left\"/><w:pPr><w:ind w:left=\"360\" w:hanging=\"360\"/></w:pPr></w:lvl></w:abstractNum>
<w:num w:numId=\"1\"><w:abstractNumId w:val=\"0\"/></w:num>
</w:numbering>`

export function buildDocxBlob(r: Resume): Blob {
  const document = `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">
<w:body>${body(r)}<w:sectPr><w:pgSz w:w=\"12240\" w:h=\"15840\"/><w:pgMar w:top=\"1080\" w:right=\"1080\" w:bottom=\"1080\" w:left=\"1080\"/></w:sectPr></w:body>
</w:document>`

  const entries: ZipEntry[] = [
    { name: "[Content_Types].xml", data: strToBytes(CONTENT_TYPES) },
    { name: "_rels/.rels", data: strToBytes(RELS) },
    { name: "word/document.xml", data: strToBytes(document) },
    { name: "word/_rels/document.xml.rels", data: strToBytes(DOC_RELS) },
    { name: "word/numbering.xml", data: strToBytes(NUMBERING) },
  ]
  return createZip(entries)
}

export function exportDocx(r: Resume): void {
  const blob = buildDocxBlob(r)
  triggerDownload(blob, `${sanitize(r.contact.fullName || r.name)}.docx`)
}
