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

// Overused phrases recruiters skim past. Flagged, never auto-replaced.
export const CLICHES = [
  "results-driven",
  "results driven",
  "hard-working",
  "hardworking",
  "team player",
  "go-getter",
  "self-starter",
  "detail-oriented",
  "think outside the box",
  "synergy",
  "proven track record",
  "dynamic",
  "passionate",
  "rockstar",
  "ninja",
]

export function findCliches(text: string): string[] {
  const lower = text.toLowerCase()
  return CLICHES.filter((phrase) => new RegExp(`(^|[^a-z])${phrase.replace(/[-\s]/g, "[-\\s]")}([^a-z]|$)`).test(lower))
    .filter((phrase, index, list) => !list.slice(0, index).some((earlier) => earlier.replace(/[-\s]/g, "") === phrase.replace(/[-\s]/g, "")))
}

// Classify a free-text date so mixed styles ("Jan 2021", "2019", "03/2020") can be flagged.
export function dateStyle(value: string): string | null {
  const v = value.trim()
  if (!v || /^(present|current|now)$/i.test(v)) return null
  if (/^\d{4}$/.test(v)) return "year"
  if (/^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+\d{4}$/i.test(v)) return "short-month"
  if (/^(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}$/i.test(v)) return "long-month"
  if (/^\d{1,2}\/\d{4}$/.test(v)) return "numeric"
  if (/^\d{4}-\d{2}$/.test(v)) return "iso"
  return "other"
}

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

  // Overused phrases in the summary or bullets.
  const cliches = findCliches([r.summary, r.contact.headline, ...allBullets].join("\n"))
  if (cliches.length)
    flags.push({
      severity: "info",
      text: `Overused phrase${cliches.length > 1 ? "s" : ""}: ${cliches.slice(0, 4).map((c) => `\u201C${c}\u201D`).join(", ")}. Replace with specific evidence of the quality.`,
    })

  // Consistent date formatting reads as careful work.
  const dates = [
    ...r.experience.flatMap((e) => [e.startDate, e.current ? "" : e.endDate]),
    ...r.education.flatMap((e) => [e.startDate, e.endDate]),
  ]
  const styles = new Set(dates.map(dateStyle).filter((style): style is string => Boolean(style)))
  if (styles.size > 1)
    flags.push({ severity: "info", text: "Dates use mixed formats (for example “Jan 2021” and “2019”). Pick one style throughout." })

  const undated = r.experience.filter((e) => (e.role || e.company) && !e.startDate.trim() && !e.endDate.trim() && !e.current)
  if (undated.length)
    flags.push({ severity: "warn", text: `${undated.length} role${undated.length > 1 ? "s are" : " is"} missing dates. Recruiters and ATS parsers expect a start and end date.` })

  const sparse = r.experience.filter((e) => (e.role || e.company) && e.bullets.filter((b) => b.trim()).length === 0)
  if (sparse.length)
    flags.push({ severity: "warn", text: `${sparse.length} role${sparse.length > 1 ? "s have" : " has"} no bullet points. Add one or two outcomes for each role.` })
  const crowded = r.experience.filter((e) => e.bullets.filter((b) => b.trim()).length > 7)
  if (crowded.length)
    flags.push({ severity: "info", text: `${crowded.length} role${crowded.length > 1 ? "s have" : " has"} more than 7 bullets. Keep the 4 to 6 strongest so each one gets read.` })

  if (r.contact.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.contact.email.trim()))
    flags.push({ severity: "warn", text: "The email address looks incomplete. Check it before you export." })

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
