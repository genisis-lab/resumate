// Cloudflare Pages Function: POST /api/generate
// AI writing helpers used across the app. Uses the site-held key (AI_API_KEY /
// AI_API_URL / AI_MODEL) by default, or a validated visitor-supplied key and
// supported provider for Bring-Your-Own-Key.

interface Env {
  AI_API_KEY?: string
  AI_API_URL?: string
  AI_MODEL?: string
}

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

const TASKS: Task[] = [
  "rewrite",
  "quantify",
  "summary",
  "summary_scratch",
  "tailor",
  "proofread",
  "cover_letter",
  "interview",
  "recruiter_email",
]

interface GenerateBody {
  task: Task
  bullets?: string[]
  role?: string
  company?: string
  resumeText?: string
  jobDescription?: string
  currentSummary?: string
  tone?: string
  clientKey?: string
  clientUrl?: string
  clientModel?: string
}

const MAX_CHARS = 24000

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

function text(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  })
}

function sameOrigin(request: Request): boolean {
  const source = request.headers.get("Origin") || request.headers.get("Referer")
  if (!source) return false
  try {
    const actual = new URL(request.url)
    const claimed = new URL(source)
    return claimed.protocol === actual.protocol && claimed.host === actual.host
  } catch {
    return false
  }
}

const ALLOWED_PROVIDER_HOSTS = new Set([
  "api.openai.com",
  "api.groq.com",
  "openrouter.ai",
  "api.openrouter.ai",
  "generativelanguage.googleapis.com",
  "api.deepseek.com",
])

const RATE_LIMIT = 30
const RATE_WINDOW_MS = 60_000
const rateBuckets = new Map<string, { count: number; resetAt: number }>()

function rateLimit(request: Request): number | null {
  const key = request.headers.get("CF-Connecting-IP") || "unknown"
  const now = Date.now()
  const current = rateBuckets.get(key)
  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return null
  }
  if (current.count >= RATE_LIMIT) return Math.max(1, Math.ceil((current.resetAt - now) / 1000))
  current.count += 1
  return null
}

function validString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length <= max
}

function clientSettings(body: GenerateBody, env: Env): AiSettings | null {
  const clientKey = typeof body.clientKey === "string" ? body.clientKey.trim() : ""
  const defaultUrl = env.AI_API_URL || "https://api.openai.com/v1/chat/completions"
  const defaultModel = env.AI_MODEL || "gpt-4o-mini"

  // A visitor key may only target a known HTTPS provider. The site key never
  // follows a URL supplied by the browser.
  if (clientKey) {
    const clientUrl = typeof body.clientUrl === "string" && body.clientUrl.trim()
      ? body.clientUrl.trim()
      : "https://api.openai.com/v1/chat/completions"
    try {
      const parsed = new URL(clientUrl)
      if (parsed.protocol !== "https:" || !ALLOWED_PROVIDER_HOSTS.has(parsed.hostname)) return null
    } catch {
      return null
    }
    return {
      key: clientKey,
      url: clientUrl,
      model: typeof body.clientModel === "string" && body.clientModel.trim() ? body.clientModel.trim() : defaultModel,
    }
  }

  if (!env.AI_API_KEY) return null
  return { key: env.AI_API_KEY, url: defaultUrl, model: defaultModel }
}

interface AiSettings {
  key: string
  url: string
  model: string
}

async function callAI(
  s: AiSettings,
  messages: Array<{ role: string; content: string }>,
  jsonMode: boolean,
): Promise<string> {
  const payload: Record<string, unknown> = { model: s.model, temperature: 0.4, messages }
  if (jsonMode) payload.response_format = { type: "json_object" }
  const upstream = await fetch(s.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${s.key}`,
    },
    body: JSON.stringify(payload),
  })
  if (!upstream.ok) {
    throw new Error("AI provider request failed")
  }
  const data = (await upstream.json().catch(() => null)) as any
  if (!data) throw new Error("AI provider returned invalid JSON")
  return data?.choices?.[0]?.message?.content ?? ""
}

function parseJson(out: string): any {
  try {
    return JSON.parse(out)
  } catch {
    return null
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  if (!sameOrigin(request)) return text("Forbidden", 403)
  const retryAfter = rateLimit(request)
  if (retryAfter !== null) {
    return new Response("Too many requests", {
      status: 429,
      headers: { "Cache-Control": "no-store", "Retry-After": String(retryAfter) },
    })
  }

  let body: GenerateBody
  try {
    body = (await request.json()) as GenerateBody
  } catch {
    return text("Invalid JSON body", 400)
  }
  if (!body || typeof body !== "object") return text("Invalid request body", 400)
  const serialized = JSON.stringify(body)
  if (!serialized || serialized.length > MAX_CHARS) {
    return text("Input too large", 413)
  }
  if (typeof body.task !== "string" || !TASKS.includes(body.task)) return text("Unknown task", 400)
  if (body.clientKey !== undefined && !validString(body.clientKey, 400)) return text("Invalid clientKey", 400)
  if (body.clientUrl !== undefined && !validString(body.clientUrl, 400)) return text("Invalid clientUrl", 400)
  if (body.clientModel !== undefined && !validString(body.clientModel, 200)) return text("Invalid clientModel", 400)
  if (body.tone !== undefined && !validString(body.tone, 80)) return text("Invalid tone", 400)
  if (body.role !== undefined && !validString(body.role, 240)) return text("Invalid role", 400)
  if (body.company !== undefined && !validString(body.company, 240)) return text("Invalid company", 400)
  if (body.currentSummary !== undefined && !validString(body.currentSummary, MAX_CHARS)) return text("Invalid currentSummary", 400)
  if (body.resumeText !== undefined && !validString(body.resumeText, MAX_CHARS)) return text("Invalid resumeText", 400)
  if (body.jobDescription !== undefined && !validString(body.jobDescription, MAX_CHARS)) return text("Invalid jobDescription", 400)
  if (body.bullets !== undefined && (!Array.isArray(body.bullets) || body.bullets.some((b) => !validString(b, 2000)))) {
    return text("Invalid bullets", 400)
  }

  const settings = clientSettings(body, env)
  if (!settings) return text(body.clientKey ? "Unsupported AI provider" : "AI not configured", body.clientKey ? 400 : 501)

  try {
    if (body.task === "rewrite" || body.task === "quantify") {
      const bullets = (body.bullets || []).filter((b) => b && b.trim())
      if (!bullets.length) return text("No bullets provided", 400)
      const ctx = [body.role, body.company].filter(Boolean).join(" at ")
      const sys =
        body.task === "quantify"
          ? `You are an expert resume writer. Rewrite each bullet to add a realistic, specific metric or scope (numbers, %, time, scale, volume) ONLY where it is plausible from the bullet itself. If a bullet truly cannot be quantified, sharpen the impact wording instead. Never invent employers or facts. Start each with a strong past-tense verb, keep to one line. Return STRICT JSON: { "bullets": string[] } with the same count and order.`
          : `You are an expert resume writer. Rewrite each bullet point to be concise, achievement-oriented, and ATS-friendly. Start each with a strong past-tense action verb, keep any real metrics the user provided, and never fabricate specific numbers. Remove filler and keep each to a single line. Return STRICT JSON: { "bullets": string[] } with exactly the same number of items, in the same order.`
      const intro = ctx ? `Role context: ${ctx}\n` : ""
      const jd = body.jobDescription
        ? `Target job (for tone and relevant keywords, do not copy verbatim):\n${body.jobDescription}\n\n`
        : ""
      const list = bullets.map((b, i) => `${i + 1}. ${b}`).join("\n")
      const out = await callAI(
        settings,
        [
          { role: "system", content: sys },
          { role: "user", content: `${intro}${jd}Bullets:\n${list}` },
        ],
        true,
      )
      const parsed = parseJson(out)
      if (!parsed) return text("AI returned malformed JSON", 502)
      const result = Array.isArray(parsed?.bullets) ? parsed.bullets.map((x: unknown) => String(x)) : bullets
      return json({ bullets: result })
    }

    if (body.task === "summary" || body.task === "summary_scratch") {
      if (!body.resumeText?.trim()) return text("Missing resumeText", 400)
      const withJd = body.task === "summary"
      if (withJd && !body.jobDescription?.trim()) return text("Missing jobDescription", 400)
      const sys = withJd
        ? `You are an expert resume writer. Write a tailored 2-3 sentence professional summary that aligns the candidate's real background with the target job. Front-load the strongest match and naturally weave in the most important keywords from the job description. Never invent experience, employers, or metrics that are not in the resume. Return STRICT JSON: { "summary": string }.`
        : `You are an expert resume writer. Write a strong, concise 2-3 sentence professional summary grounded entirely in the candidate's resume. Lead with their strongest, most marketable strengths and years of experience. Never invent experience, employers, or metrics. Return STRICT JSON: { "summary": string }.`
      const user = withJd
        ? `TARGET JOB:\n${body.jobDescription}\n\nCURRENT SUMMARY:\n${body.currentSummary || "(none)"}\n\nRESUME:\n${body.resumeText}`
        : `CURRENT SUMMARY:\n${body.currentSummary || "(none)"}\n\nRESUME:\n${body.resumeText}`
      const out = await callAI(
        settings,
        [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        true,
      )
      const parsed = parseJson(out)
      if (!parsed) return text("AI returned malformed JSON", 502)
      return json({ summary: String(parsed?.summary || "") })
    }

    if (body.task === "tailor") {
      if (!body.resumeText || !body.jobDescription) {
        return text("Missing resumeText or jobDescription", 400)
      }
      const sys = `You are an expert resume coach. Given a resume and a target job, produce: (1) a tailored 2-3 sentence summary grounded only in the resume, (2) the most important keywords/skills from the job that are MISSING from the resume, and (3) concrete, high-impact tailoring suggestions. Never invent experience or metrics. Return STRICT JSON: { "summary": string, "missingKeywords": string[], "suggestions": string[] }. Limit each list to about 8 items.`
      const user = `TARGET JOB:\n${body.jobDescription}\n\nCURRENT SUMMARY:\n${body.currentSummary || "(none)"}\n\nRESUME:\n${body.resumeText}`
      const out = await callAI(
        settings,
        [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        true,
      )
      const parsed = parseJson(out)
      if (!parsed) return text("AI returned malformed JSON", 502)
      return json({
        summary: String(parsed?.summary || ""),
        missingKeywords: Array.isArray(parsed?.missingKeywords) ? parsed.missingKeywords.map((x: unknown) => String(x)) : [],
        suggestions: Array.isArray(parsed?.suggestions) ? parsed.suggestions.map((x: unknown) => String(x)) : [],
      })
    }

    if (body.task === "proofread") {
      if (!body.resumeText?.trim()) return text("Missing resumeText", 400)
      const sys = `You are a meticulous resume editor. Find concrete grammar, spelling, tense-consistency, punctuation, and tone issues. Be specific and quote the problem text. Do not invent content or rewrite the whole resume. Return STRICT JSON: { "issues": string[] } with up to 12 short, actionable items. If the resume is clean, return an empty array.`
      const out = await callAI(
        settings,
        [
          { role: "system", content: sys },
          { role: "user", content: `RESUME:\n${body.resumeText}` },
        ],
        true,
      )
      const parsed = parseJson(out)
      if (!parsed) return text("AI returned malformed JSON", 502)
      return json({ issues: Array.isArray(parsed?.issues) ? parsed.issues.map((x: unknown) => String(x)) : [] })
    }

    if (body.task === "interview") {
      if (!body.resumeText || !body.jobDescription) {
        return text("Missing resumeText or jobDescription", 400)
      }
      const sys = `You are an experienced interviewer. Based on the candidate's resume and the target job, generate likely interview questions — a mix of behavioral and role-specific technical questions. For each, add a one-sentence tip on how this candidate should answer, referencing their actual background. Return STRICT JSON: { "questions": { "question": string, "tip": string }[] } with about 8 items.`
      const user = `TARGET JOB:\n${body.jobDescription}\n\nRESUME:\n${body.resumeText}`
      const out = await callAI(
        settings,
        [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        true,
      )
      const parsed = parseJson(out)
      if (!parsed) return text("AI returned malformed JSON", 502)
      const raw = Array.isArray(parsed?.questions) ? parsed.questions : []
      const questions = raw.map((q: any) => ({ question: String(q?.question || ""), tip: String(q?.tip || "") })).filter((q: any) => q.question)
      return json({ questions })
    }

    if (body.task === "recruiter_email") {
      if (!body.resumeText || !body.jobDescription) {
        return text("Missing resumeText or jobDescription", 400)
      }
      const tone = body.tone || "professional"
      const sys = `You are a career coach. Write a short, ${tone} cold outreach email (about 120-160 words) the candidate can send to a recruiter or hiring manager about the target role. Ground every claim in the resume, highlight 2-3 of the most relevant strengths, and end with a clear, polite call to action. Include a one-line subject prefixed with "Subject:". Do not fabricate experience. Return plain text only.`
      const user = `TARGET JOB:\n${body.jobDescription}\n\nRESUME:\n${body.resumeText}`
      const out = await callAI(
        settings,
        [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        false,
      )
      return json({ text: out.trim() })
    }

    if (body.task === "cover_letter") {
      if (!body.resumeText || !body.jobDescription) {
        return text("Missing resumeText or jobDescription", 400)
      }
      const tone = body.tone || "professional"
      const sys = `You are an expert career writer. Write a compelling, concise cover letter (about 250-350 words, 3-4 short paragraphs) in a ${tone} tone. Ground every claim in the candidate's actual resume and never fabricate experience, employers, or metrics. Connect the candidate's strengths to the target role. Do not include placeholder brackets, a date, or mailing addresses. Begin with "Dear Hiring Manager," and end with a sign-off using the candidate's name. Return plain text only.`
      const user = `TARGET JOB:\n${body.jobDescription}\n\nRESUME:\n${body.resumeText}`
      const out = await callAI(
        settings,
        [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        false,
      )
      return json({ text: out.trim() })
    }

    return text("Unknown task", 400)
  } catch (e) {
    return text(e instanceof Error ? e.message : "AI request failed", 502)
  }
}
