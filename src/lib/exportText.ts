// Plain-text, Markdown, and JSON Resume exports. These complement the PDF and
// Word exporters with ATS-friendly / portable formats developers often want
// (paste into a text box, commit to a repo, or import elsewhere).

import { Resume, SectionKey, SECTION_LABELS } from "../types/resume"
import { resumeToPlainText } from "./resumeText"
import { triggerDownload, sanitize } from "./storage"

function fileBase(r: Resume): string {
  return sanitize(r.contact.fullName || r.name || "resume")
}

function dateRange(start: string, end: string, current?: boolean): string {
  const e = current ? "Present" : end
  if (start && e) return `${start} \u2013 ${e}`
  return start || e || ""
}

function sectionMarkdown(key: SectionKey, r: Resume): string {
  const lines: string[] = []
  switch (key) {
    case "summary":
      return r.summary || ""
    case "experience":
      if (!r.experience.length) return ""
      for (const e of r.experience) {
        lines.push(`### ${[e.role, e.company].filter(Boolean).join(" \u00b7 ")}`)
        const meta = [dateRange(e.startDate, e.endDate, e.current), e.location].filter(Boolean).join(" | ")
        if (meta) lines.push(`*${meta}*`)
        for (const b of e.bullets.filter(Boolean)) lines.push(`- ${b}`)
        lines.push("")
      }
      break
    case "education":
      if (!r.education.length) return ""
      for (const e of r.education) {
        lines.push(`### ${[e.degree, e.field].filter(Boolean).join(" ")}`)
        const meta = [e.school, e.location, dateRange(e.startDate, e.endDate)].filter(Boolean).join(" | ")
        if (meta) lines.push(`*${meta}*`)
        if (e.details) lines.push(e.details)
        lines.push("")
      }
      break
    case "skills":
      if (!r.skills.length) return ""
      for (const g of r.skills) lines.push(`- **${g.category || "Skills"}:** ${g.items.join(", ")}`)
      break
    case "projects":
      if (!r.projects.length) return ""
      for (const p of r.projects) {
        lines.push(`### ${p.name}${p.link ? ` (${p.link})` : ""}`)
        if (p.description) lines.push(p.description)
        for (const b of p.bullets.filter(Boolean)) lines.push(`- ${b}`)
        lines.push("")
      }
      break
    case "certifications":
      if (!r.certifications.length) return ""
      for (const ct of r.certifications) lines.push(`- ${[ct.name, ct.issuer, ct.date].filter(Boolean).join(" \u2014 ")}`)
      break
  }
  return lines.join("\n").trim()
}

export function resumeToMarkdown(r: Resume): string {
  const c = r.contact
  const out: string[] = []
  out.push(`# ${c.fullName || "Your Name"}`)
  if (c.headline) out.push(`*${c.headline}*`)
  const contacts = [c.email, c.phone, c.location, c.website, c.linkedin, c.github].filter(Boolean)
  if (contacts.length) out.push(contacts.join(" \u2022 "))
  out.push("")
  const order = r.settings.sectionOrder.filter((s) => !r.settings.hidden.includes(s))
  for (const key of order) {
    const body = sectionMarkdown(key, r)
    if (body) out.push(`## ${SECTION_LABELS[key]}`, body, "")
  }
  return out.join("\n").trim() + "\n"
}

// JSON Resume open standard — https://jsonresume.org/schema
export function toJsonResume(r: Resume): Record<string, unknown> {
  const c = r.contact
  const profiles: Array<Record<string, string>> = []
  if (c.linkedin) profiles.push({ network: "LinkedIn", url: c.linkedin })
  if (c.github) profiles.push({ network: "GitHub", url: c.github })
  return {
    $schema: "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json",
    basics: {
      name: c.fullName,
      label: c.headline,
      email: c.email,
      phone: c.phone,
      url: c.website,
      summary: r.summary,
      location: { address: c.location },
      profiles,
    },
    work: r.experience.map((e) => ({
      name: e.company,
      position: e.role,
      location: e.location,
      startDate: e.startDate,
      endDate: e.current ? "" : e.endDate,
      highlights: e.bullets.filter(Boolean),
    })),
    education: r.education.map((e) => ({
      institution: e.school,
      area: e.field,
      studyType: e.degree,
      startDate: e.startDate,
      endDate: e.endDate,
      score: e.details,
    })),
    skills: r.skills.map((g) => ({ name: g.category, keywords: g.items })),
    projects: r.projects.map((p) => ({
      name: p.name,
      description: p.description,
      url: p.link,
      highlights: p.bullets.filter(Boolean),
    })),
    certificates: r.certifications.map((ct) => ({ name: ct.name, issuer: ct.issuer, date: ct.date })),
  }
}

export function exportMarkdown(r: Resume): void {
  triggerDownload(new Blob([resumeToMarkdown(r)], { type: "text/markdown" }), `${fileBase(r)}.md`)
}

export function exportPlainText(r: Resume): void {
  triggerDownload(new Blob([resumeToPlainText(r)], { type: "text/plain" }), `${fileBase(r)}.txt`)
}

export function exportJsonResume(r: Resume): void {
  triggerDownload(
    new Blob([JSON.stringify(toJsonResume(r), null, 2)], { type: "application/json" }),
    `${fileBase(r)}.jsonresume.json`,
  )
}
