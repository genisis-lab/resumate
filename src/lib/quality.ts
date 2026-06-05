import { Resume, SectionKey } from "../types/resume"
import { wordCount } from "./resumeText"

// A small set of common soft skills. Used to nudge candidates whose Skills
// section is all soft skills to add concrete hard/technical skills too.
const SOFT_SKILLS = [
  "communication",
  "teamwork",
  "leadership",
  "problem solving",
  "problem-solving",
  "time management",
  "adaptability",
  "collaboration",
  "creativity",
  "organization",
  "detail oriented",
  "detail-oriented",
  "work ethic",
  "interpersonal",
  "motivated",
  "flexible",
]

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

  // First-person pronouns read poorly on resumes.
  const firstPerson = allBullets.filter((b) => /\b(i|me|my|myself)\b/i.test(b)).length
  if (firstPerson)
    flags.push({
      severity: "info",
      text: `${firstPerson} bullet${firstPerson > 1 ? "s use" : " uses"} first-person words (I, me, my). Drop them and lead with action verbs.`,
    })

  // Overall length / readability.
  const wc = wordCount(r)
  if (wc > 0 && wc < 200)
    flags.push({
      severity: "info",
      text: `Your resume is short (${wc} words). Add more achievement detail to better fill one page.`,
    })
  if (wc > 900)
    flags.push({
      severity: "warn",
      text: `Your resume is long (${wc} words). Aim for one page (~250–850 words) unless you have 10+ years' experience.`,
    })
  const avgWords = allBullets.length
    ? allBullets.reduce((n, b) => n + b.split(/\s+/).filter(Boolean).length, 0) / allBullets.length
    : 0
  if (avgWords > 26)
    flags.push({
      severity: "info",
      text: "Bullets average quite long. Tighten wording so each reads in one glance.",
    })

  // Hard vs soft skill balance.
  const allSkills = r.skills.flatMap((g) => g.items).filter(Boolean)
  if (allSkills.length) {
    const soft = allSkills.filter((s) => SOFT_SKILLS.includes(s.toLowerCase().trim()))
    if (soft.length && soft.length === allSkills.length)
      flags.push({
        severity: "warn",
        text: "Your skills are all soft skills. Add concrete hard/technical skills (tools, languages, platforms) that match the job.",
      })
  }

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
