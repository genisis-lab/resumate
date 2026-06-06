// Offline proofreading: flags common misspellings and simple grammar/style
// slips, and can auto-fix the misspellings across every text field. No API or
// network needed - a small dictionary of frequently-misspelled words plus a
// few cheap heuristics.

import { Resume } from "../types/resume"
import { resumeToPlainText } from "./resumeText"

const MISSPELLINGS: Record<string, string> = {
  experiance: "experience",
  managment: "management",
  responsable: "responsible",
  acheived: "achieved",
  acheive: "achieve",
  recieved: "received",
  recieve: "receive",
  seperate: "separate",
  succesful: "successful",
  successfull: "successful",
  developement: "development",
  enviroment: "environment",
  occured: "occurred",
  occurence: "occurrence",
  publically: "publicly",
  definately: "definitely",
  untill: "until",
  wich: "which",
  alot: "a lot",
  teh: "the",
  thier: "their",
  collaberation: "collaboration",
  comunication: "communication",
  leadereship: "leadership",
  proffesional: "professional",
  profesional: "professional",
  organisation: "organization",
  liason: "liaison",
  maintainance: "maintenance",
  oppurtunity: "opportunity",
  begining: "beginning",
  knowlege: "knowledge",
  strenghten: "strengthen",
}

// Keys whose string values must never be auto-edited (ids, URLs, settings).
const SKIP_KEYS = new Set([
  "id",
  "accent",
  "template",
  "density",
  "website",
  "linkedin",
  "github",
  "email",
  "link",
])

function fixText(s: string): string {
  return s.replace(/[A-Za-z]+/g, (m) => {
    const rep = MISSPELLINGS[m.toLowerCase()]
    if (!rep) return m
    if (m[0] === m[0].toUpperCase()) return rep.charAt(0).toUpperCase() + rep.slice(1)
    return rep
  })
}

function deepFix(value: unknown, key?: string): unknown {
  if (typeof value === "string") return key && SKIP_KEYS.has(key) ? value : fixText(value)
  if (Array.isArray(value)) return value.map((v) => deepFix(v))
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(value as Record<string, unknown>)) {
      out[k] = deepFix((value as Record<string, unknown>)[k], k)
    }
    return out
  }
  return value
}

// Replace known misspellings everywhere except ids/URLs. Returns a new Resume.
export function autoFixSpelling(r: Resume): Resume {
  return deepFix(r) as Resume
}

// Build a human-readable list of issues found across the whole resume.
export function findProofIssues(r: Resume): string[] {
  const issues: string[] = []
  const text = resumeToPlainText(r)

  const seen = new Set<string>()
  text.replace(/[A-Za-z]+/g, (m) => {
    const low = m.toLowerCase()
    if (MISSPELLINGS[low] && !seen.has(low)) {
      seen.add(low)
      issues.push(`Possible misspelling: "${m}" -> "${MISSPELLINGS[low]}"`)
    }
    return m
  })

  if (/\S {2,}/.test(text)) {
    issues.push("Double spaces found - use single spaces between words.")
  }

  const repeated = text.match(/\b(\w{3,})\s+\1\b/i)
  if (repeated) {
    issues.push(`Repeated word: "${repeated[1]} ${repeated[1]}".`)
  }

  if (/\bi\b/.test(text)) {
    issues.push('Lowercase "i" should be capitalized as "I".')
  }

  return issues
}
