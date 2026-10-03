import { Resume, SectionKey } from "../types/resume"
import { dateRangeText, languageOf, resumeStrings, type ResumeStrings } from "./resumeLanguage"
import { createZip, strToBytes, ZipEntry } from "./zip"
import { triggerDownload, sanitize } from "./storage"
import { templateMeta } from "../templates/registry"

// Build a genuine .docx (Office Open XML) entirely client-side. The file stays
// fully editable in Word / Google Docs and is single-column + standard headings
// so it parses cleanly in ATS systems.

export interface DocxOptions {
  /** Use the selected template's fonts and accent color. Off for locked premium templates. */
  templateStyles?: boolean
}

interface DocxStyle {
  body: string
  heading: string
  accent: string
  /** Twentieths of a point (twips) for the right-aligned date tab stop. */
  tabStop: number
  page: { w: number; h: number }
  /** Fixed headings and labels in the resume's language. */
  strings: ResumeStrings
  /** BCP 47 tag Word uses for spelling and hyphenation. */
  lang: string
}

function esc(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // XML 1.0 forbids most control characters; pasted text sometimes carries them.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
}

function fonts(font: string): string {
  const f = esc(font)
  return `<w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:cs="${f}" w:eastAsia="${f}"/>`
}

function run(text: string, opts: { bold?: boolean; italic?: boolean; size?: number; color?: string; font?: string; caps?: boolean } = {}): string {
  const props = [
    opts.font ? fonts(opts.font) : "",
    opts.bold ? "<w:b/>" : "",
    opts.italic ? "<w:i/>" : "",
    opts.caps ? "<w:caps/>" : "",
    opts.color ? `<w:color w:val="${opts.color}"/>` : "",
    `<w:sz w:val="${opts.size ?? 22}"/>`,
  ].join("")
  return `<w:r><w:rPr>${props}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`
}

function para(content: string, opts: { center?: boolean; before?: number; after?: number; tab?: number } = {}): string {
  const tabs = opts.tab ? `<w:tabs><w:tab w:val="right" w:pos="${opts.tab}"/></w:tabs>` : ""
  return `<w:p><w:pPr>${tabs}<w:spacing w:before="${opts.before ?? 0}" w:after="${opts.after ?? 60}"/>${opts.center ? '<w:jc w:val="center"/>' : ""}</w:pPr>${content}</w:p>`
}

function sectionHeading(text: string, style: DocxStyle): string {
  return (
    `<w:p><w:pPr><w:keepNext/><w:spacing w:before="220" w:after="60"/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="${style.accent}"/></w:pBdr></w:pPr>` +
    run(text, { bold: true, caps: true, size: 23, color: style.accent, font: style.heading }) +
    `</w:p>`
  )
}

function bullet(text: string): string {
  return `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:spacing w:after="40"/></w:pPr>${run(text)}</w:p>`
}

// Title on the left, dates right-aligned on the same line via a tab stop.
function entryHeading(title: string, right: string, style: DocxStyle): string {
  const tail = right ? `<w:r><w:tab/></w:r>${run(right, { size: 20, color: "555555" })}` : ""
  return `<w:p><w:pPr><w:keepNext/><w:tabs><w:tab w:val="right" w:pos="${style.tabStop}"/></w:tabs><w:spacing w:before="80" w:after="20"/></w:pPr>${run(title, { bold: true, font: style.heading })}${tail}</w:p>`
}



function hyperlinkTarget(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed || /\s/.test(trimmed)) return null
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) return `mailto:${trimmed}`
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(trimmed)) return `https://${trimmed}`
  return null
}

function body(r: Resume, style: DocxStyle, links: string[]): string {
  const out: string[] = []
  const c = r.contact
  out.push(para(run(c.fullName || "Your Name", { bold: true, size: 40, font: style.heading }), { center: true, after: 40 }))
  if (c.headline) out.push(para(run(c.headline, { size: 24, color: style.accent, font: style.heading }), { center: true, after: 40 }))
  const contactItems = [c.email, c.phone, c.location, c.website, c.linkedin, c.github].filter(Boolean)
  if (contactItems.length) {
    const parts = contactItems.map((item) => {
      const target = hyperlinkTarget(item)
      if (!target) return run(item, { size: 20 })
      links.push(target)
      return `<w:hyperlink r:id="rIdLink${links.length}"><w:r><w:rPr><w:color w:val="${style.accent}"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${esc(item)}</w:t></w:r></w:hyperlink>`
    })
    out.push(para(parts.join(run("  |  ", { size: 20, color: "888888" })), { center: true, after: 120 }))
  }

  const order = r.settings.sectionOrder.filter((s) => !r.settings.hidden.includes(s))
  for (const key of order) renderSection(key, r, out, style)
  for (const sec of r.customSections || []) {
    if (sec.hidden || !sec.items.length) continue
    out.push(sectionHeading(sec.title || style.strings.section, style))
    for (const item of sec.items) {
      if (item.title || item.date) out.push(entryHeading(item.title, item.date, style))
      if (item.subtitle) out.push(para(run(item.subtitle, { size: 20, italic: true, color: "555555" })))
      if (item.description) out.push(para(run(item.description, { size: 21 })))
      item.bullets.filter(Boolean).forEach((b) => out.push(bullet(b)))
    }
  }
  return out.join("")
}

function renderSection(key: SectionKey, r: Resume, out: string[], style: DocxStyle) {
  const has =
    (key === "summary" && r.summary) ||
    (key === "experience" && r.experience.length) ||
    (key === "education" && r.education.length) ||
    (key === "skills" && r.skills.length) ||
    (key === "projects" && r.projects.length) ||
    (key === "certifications" && r.certifications.length)
  if (!has) return
  out.push(sectionHeading(style.strings.sections[key], style))
  const dateRange = (start: string, end: string, current?: boolean) => dateRangeText(start, end, current, style.strings)
  switch (key) {
    case "summary":
      out.push(para(run(r.summary)))
      break
    case "experience":
      for (const e of r.experience) {
        out.push(entryHeading(`${e.role}${e.company ? ", " + e.company : ""}`, dateRange(e.startDate, e.endDate, e.current), style))
        if (e.location) out.push(para(run(e.location, { size: 20, italic: true, color: "555555" })))
        e.bullets.filter(Boolean).forEach((b) => out.push(bullet(b)))
      }
      break
    case "education":
      for (const e of r.education) {
        out.push(entryHeading(`${e.degree} ${e.field}`.trim() || e.school, dateRange(e.startDate, e.endDate), style))
        const meta = [e.school, e.location].filter(Boolean).join("  |  ")
        if (meta) out.push(para(run(meta, { size: 20, italic: true, color: "555555" })))
        if (e.details) out.push(para(run(e.details, { size: 20 })))
      }
      break
    case "skills":
      for (const g of r.skills) {
        const label = g.category ? run(`${g.category}: `, { bold: true }) : ""
        out.push(para(label + run(g.items.join(", ")), { after: 40 }))
      }
      break
    case "projects":
      for (const p of r.projects) {
        out.push(entryHeading(p.name, p.link, style))
        if (p.description) out.push(para(run(p.description, { size: 21 })))
        p.bullets.filter(Boolean).forEach((b) => out.push(bullet(b)))
      }
      break
    case "certifications":
      for (const c of r.certifications) {
        out.push(para(run(`${c.name}${c.issuer ? " — " + c.issuer : ""}${c.date ? " (" + c.date + ")" : ""}`), { after: 40 }))
      }
      break
  }
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`

function documentRels(links: string[]): string {
  const hyperlinks = links
    .map((target, index) => `<Relationship Id="rIdLink${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${esc(target)}" TargetMode="External"/>`)
    .join("\n")
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
${hyperlinks}
</Relationships>`
}

function stylesXml(style: DocxStyle): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr>${fonts(style.body)}<w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="${style.lang}"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="60" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
</w:styles>`
}

function coreXml(r: Resume): string {
  const title = esc(`${r.contact.fullName || r.name || "Resume"} — Resume`)
  const author = esc(r.contact.fullName || "")
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${title}</dc:title><dc:creator>${author}</dc:creator></cp:coreProperties>`
}

const NUMBERING = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`

function docxStyle(r: Resume, options: DocxOptions): DocxStyle {
  const meta = templateMeta(options.templateStyles ? r.settings.template : "modern")
  const accent = options.templateStyles && /^#[0-9a-f]{6}$/i.test(r.settings.accent) ? r.settings.accent.slice(1).toUpperCase() : "1F2937"
  // US Letter is 12240 x 15840 twips; A4 is 11906 x 16838. Margins are 0.75in (1080 twips).
  const page = r.settings.paperSize === "a4" ? { w: 11906, h: 16838 } : { w: 12240, h: 15840 }
  const lang = { en: "en-US", es: "es-ES", fr: "fr-FR" }[languageOf(r)]
  return { body: meta.docx.body, heading: meta.docx.heading, accent, tabStop: page.w - 2160, page, strings: resumeStrings(r), lang }
}

export function buildDocxBlob(r: Resume, options: DocxOptions = {}): Blob {
  const style = docxStyle(r, options)
  const links: string[] = []
  const content = body(r, style, links)
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>${content}<w:sectPr><w:pgSz w:w="${style.page.w}" w:h="${style.page.h}"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body>
</w:document>`

  const entries: ZipEntry[] = [
    { name: "[Content_Types].xml", data: strToBytes(CONTENT_TYPES) },
    { name: "_rels/.rels", data: strToBytes(RELS) },
    { name: "docProps/core.xml", data: strToBytes(coreXml(r)) },
    { name: "word/document.xml", data: strToBytes(document) },
    { name: "word/_rels/document.xml.rels", data: strToBytes(documentRels(links)) },
    { name: "word/numbering.xml", data: strToBytes(NUMBERING) },
    { name: "word/styles.xml", data: strToBytes(stylesXml(style)) },
  ]
  return createZip(entries)
}

export function exportDocx(r: Resume, options: DocxOptions = {}): void {
  const blob = buildDocxBlob(r, options)
  triggerDownload(blob, `${sanitize(r.contact.fullName || r.name)}.docx`)
}
