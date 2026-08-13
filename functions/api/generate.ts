import {
  type AiEnv,
  type AiSettings,
  type ClientAiOptions,
  aiSettings,
  callAI,
  enforcePostAndOrigin,
  json,
  limitedString,
  limitedStrings,
  readBoundedJson,
  requestError,
  text,
  validString,
} from "../../server/ai-proxy"

type Task =
  | "rewrite"
  | "quantify"
  | "summary"
  | "summary_scratch"
  | "tailor"
  | "proofread"
  | "cover_letter"
  | "interview"
  | "recruiter_email"

const TASKS = new Set<Task>([
  "rewrite",
  "quantify",
  "summary",
  "summary_scratch",
  "tailor",
  "proofread",
  "cover_letter",
  "interview",
  "recruiter_email",
])
const TONES = new Set(["professional", "enthusiastic", "concise", "warm"])
const MAX_CHARS = 24_000

interface GenerateBody extends ClientAiOptions {
  task: Task
  bullets?: string[]
  role?: string
  company?: string
  resumeText?: string
  jobDescription?: string
  currentSummary?: string
  tone?: string
}

function parseJson(output: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(output)
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}

function validateBody(body: GenerateBody): Response | null {
  if (!body || typeof body !== "object") return text("Invalid request body", 400)
  if (typeof body.task !== "string" || !TASKS.has(body.task)) return text("Unknown task", 400)
  if (body.clientKey !== undefined && !validString(body.clientKey, 400)) return text("Invalid clientKey", 400)
  if (body.clientUrl !== undefined && !validString(body.clientUrl, 400)) return text("Invalid clientUrl", 400)
  if (body.clientModel !== undefined && !validString(body.clientModel, 160)) return text("Invalid clientModel", 400)
  if (body.tone !== undefined && (typeof body.tone !== "string" || !TONES.has(body.tone))) return text("Invalid tone", 400)
  if (body.role !== undefined && !validString(body.role, 240)) return text("Invalid role", 400)
  if (body.company !== undefined && !validString(body.company, 240)) return text("Invalid company", 400)
  if (body.currentSummary !== undefined && !validString(body.currentSummary, MAX_CHARS)) return text("Invalid currentSummary", 400)
  if (body.resumeText !== undefined && !validString(body.resumeText, MAX_CHARS)) return text("Invalid resumeText", 400)
  if (body.jobDescription !== undefined && !validString(body.jobDescription, MAX_CHARS)) return text("Invalid jobDescription", 400)
  if (body.bullets !== undefined && (
    !Array.isArray(body.bullets)
    || body.bullets.length > 30
    || body.bullets.some((bullet) => !validString(bullet, 2_000))
  )) return text("Invalid bullets", 400)
  return null
}

async function rewriteBullets(body: GenerateBody, settings: AiSettings): Promise<Response> {
  const bullets = (body.bullets || []).filter((bullet) => bullet.trim())
  if (!bullets.length) return text("No bullets provided", 400)
  const context = [body.role, body.company].filter(Boolean).join(" at ")
  const system = body.task === "quantify"
    ? `You are an expert resume writer. Rewrite each bullet to add a realistic, specific metric or scope ONLY where plausible from the bullet itself. If a bullet cannot be quantified, sharpen its impact wording. Never invent employers or facts. Start with a strong past-tense verb and keep each to one line. Return STRICT JSON: { "bullets": string[] } with the same count and order.`
    : `You are an expert resume writer. Rewrite each bullet to be concise, achievement-oriented, and ATS-friendly. Start with a strong past-tense action verb, retain real metrics, and never fabricate numbers. Return STRICT JSON: { "bullets": string[] } with exactly the same count and order.`
  const introduction = context ? `Role context: ${context}\n` : ""
  const job = body.jobDescription ? `Target job:\n${body.jobDescription}\n\n` : ""
  const output = await callAI(settings, [
    { role: "system", content: system },
    { role: "user", content: `${introduction}${job}Bullets:\n${bullets.map((bullet, index) => `${index + 1}. ${bullet}`).join("\n")}` },
  ], true)
  const parsed = parseJson(output)
  if (!parsed) return text("AI returned malformed JSON", 502)
  const result = limitedStrings(parsed.bullets, bullets.length, 2_000)
  return json({ bullets: result.length === bullets.length ? result : bullets })
}

async function generateSummary(body: GenerateBody, settings: AiSettings): Promise<Response> {
  if (!body.resumeText?.trim()) return text("Missing resumeText", 400)
  const tailored = body.task === "summary"
  if (tailored && !body.jobDescription?.trim()) return text("Missing jobDescription", 400)
  const system = tailored
    ? `You are an expert resume writer. Write a tailored 2-3 sentence professional summary aligned to the target job and grounded only in the resume. Never invent experience, employers, or metrics. Return STRICT JSON: { "summary": string }.`
    : `You are an expert resume writer. Write a concise 2-3 sentence professional summary grounded entirely in the resume. Never invent experience, employers, or metrics. Return STRICT JSON: { "summary": string }.`
  const user = tailored
    ? `TARGET JOB:\n${body.jobDescription}\n\nCURRENT SUMMARY:\n${body.currentSummary || "(none)"}\n\nRESUME:\n${body.resumeText}`
    : `CURRENT SUMMARY:\n${body.currentSummary || "(none)"}\n\nRESUME:\n${body.resumeText}`
  const parsed = parseJson(await callAI(settings, [
    { role: "system", content: system },
    { role: "user", content: user },
  ], true))
  if (!parsed) return text("AI returned malformed JSON", 502)
  return json({ summary: limitedString(parsed.summary, 2_000) })
}

async function tailorResume(body: GenerateBody, settings: AiSettings): Promise<Response> {
  if (!body.resumeText?.trim() || !body.jobDescription?.trim()) return text("Missing resumeText or jobDescription", 400)
  const system = `You are an expert resume coach. Given a resume and target job, produce a tailored 2-3 sentence summary grounded only in the resume, important missing keywords, and concrete high-impact suggestions. Never invent experience or metrics. Return STRICT JSON: { "summary": string, "missingKeywords": string[], "suggestions": string[] }.`
  const parsed = parseJson(await callAI(settings, [
    { role: "system", content: system },
    { role: "user", content: `TARGET JOB:\n${body.jobDescription}\n\nCURRENT SUMMARY:\n${body.currentSummary || "(none)"}\n\nRESUME:\n${body.resumeText}` },
  ], true))
  if (!parsed) return text("AI returned malformed JSON", 502)
  return json({
    summary: limitedString(parsed.summary, 2_000),
    missingKeywords: limitedStrings(parsed.missingKeywords, 12, 120),
    suggestions: limitedStrings(parsed.suggestions, 8, 500),
  })
}

async function proofread(body: GenerateBody, settings: AiSettings): Promise<Response> {
  if (!body.resumeText?.trim()) return text("Missing resumeText", 400)
  const system = `You are a meticulous resume editor. Find concrete grammar, spelling, tense, punctuation, and tone issues. Be specific and quote the problem text. Do not invent content or rewrite the whole resume. Return STRICT JSON: { "issues": string[] } with up to 12 short items.`
  const parsed = parseJson(await callAI(settings, [
    { role: "system", content: system },
    { role: "user", content: `RESUME:\n${body.resumeText}` },
  ], true))
  if (!parsed) return text("AI returned malformed JSON", 502)
  return json({ issues: limitedStrings(parsed.issues, 12, 500) })
}

async function interview(body: GenerateBody, settings: AiSettings): Promise<Response> {
  if (!body.resumeText?.trim() || !body.jobDescription?.trim()) return text("Missing resumeText or jobDescription", 400)
  const system = `You are an experienced interviewer. Generate likely behavioral and role-specific questions based on the resume and target job. Add a one-sentence answer tip grounded in the candidate's actual background. Return STRICT JSON: { "questions": { "question": string, "tip": string }[] } with about 8 items.`
  const parsed = parseJson(await callAI(settings, [
    { role: "system", content: system },
    { role: "user", content: `TARGET JOB:\n${body.jobDescription}\n\nRESUME:\n${body.resumeText}` },
  ], true))
  if (!parsed) return text("AI returned malformed JSON", 502)
  const questions = Array.isArray(parsed.questions)
    ? parsed.questions.flatMap((candidate) => {
        if (!candidate || typeof candidate !== "object") return []
        const item = candidate as Record<string, unknown>
        const question = limitedString(item.question, 500)
        return question ? [{ question, tip: limitedString(item.tip, 500) }] : []
      }).slice(0, 10)
    : []
  return json({ questions })
}

async function plainTextDocument(body: GenerateBody, settings: AiSettings): Promise<Response> {
  if (!body.resumeText?.trim() || !body.jobDescription?.trim()) return text("Missing resumeText or jobDescription", 400)
  const tone = body.tone || "professional"
  const recruiterEmail = body.task === "recruiter_email"
  const system = recruiterEmail
    ? `You are a career coach. Write a short, ${tone} cold outreach email of about 120-160 words. Ground every claim in the resume, highlight the strongest relevant skills, and end with a polite call to action. Include a one-line subject prefixed with "Subject:". Do not fabricate experience. Return plain text only.`
    : `You are an expert career writer. Write a concise 250-350 word cover letter in a ${tone} tone. Ground every claim in the resume and never fabricate experience, employers, or metrics. Do not include placeholders, dates, or mailing addresses. Begin with "Dear Hiring Manager," and end with a sign-off using the candidate's name. Return plain text only.`
  const output = await callAI(settings, [
    { role: "system", content: system },
    { role: "user", content: `TARGET JOB:\n${body.jobDescription}\n\nRESUME:\n${body.resumeText}` },
  ], false)
  return json({ text: limitedString(output, 5_000) })
}

async function handle(request: Request, env: AiEnv): Promise<Response> {
  const blocked = enforcePostAndOrigin(request)
  if (blocked) return blocked
  try {
    const body = await readBoundedJson<GenerateBody>(request)
    const invalid = validateBody(body)
    if (invalid) return invalid
    const settings = aiSettings(body, env)
    if (!settings) return text(body.clientKey ? "Unsupported AI provider" : "AI not configured", body.clientKey ? 400 : 501)

    if (body.task === "rewrite" || body.task === "quantify") return await rewriteBullets(body, settings)
    if (body.task === "summary" || body.task === "summary_scratch") return await generateSummary(body, settings)
    if (body.task === "tailor") return await tailorResume(body, settings)
    if (body.task === "proofread") return await proofread(body, settings)
    if (body.task === "interview") return await interview(body, settings)
    if (body.task === "cover_letter" || body.task === "recruiter_email") return await plainTextDocument(body, settings)
    return text("Unknown task", 400)
  } catch (error) {
    return requestError(error)
  }
}

export const onRequest: PagesFunction<AiEnv> = ({ request, env }) => handle(request, env)
