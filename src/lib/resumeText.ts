import { Resume, SectionKey } from "../types/resume"

// Flatten a resume into plain text — used by the ATS analyzer and keyword matching.
export function resumeToPlainText(r: Resume): string {
  const lines: string[] = []
  const c = r.contact
  lines.push(c.fullName, c.headline, c.location, c.email)
  if (r.summary) lines.push(r.summary)

  const order = r.settings.sectionOrder.filter(
    (s) => !r.settings.hidden.includes(s),
  )
  for (const key of order) writeSection(key, r, lines)
  return lines.filter(Boolean).join("\n")
}

function writeSection(key: SectionKey, r: Resume, lines: string[]) {
  switch (key) {
    case "experience":
      for (const e of r.experience) {
        lines.push(`${e.role} at ${e.company}`, e.location)
        e.bullets.forEach((b) => lines.push(b))
      }
      break
    case "education":
      for (const e of r.education) {
        lines.push(`${e.degree} ${e.field}`, e.school, e.details)
      }
      break
    case "skills":
      for (const g of r.skills) lines.push(`${g.category}: ${g.items.join(", ")}`)
      break
    case "projects":
      for (const p of r.projects) {
        lines.push(p.name, p.description)
        p.bullets.forEach((b) => lines.push(b))
      }
      break
    case "certifications":
      for (const c of r.certifications) lines.push(`${c.name} — ${c.issuer} ${c.date}`)
      break
    case "summary":
      break
  }
}

export function wordCount(r: Resume): number {
  return resumeToPlainText(r).split(/\s+/).filter(Boolean).length
}
