import { Resume } from "../types/resume"
import { resumeToPlainText } from "./resumeText"

// Thin client for the /api/generate Cloudflare Pages Function. Throws a friendly
// error when AI isn't configured (501) so callers can surface a helpful message.
async function postGenerate<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    if (res.status === 501) {
      throw new Error(
        "AI features aren't enabled on this deployment yet. The site owner needs to add an AI_API_KEY in Cloudflare Pages settings.",
      )
    }
    const msg = await res.text().catch(() => "")
    throw new Error(`AI request failed (${res.status}). ${msg}`.trim())
  }
  return (await res.json()) as T
}

export async function aiRewriteBullets(
  bullets: string[],
  ctx: { role?: string; company?: string; jobDescription?: string } = {},
): Promise<string[]> {
  const data = await postGenerate<{ bullets: string[] }>({
    task: "rewrite",
    bullets,
    role: ctx.role,
    company: ctx.company,
    jobDescription: ctx.jobDescription,
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

export async function aiCoverLetter(
  resume: Resume,
  jobDescription: string,
  tone = "professional",
): Promise<string> {
  const data = await postGenerate<{ text: string }>({
    task: "cover_letter",
    resumeText: resumeToPlainText(resume),
    jobDescription,
    tone,
  })
  return data.text || ""
}
