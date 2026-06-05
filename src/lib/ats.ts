import { Resume } from "../types/resume"
import { resumeToPlainText, wordCount } from "./resumeText"

export interface AtsSuggestion {
  section: string
  severity: "high" | "medium" | "low"
  text: string
}

export interface AtsResult {
  score: number // 0-100
  matchedKeywords: string[]
  missingKeywords: string[]
  suggestions: AtsSuggestion[]
  summary: string
  source: "ai" | "local"
}

// ---- Stopwords for keyword extraction ----
const STOP = new Set(
  "a an the and or but for nor so yet of to in on at by with from as is are was were be been being this that these those you your we our they their it its will would can could should must have has had do does did not your you our we us i me my he she them his her into out up down over under above below more most less least very also able strong excellent good great team work working role responsibilities responsibility experience years year months ability including include includes etc using use used"
    .split(/\s+/),
)

function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z0-9+#.\-]{1,}/g) || []).filter(
    (w) => !STOP.has(w) && w.length > 2,
  )
}

// Extract candidate keywords (uni + bi-grams) ranked by frequency.
export function extractKeywords(jd: string, limit = 25): string[] {
  const toks = tokens(jd)
  const freq = new Map<string, number>()
  const bump = (k: string) => freq.set(k, (freq.get(k) || 0) + 1)
  for (let i = 0; i < toks.length; i++) {
    bump(toks[i])
    if (i < toks.length - 1) bump(`${toks[i]} ${toks[i + 1]}`)
  }
  return [...freq.entries()]
    .filter(([k, n]) => n >= (k.includes(" ") ? 2 : 2) || k.includes(" "))
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
    .slice(0, limit)
}

// ---- Local heuristic analysis (offline fallback / instant feedback) ----
export function analyzeLocally(resume: Resume, jd: string): AtsResult {
  const resumeText = resumeToPlainText(resume).toLowerCase()
  const keywords = extractKeywords(jd)
  const matched: string[] = []
  const missing: string[] = []
  for (const k of keywords) {
    if (resumeText.includes(k.toLowerCase())) matched.push(k)
    else missing.push(k)
  }

  const keywordScore = keywords.length
    ? Math.round((matched.length / keywords.length) * 60)
    : 30

  // Structure / completeness score (40 pts).
  let structure = 0
  if (resume.contact.email && resume.contact.phone) structure += 6
  if (resume.summary && resume.summary.length > 60) structure += 6
  if (resume.experience.length >= 1) structure += 8
  const bulletCount = resume.experience.reduce((n, e) => n + e.bullets.filter(Boolean).length, 0)
  if (bulletCount >= 3) structure += 6
  if (resume.skills.length >= 1) structure += 6
  if (resume.education.length >= 1) structure += 4
  const wc = wordCount(resume)
  if (wc >= 250 && wc <= 850) structure += 4

  const score = Math.max(5, Math.min(100, keywordScore + structure))

  const suggestions: AtsSuggestion[] = []
  if (missing.length)
    suggestions.push({
      section: "Keywords",
      severity: "high",
      text: `Add or naturally weave in missing terms from the job description: ${missing.slice(0, 8).join(", ")}.`,
    })
  const quantified = resume.experience.some((e) =>
    e.bullets.some((b) => /\d/.test(b)),
  )
  if (!quantified)
    suggestions.push({
      section: "Experience",
      severity: "high",
      text: "Quantify your impact — add metrics like %, $, time saved, or user counts to at least a few bullets.",
    })
  if (!resume.summary || resume.summary.length < 60)
    suggestions.push({
      section: "Summary",
      severity: "medium",
      text: "Write a 2–3 sentence professional summary tailored to this role, front-loading your strongest match.",
    })
  if (bulletCount < 3)
    suggestions.push({
      section: "Experience",
      severity: "medium",
      text: "Add more achievement-focused bullet points (aim for 3–5 per recent role) starting with strong action verbs.",
    })
  if (wc > 900)
    suggestions.push({
      section: "Length",
      severity: "low",
      text: "Your resume is quite long. Trim to the most relevant content (1 page for <10 yrs experience).",
    })
  if (!resume.skills.length)
    suggestions.push({
      section: "Skills",
      severity: "medium",
      text: "Add a Skills section listing tools and technologies named in the job description.",
    })

  const summary =
    score >= 80
      ? "Strong match. Your resume aligns well with this role — tighten a few keywords and you're set."
      : score >= 60
        ? "Decent match. Address the missing keywords and quantify achievements to push your score higher."
        : "Needs work. Significant keyword and structure gaps — follow the suggestions below to improve alignment."

  return {
    score,
    matchedKeywords: matched,
    missingKeywords: missing,
    suggestions,
    summary,
    source: "local",
  }
}

// ---- AI-powered analysis via the Cloudflare Pages Function ----
export async function analyzeWithAI(
  resume: Resume,
  jd: string,
): Promise<AtsResult> {
  const resumeText = resumeToPlainText(resume)
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resumeText, jobDescription: jd }),
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => "")
    throw new Error(`AI analysis unavailable (${res.status}). ${msg}`)
  }
  const data = (await res.json()) as Partial<AtsResult>
  return {
    score: clampScore(data.score),
    matchedKeywords: data.matchedKeywords ?? [],
    missingKeywords: data.missingKeywords ?? [],
    suggestions: data.suggestions ?? [],
    summary: data.summary ?? "",
    source: "ai",
  }
}

function clampScore(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n)
  if (!isFinite(v)) return 0
  return Math.max(0, Math.min(100, Math.round(v)))
}

// Try AI first; fall back to the local heuristic if the endpoint is missing
// (e.g. local dev without functions, or before the API key is configured).
export async function analyzeResume(
  resume: Resume,
  jd: string,
): Promise<AtsResult> {
  try {
    return await analyzeWithAI(resume, jd)
  } catch {
    return analyzeLocally(resume, jd)
  }
}
