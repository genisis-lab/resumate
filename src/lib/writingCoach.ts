// Live writing coach - scores a single resume bullet and surfaces concrete,
// offline (no-API) suggestions: weak phrasing, passive voice, missing metrics,
// first-person pronouns, and length. Used by the bullet editor.

export const WEAK_OPENERS = [
  "responsible for",
  "responsibilities included",
  "duties included",
  "worked on",
  "worked with",
  "helped",
  "assisted",
  "participated in",
  "involved in",
  "handled",
  "tasked with",
  "in charge of",
]

export type BulletLevel = "weak" | "ok" | "strong"

export interface BulletScore {
  score: number
  level: BulletLevel
  issues: string[]
}

// Returns null for empty bullets so the UI can skip them.
export function scoreBullet(text: string): BulletScore | null {
  const t = (text || "").trim()
  if (!t) return null
  const lower = t.toLowerCase()
  const words = t.split(/\s+/).filter(Boolean)
  const issues: string[] = []
  let score = 100

  const weak = WEAK_OPENERS.find((w) => lower.startsWith(w) || lower.includes(w))
  if (weak) {
    issues.push("Weak phrasing (\"" + weak + "\") \u2014 open with a strong action verb.")
    score -= 28
  }

  if (/\b(was|were|been|being|is|are|be)\b\s+\w+(ed|en)\b/i.test(t)) {
    issues.push("Passive voice \u2014 rephrase so you are the one acting.")
    score -= 16
  }

  if (!/\d/.test(t)) {
    issues.push("No metric \u2014 add a number (%, $, count, or time saved).")
    score -= 22
  }

  if (/\b(i|me|my|myself|we|our|us)\b/i.test(t)) {
    issues.push("Uses first-person pronouns \u2014 drop them and lead with a verb.")
    score -= 12
  }

  if (words.length > 32) {
    issues.push("Very long \u2014 tighten to 1\u20132 lines.")
    score -= 12
  } else if (words.length < 4) {
    issues.push("Very short \u2014 add specifics about scope and impact.")
    score -= 10
  }

  score = Math.max(0, Math.min(100, score))
  const level: BulletLevel = score >= 80 ? "strong" : score >= 55 ? "ok" : "weak"
  return { score, level, issues }
}
