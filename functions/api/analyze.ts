// Cloudflare Pages Function: POST /api/analyze
// Securely proxies an OpenAI-compatible Chat Completions API. The site key lives
// only in server-side environment variables; optional BYOK keys are validated
// and forwarded only to the supported provider selected by the visitor.
//
// Configure these environment variables in your Cloudflare Pages project:
//   AI_API_KEY   (required, encrypted)  e.g. sk-...
//   AI_API_URL   (optional)  default: https://api.openai.com/v1/chat/completions
//   AI_MODEL     (optional)  default: gpt-4o-mini

interface Env {
  AI_API_KEY?: string
  AI_API_URL?: string
  AI_MODEL?: string
}

interface AnalyzeBody {
  resumeText: string
  jobDescription: string
  clientKey?: string
  clientUrl?: string
  clientModel?: string
}

const SYSTEM_PROMPT = `You are an expert technical recruiter and ATS (Applicant Tracking System) analyst.
Given a candidate's resume text and a target job description, evaluate how well the resume matches.
Return STRICT JSON only (no markdown, no prose) matching this TypeScript type:
{
  "score": number,                 // 0-100 overall ATS match
  "matchedKeywords": string[],     // important JD keywords found in the resume
  "missingKeywords": string[],     // important JD keywords absent from the resume
  "suggestions": { "section": string, "severity": "high"|"medium"|"low", "text": string }[],
  "summary": string                // 1-2 sentence overall assessment
}
Be specific and actionable. Prioritize the highest-impact changes. Limit keywords to ~15 each and suggestions to ~6.`

// Hard cap on combined input size to limit abuse / runaway cost.
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

// Reject cross-origin POSTs so the server-side AI key cannot be used as an
// open proxy from another website. Requests that omit both headers are also
// rejected; browser requests from this app include one of them.
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

function clientSettings(body: AnalyzeBody, env: Env): { key: string; url: string; model: string } | null {
  const clientKey = typeof body.clientKey === "string" ? body.clientKey.trim() : ""
  const defaultUrl = env.AI_API_URL || "https://api.openai.com/v1/chat/completions"
  const defaultModel = env.AI_MODEL || "gpt-4o-mini"

  // A visitor key is accepted only for a known HTTPS provider. Never let a
  // request using the site key redirect that secret to a client URL.
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

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  if (!sameOrigin(request)) {
    return text("Forbidden", 403)
  }
  const retryAfter = rateLimit(request)
  if (retryAfter !== null) {
    return new Response("Too many requests", {
      status: 429,
      headers: { "Cache-Control": "no-store", "Retry-After": String(retryAfter) },
    })
  }

  let body: AnalyzeBody
  try {
    body = (await request.json()) as AnalyzeBody
  } catch {
    return text("Invalid JSON body", 400)
  }
  if (!body || typeof body !== "object") return text("Invalid request body", 400)
  if (!validString(body.resumeText, MAX_CHARS) || !validString(body.jobDescription, MAX_CHARS) || !body.resumeText.trim() || !body.jobDescription.trim()) {
    return text("Missing or invalid resumeText or jobDescription", 400)
  }
  if (body.clientKey !== undefined && !validString(body.clientKey, 400)) return text("Invalid clientKey", 400)
  if (body.clientUrl !== undefined && !validString(body.clientUrl, 400)) return text("Invalid clientUrl", 400)
  if (body.clientModel !== undefined && !validString(body.clientModel, 200)) return text("Invalid clientModel", 400)
  if ((body.resumeText.length + body.jobDescription.length) > MAX_CHARS) {
    return text("Input too large", 413)
  }

  const settings = clientSettings(body, env)
  if (!settings) {
    // No key available -> tell the client to use its local fallback.
    return text(body.clientKey ? "Unsupported AI provider" : "AI not configured", body.clientKey ? 400 : 501)
  }

  const userPrompt = `JOB DESCRIPTION:\n${body.jobDescription}\n\n---\n\nRESUME:\n${body.resumeText}`

  let upstream: Response
  try {
    upstream = await fetch(settings.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.key}`,
      },
      body: JSON.stringify({
        model: settings.model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    })
  } catch {
    return text("AI provider request failed", 502)
  }

  if (!upstream.ok) {
    return text("AI provider request failed", 502)
  }

  let data: any
  try {
    data = await upstream.json()
  } catch {
    return text("AI provider returned invalid JSON", 502)
  }
  const content: string = data?.choices?.[0]?.message?.content ?? "{}"
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return text("AI returned malformed JSON", 502)
  }
  return json(parsed)
}
