import { Resume, SectionKey } from "../types/resume"

const WEAK_VERBS = [
  "responsible for",
  "worked on",
  "helped",
  "assisted",
  "participated",
  "involved in",
  "handled",
  "duties included",
]

export interface QualityFlag {
  severity: "warn" | "info"
  text: string
}

export function qualityFlags(r: Resume): QualityFlag[] {
  const flags: QualityFlag[] = []
  const allBullets = [
    ...r.experience.flatMap((e) => e.bullets),
    ...r.projects.flatMap((p) => p.bullets),
  ].filter(Boolean)

  const weak = allBullets.filter((b) =>
    WEAK_VERBS.some((w) => b.toLowerCase().includes(w)),
  )
  if (weak.length)
    flags.push({
      severity: "warn",
      text: `${weak.length} bullet${weak.length > 1 ? "s" : ""} use weak phrasing (e.g. \u201Cresponsible for\u201D). Start with strong action verbs.`,
    })

  const noMetrics = allBullets.filter((b) => !/\d/.test(b)).length
  if (allBullets.length && noMetrics / allBullets.length > 0.6)
    flags.push({
      severity: "warn",
      text: "Most bullets lack numbers. Add metrics (%, $, counts) to show measurable impact.",
    })

  if (!r.contact.email || !r.contact.phone)
    flags.push({ severity: "warn", text: "Missing email or phone in contact info." })

  const longBullets = allBullets.filter((b) => b.split(/\s+/).length > 32)
  if (longBullets.length)
    flags.push({
      severity: "info",
      text: `${longBullets.length} bullet${longBullets.length > 1 ? "s are" : " is"} very long. Keep each to ~1–2 lines for readability.`,
    })

  return flags
}

export interface CompletenessResult {
  percent: number
  items: { key: SectionKey | "contact"; label: string; done: boolean }[]
}

export function completeness(r: Resume): CompletenessResult {
  const items: CompletenessResult["items"] = [
    { key: "contact", label: "Contact details", done: !!(r.contact.fullName && r.contact.email) },
    { key: "summary", label: "Summary", done: r.summary.trim().length > 40 },
    { key: "experience", label: "Experience", done: r.experience.some((e) => e.bullets.some(Boolean)) },
    { key: "education", label: "Education", done: r.education.length > 0 },
    { key: "skills", label: "Skills", done: r.skills.some((s) => s.items.length) },
  ]
  const done = items.filter((i) => i.done).length
  return { percent: Math.round((done / items.length) * 100), items }
}
