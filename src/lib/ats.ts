import { Resume } from "../types/resume"
import { resumeToPlainText, wordCount } from "./resumeText"
import { aiClientOverrides } from "./byok"
import { trackEvent } from "./analytics"

export interface AtsSuggestion {
  section: string
  severity: "high" | "medium" | "low"
  text: string
}

export interface SectionScore {
  label: string
  score: number
  max: number
  note?: string
}

export interface JobSignal {
  term: string
  priority: "required" | "preferred" | "general"
  matched: boolean
}

export interface AtsResult {
  score: number // 0-100
  matchedKeywords: string[]
  missingKeywords: string[]
  suggestions: AtsSuggestion[]
  summary: string
  source: "ai" | "local"
  // Optional per-category breakdown shown as bars in the analyzer.
  sections?: SectionScore[]
  jobSignals?: JobSignal[]
}

// Build a transparent per-category score breakdown (always computed locally so
// the analyzer can show it even for AI results).
export function buildSectionScores(resume: Resume, jd: string, targetRole = ""): SectionScore[] {
  const resumeText = resumeToPlainText(resume)
  const keywords = extractKeywords(`${targetRole} ${jd}`)
  const matched = keywords.filter((k) => keywordInText(resumeText, k))
  const kwPct = keywords.length ? matched.length / keywords.length : 0
  const prioritized = extractJobSignals(jd, resumeText).filter((signal) => signal.priority !== "general")
  const priorityPct = prioritized.length
    ? prioritized.filter((signal) => signal.matched).length / prioritized.length
    : kwPct
  const bulletCount = resume.experience.reduce((n, e) => n + e.bullets.filter(Boolean).length, 0)
  const quantified = resume.experience.some((e) => e.bullets.some((b) => /\d/.test(b)))
  const wc = wordCount(resume)

  const contact = (resume.contact.email ? 1 : 0) + (resume.contact.phone ? 1 : 0) + (resume.contact.location ? 1 : 0)
  const summaryScore = resume.summary.length > 80 ? 10 : resume.summary.length > 20 ? 5 : 0
  const expBase = resume.experience.length ? 7 : 0
  const expBullets = Math.min(8, bulletCount)
  const expQuant = quantified ? 5 : 0
  const skills = resume.skills.length ? Math.min(10, resume.skills.reduce((n, g) => n + g.items.length, 0)) : 0
  const lengthOk = wc >= 250 && wc <= 850

  return [
    {
      label: "Keyword match",
      score: Math.round(kwPct * 30),
      max: 30,
      note: `${matched.length}/${keywords.length || 0} target keywords found`,
    },
    {
      label: "Priority requirements",
      score: Math.round(priorityPct * 15),
      max: 15,
      note: prioritized.length
        ? `${prioritized.filter((signal) => signal.matched).length}/${prioritized.length} required or preferred signals found`
        : "No explicit required or preferred wording detected",
    },
    {
      label: "Contact info",
      score: Math.round((contact / 3) * 5),
      max: 5,
      note: contact === 3 ? "Complete" : "Add email, phone, and location",
    },
    {
      label: "Summary",
      score: summaryScore,
      max: 10,
      note: summaryScore === 10 ? "Good length" : "Add a 2-3 sentence summary",
    },
    {
      label: "Experience",
      score: Math.min(20, expBase + expBullets + expQuant),
      max: 20,
      note: quantified ? `${bulletCount} bullets, quantified` : `${bulletCount} bullets, add metrics`,
    },
    {
      label: "Skills",
      score: skills,
      max: 10,
      note: skills ? "Present" : "Add a skills section",
    },
    {
      label: "Length & format",
      score: lengthOk ? 10 : wc ? 5 : 0,
      max: 10,
      note: lengthOk ? `${wc} words — good` : `${wc} words — aim for 250-850`,
    },
  ]
}

// ---- Stopwords for keyword extraction ----
const STOP = new Set(
  "a an the and or but for nor so yet of to in on at by with from as is are was were be been being this that these those you your we our they their it its will would can could should must have has had do does did not your you our we us i me my he she them his her into out up down over under above below more most less least very also able strong excellent good great team work working role responsibilities responsibility experience years year months ability including include includes etc using use used candidate candidates position successful required requirement requirements preferred preference minimum qualifications qualification"
    .split(/\s+/),
)

const JOB_PHRASES = [
  "account management", "cloud infrastructure", "content strategy", "cross functional", "customer success",
  "data analysis", "design systems", "financial modeling", "machine learning", "product strategy",
  "project management", "quality assurance", "software development", "stakeholder management", "user research",
]

const REQUIRED_MARKER = /\b(required|must|minimum|need(?:ed)?|you will|responsibilities include)\b/i
const PREFERRED_MARKER = /\b(preferred|nice to have|bonus|ideally|a plus)\b/i

function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tokens(text: string): string[] {
  return normalizeSearchText(text)
    .split(" ")
    .filter((w) => !STOP.has(w) && w.length > 2)
}

// Match complete normalized words/phrases. This prevents false positives such
// as `design` matching `designer` or `product` matching `products`.
export function keywordInText(text: string, keyword: string): boolean {
  const haystack = normalizeSearchText(text)
  const term = normalizeSearchText(keyword)
  if (!haystack || !term) return false
  return ` ${haystack} `.includes(` ${term} `)
}

// Extract candidate job keywords ranked by frequency. Keeping this to
// normalized unigrams makes the offline score explainable and avoids noisy
// punctuation/bigram artifacts such as `designer.` and `designer lead`.
export function extractKeywords(jd: string, limit = 25): string[] {
  const toks = tokens(jd)
  const freq = new Map<string, number>()
  for (const token of toks) freq.set(token, (freq.get(token) || 0) + 1)
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([k]) => k)
    .slice(0, limit)
}

// Pull a small, explainable set of signals from explicit requirement language.
// This is intentionally deterministic: it never guesses credentials or calls a
// remote model, and every returned term is present in the supplied job text.
export function extractJobSignals(jd: string, resumeText = "", limit = 12): JobSignal[] {
  const priorities = new Map<string, JobSignal["priority"]>()
  const add = (term: string, priority: JobSignal["priority"]) => {
    if (!term || priorities.has(term)) return
    priorities.set(term, priority)
  }

  const normalizedJd = normalizeSearchText(jd)
  for (const phrase of JOB_PHRASES) {
    if (keywordInText(normalizedJd, phrase)) add(phrase, "general")
  }

  for (const segment of jd.split(/[\n.!?;]+/)) {
    const priority = REQUIRED_MARKER.test(segment)
      ? "required"
      : PREFERRED_MARKER.test(segment)
        ? "preferred"
        : null
    if (!priority) continue
    const segmentPhrases = JOB_PHRASES.filter((phrase) => keywordInText(segment, phrase))
    const phraseWords = new Set(segmentPhrases.flatMap((phrase) => phrase.split(" ")))
    for (const phrase of segmentPhrases) {
      priorities.delete(phrase)
      priorities.set(phrase, priority)
    }
    for (const term of extractKeywords(segment, 4)) {
      if (!phraseWords.has(term)) add(term, priority)
    }
  }

  for (const term of extractKeywords(jd, limit)) add(term, "general")
  return [...priorities.entries()]
    .sort((a, b) => {
      const rank = { required: 0, preferred: 1, general: 2 }
      return rank[a[1]] - rank[b[1]]
    })
    .slice(0, limit)
    .map(([term, priority]) => ({ term, priority, matched: keywordInText(resumeText, term) }))
}

// ---- Local heuristic analysis (offline fallback / instant feedback) ----
export function analyzeLocally(resume: Resume, jd: string, targetRole = ""): AtsResult {
  const resumeText = resumeToPlainText(resume)
  const keywords = extractKeywords(`${targetRole} ${jd}`)
  const matched: string[] = []
  const missing: string[] = []
  for (const k of keywords) {
    if (keywordInText(resumeText, k)) matched.push(k)
    else missing.push(k)
  }

  const bulletCount = resume.experience.reduce((n, e) => n + e.bullets.filter(Boolean).length, 0)
  const wc = wordCount(resume)
  const sections = buildSectionScores(resume, jd, targetRole)
  const score = Math.max(5, Math.min(100, sections.reduce((sum, section) => sum + section.score, 0)))
  const jobSignals = extractJobSignals(jd, resumeText)

  const suggestions: AtsSuggestion[] = []
  if (missing.length)
    suggestions.push({
      section: "Keywords",
      severity: "high",
      text: `Add or naturally weave in missing terms from the job description: ${missing.slice(0, 8).join(", ")}.`,
    })
  const missingPriority = jobSignals.filter((signal) => signal.priority !== "general" && !signal.matched)
  if (missingPriority.length)
    suggestions.unshift({
      section: "Requirements",
      severity: "high",
      text: `Review these explicitly requested signals and add them only where they reflect your real experience: ${missingPriority.slice(0, 6).map((signal) => signal.term).join(", ")}.`,
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
      ? "Strong local match. Your resume aligns well with this role; review the remaining evidence gaps before applying. This is an estimate, not an employer ATS score."
      : score >= 60
        ? "Promising local match. Address missing job terms and quantify achievements. This is an estimate, not an employer ATS score."
        : "The local check found meaningful keyword or structure gaps. Use the breakdown to improve alignment; this is not an employer ATS score."

  return {
    score,
    matchedKeywords: matched,
    missingKeywords: missing,
    suggestions,
    summary,
    source: "local",
    sections,
    jobSignals,
  }
}

// ---- AI-powered analysis via the Cloudflare Pages Function ----
export async function analyzeWithAI(
  resume: Resume,
  jd: string,
  targetRole = "",
): Promise<AtsResult> {
  const resumeText = resumeToPlainText(resume)
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resumeText, jobDescription: [targetRole, jd].filter(Boolean).join("\n\n"), ...aiClientOverrides() }),
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => "")
    throw new Error(`AI analysis unavailable (${res.status}). ${msg}`)
  }
  const data = (await res.json()) as Partial<AtsResult>
  trackEvent("ai_action_completed")
  return {
    score: clampScore(data.score),
    matchedKeywords: stringList(data.matchedKeywords),
    missingKeywords: stringList(data.missingKeywords),
    suggestions: suggestionList(data.suggestions),
    summary: typeof data.summary === "string" ? data.summary.slice(0, 1000) : "",
    source: "ai",
    sections: buildSectionScores(resume, jd, targetRole),
    jobSignals: extractJobSignals(jd, resumeText),
  }
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()).slice(0, 25)
    : []
}

function suggestionList(value: unknown): AtsSuggestion[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is Partial<AtsSuggestion> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      section: typeof item.section === "string" ? item.section.slice(0, 80) : "General",
      severity: item.severity === "high" || item.severity === "medium" || item.severity === "low" ? item.severity : "low",
      text: typeof item.text === "string" ? item.text.slice(0, 500) : "",
    }))
    .filter((item) => item.text)
    .slice(0, 8)
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
