// Client helpers for the AI features. Every call posts to a same-origin
// serverless function (/api/generate or /api/analyze) so a server-held key is
// never exposed. If the visitor has supplied their own key (BYOK), it is sent
// to that same-origin proxy and used only for an allowlisted provider.

import { Resume } from "../types/resume"
import { resumeToPlainText } from "./resumeText"
import { aiClientOverrides } from "./byok"
import { trackEvent } from "./analytics"

export interface BulletContext {
  current?: boolean
  role?: string
  company?: string
  jobDescription?: string
}

function notEnabledError(): Error {
  return new Error(
    "AI features aren't enabled yet. Add your own free API key in Settings, or set AI_API_KEY in Cloudflare Pages.",
  )
}

async function postGenerate<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, ...aiClientOverrides() }),
  })
  if (!res.ok) {
    const messages: Record<number, string> = {
      400: "Add meaningful resume details before using AI.",
      401: "Sign in to use hosted AI, or check your provider key in Settings.",
      403: "This AI action requires an eligible plan or a valid provider key.",
      413: "This request is too long. Try fewer bullets at a time.",
      429: "Your AI allowance or rate limit has been reached. Try again later or check your plan.",
    }
    if (res.status === 501) throw notEnabledError()
    throw new Error(messages[res.status] || "AI is temporarily unavailable. Your content has not changed. Please try again.")
  }
  if (!res.headers.get('content-type')?.includes('application/json')) throw new Error('AI returned an unexpected response. Please try again later.')
  let data: T
  try { data = await res.json() as T } catch { throw new Error('AI returned an unreadable response. Please try again.') }
  if (!data || typeof data !== 'object') throw new Error('AI returned an invalid response. Please try again.')
  trackEvent("ai_action_completed")
  return data
}

export async function aiRewriteBullets(bullets: string[], ctx: BulletContext = {}): Promise<string[]> {
  const clean = bullets.filter((b) => b && b.trim())
  if (!clean.length) return bullets
  const data = await postGenerate<{ bullets: string[] }>({
    task: "rewrite",
    bullets: clean,
    current: ctx.current,
    role: ctx.role,
    company: ctx.company,
    jobDescription: ctx.jobDescription,
  })
  if (!Array.isArray(data.bullets) || data.bullets.length !== clean.length || data.bullets.some(b => typeof b !== 'string' || !b.trim() || /<\/?[a-z][^>]*>/i.test(b))) throw new Error('AI returned invalid bullet text. Your content has not changed.')
  return data.bullets
}

export async function aiQuantifyBullets(bullets: string[], ctx: BulletContext = {}): Promise<string[]> {
  const clean = bullets.filter((b) => b && b.trim())
  if (!clean.length) return bullets
  const data = await postGenerate<{ bullets: string[] }>({
    task: "quantify",
    bullets: clean,
    current: ctx.current,
    role: ctx.role,
    company: ctx.company,
  })
  if (!Array.isArray(data.bullets) || data.bullets.length !== clean.length || data.bullets.some(b => typeof b !== 'string' || !b.trim() || /<\/?[a-z][^>]*>/i.test(b))) throw new Error('AI returned invalid bullet text. Your content has not changed.')
  return data.bullets
}

export async function aiTailorSummary(resume: Resume, jobDescription: string): Promise<string> {
  const data = await postGenerate<{ summary: string }>({
    task: "summary",
    resumeText: resumeToPlainText(resume),
    jobDescription,
    currentSummary: resume.summary,
  })
  if (typeof data.summary !== 'string' || !data.summary.trim() || /<\/?[a-z][^>]*>/i.test(data.summary)) throw new Error('AI returned invalid summary text. Your content has not changed.')
  return data.summary
}

export function hasSummaryContext(resume: Resume): boolean {
  return Boolean(resume.summary.trim() || resume.experience.some(e => e.bullets.some(b => b.trim())) || resume.projects.some(p => p.description.trim() || p.bullets.some(b => b.trim())) || resume.skills.some(g => g.items.some(s => s.trim())) || resume.education.some(e => e.degree.trim() || e.field.trim()))
}

export async function aiGenerateSummary(resume: Resume): Promise<string> {
  if (!hasSummaryContext(resume)) throw new Error('Add experience, skills, education, or project details before writing a summary with AI.')
  const data = await postGenerate<{ summary: string }>({
    task: "summary_scratch",
    resumeText: resumeToPlainText(resume),
    currentSummary: resume.summary,
  })
  if (typeof data.summary !== 'string' || !data.summary.trim() || /<\/?[a-z][^>]*>/i.test(data.summary)) throw new Error('AI returned invalid summary text. Your content has not changed.')
  return data.summary
}

export interface TailorResult {
  summary: string
  missingKeywords: string[]
  suggestions: string[]
}

export async function aiTailorResume(resume: Resume, jobDescription: string): Promise<TailorResult> {
  const data = await postGenerate<Partial<TailorResult>>({
    task: "tailor",
    resumeText: resumeToPlainText(resume),
    jobDescription,
    currentSummary: resume.summary,
  })
  return {
    summary: data.summary || resume.summary,
    missingKeywords: Array.isArray(data.missingKeywords) ? data.missingKeywords : [],
    suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
  }
}

export async function aiProofread(resume: Resume): Promise<string[]> {
  const data = await postGenerate<{ issues: string[] }>({
    task: "proofread",
    resumeText: resumeToPlainText(resume),
  })
  return Array.isArray(data.issues) ? data.issues : []
}

export async function aiCoverLetter(resume: Resume, jobDescription: string, tone = "professional"): Promise<string> {
  const data = await postGenerate<{ text: string }>({
    task: "cover_letter",
    resumeText: resumeToPlainText(resume),
    jobDescription,
    tone,
  })
  return data.text || ""
}

export interface InterviewQuestion {
  question: string
  tip: string
}

export async function aiInterviewQuestions(resume: Resume, jobDescription: string): Promise<InterviewQuestion[]> {
  const data = await postGenerate<{ questions: InterviewQuestion[] }>({
    task: "interview",
    resumeText: resumeToPlainText(resume),
    jobDescription,
  })
  return Array.isArray(data.questions) ? data.questions : []
}

export async function aiRecruiterEmail(resume: Resume, jobDescription: string, tone = "professional"): Promise<string> {
  const data = await postGenerate<{ text: string }>({
    task: "recruiter_email",
    resumeText: resumeToPlainText(resume),
    jobDescription,
    tone,
  })
  return data.text || ""
}

export type CoachMode = 'rewrite' | 'grammar' | 'role' | 'evidence' | 'practice' | 'consistency'
export interface CoachResult { items: { original: string; suggestion: string; reason: string; category: string }[]; followUp: string }
export async function aiCoach(mode: CoachMode, source: string, job = '', context = ''): Promise<CoachResult> {
  if (!source.trim()) throw new Error('Add details before requesting coaching.')
  if (mode === 'evidence' && !job.trim()) throw new Error('Paste the target job description first.')
  const result = await postGenerate<CoachResult>({ task: 'coach', mode, resumeText: source, jobDescription: job, context })
  if (!Array.isArray(result.items) || typeof result.followUp !== 'string' || result.items.some(item => !item || ['original', 'suggestion', 'reason', 'category'].some(key => typeof item[key as keyof typeof item] !== 'string'))) throw new Error('AI returned invalid coaching feedback.')
  return result
}
