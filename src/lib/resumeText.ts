// Plain-text serialization of a resume, used by AI prompts and ATS analysis,
// plus a quick word counter for length checks.

import { Resume } from "../types/resume"

function line(parts: Array<string | undefined>, sep = " | "): string {
  return parts.filter((p) => p && p.trim()).join(sep)
}

export function resumeToPlainText(r: Resume): string {
  const out: string[] = []
  const c = r.contact
  if (c.fullName) out.push(c.fullName)
  if (c.headline) out.push(c.headline)
  out.push(line([c.email, c.phone, c.location, c.website, c.linkedin, c.github]))

  if (r.summary) {
    out.push("", "SUMMARY", r.summary)
  }

  if (r.experience.length) {
    out.push("", "EXPERIENCE")
    for (const e of r.experience) {
      out.push(line([e.role, e.company, e.location]))
      out.push(line([e.startDate, e.current ? "Present" : e.endDate], " - "))
      for (const b of e.bullets.filter(Boolean)) out.push(`- ${b}`)
    }
  }

  if (r.education.length) {
    out.push("", "EDUCATION")
    for (const e of r.education) {
      out.push(line([e.degree, e.field, e.school, e.location]))
      out.push(line([e.startDate, e.endDate], " - "))
      if (e.details) out.push(e.details)
    }
  }

  if (r.skills.length) {
    out.push("", "SKILLS")
    for (const g of r.skills) out.push(`${g.category ? g.category + ": " : ""}${g.items.join(", ")}`)
  }

  if (r.projects.length) {
    out.push("", "PROJECTS")
    for (const p of r.projects) {
      out.push(line([p.name, p.link]))
      if (p.description) out.push(p.description)
      for (const b of p.bullets.filter(Boolean)) out.push(`- ${b}`)
    }
  }

  if (r.certifications.length) {
    out.push("", "CERTIFICATIONS")
    for (const ct of r.certifications) out.push(line([ct.name, ct.issuer, ct.date]))
  }

  return out.join("\n").trim()
}

export function wordCount(r: Resume): number {
  return resumeToPlainText(r).split(/\s+/).filter(Boolean).length
}
