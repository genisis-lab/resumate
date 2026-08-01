// Client helpers for the AI features. Every call posts to a same-origin
// serverless function (/api/generate or /api/analyze) so a server-held key is
// never exposed. If the visitor has supplied their own key (BYOK), it is sent
// to that same-origin proxy and used only for an allowlisted provider.

import { Resume } from "../types/resume"
import { resumeToPlainText } from "./resumeText"
import { aiClientOverrides } from "./byok"

export interface BulletContext {
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
    if (res.status === 501) throw notEnabledError()
    const msg = await res.text().catch(() => "")
    throw new Error(`AI request failed (${res.status}). ${msg}`.trim())
  }
  return (await res.json()) as T
}

export async function aiRewriteBullets(bullets: string[], ctx: BulletContext = {}): Promise<string[]> {
  const clean = bullets.filter((b) => b && b.trim())
  if (!clean.length) return bullets
  const data = await postGenerate<{ bullets: string[] }>({
    task: "rewrite",
    bullets: clean,
    role: ctx.role,
    company: ctx.company,
    jobDescription: ctx.jobDescription,
  })
  return Array.isArray(data.bullets) && data.bullets.length ? data.bullets : bullets
}

export async function aiQuantifyBullets(bullets: string[], ctx: BulletContext = {}): Promise<string[]> {
  const clean = bullets.filter((b) => b && b.trim())
  if (!clean.length) return bullets
  const data = await postGenerate<{ bullets: string[] }>({
    task: "quantify",
    bullets: clean,
    role: ctx.role,
    company: ctx.company,
  })
  return Array.isArray(data.bullets) && data.bullets.length ? data.bullets : bullets
}

export async function aiTailorSummary(resume: Resume, jobDescription: string): Promise<string> {
  const data = await postGenerate<{ summary: string }>({
    task: "summary",
    resumeText: resumeToPlainText(resume),
    jobDescription,
    currentSummary: resume.summary,
  })
  return data.summary || resume.summary
}

export async function aiGenerateSummary(resume: Resume): Promise<string> {
  const data = await postGenerate<{ summary: string }>({
    task: "summary_scratch",
    resumeText: resumeToPlainText(resume),
    currentSummary: resume.summary,
  })
  return data.summary || resume.summary
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
