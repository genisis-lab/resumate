// Cloudflare Pages Function: POST /api/analyze
// Securely proxies an OpenAI-compatible Chat Completions API. The API key lives
// only in server-side environment variables (Pages > Settings > Variables) and
// is never exposed to the browser.
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
    headers: { "Content-Type": "application/json" },
  })
}

// Basic abuse guard: reject cross-origin POSTs so the server-side AI key can't
// be used as an open proxy from other websites. Same-origin app requests send a
// matching Origin/Referer; non-browser callers that omit both are allowed
// through (the key requirement below still gates real usage).
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin") || request.headers.get("Referer")
  if (!origin) return true
  try {
    return new URL(origin).host === new URL(request.url).host
  } catch {
    return false
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  if (!sameOrigin(request)) {
    return new Response("Forbidden", { status: 403 })
  }

  let body: AnalyzeBody
  try {
    body = (await request.json()) as AnalyzeBody
  } catch {
    return new Response("Invalid JSON body", { status: 400 })
  }
  if (!body.resumeText || !body.jobDescription) {
    return new Response("Missing resumeText or jobDescription", { status: 400 })
  }
  if ((body.resumeText.length + body.jobDescription.length) > MAX_CHARS) {
    return new Response("Input too large", { status: 413 })
  }

  // Prefer a visitor-supplied key (BYOK); fall back to the site key.
  const apiKey = body.clientKey || env.AI_API_KEY
  if (!apiKey) {
    // No key available -> tell the client to use its local fallback.
    return new Response("AI not configured", { status: 501 })
  }

  const url = body.clientUrl || env.AI_API_URL || "https://api.openai.com/v1/chat/completions"
  const model = body.clientModel || env.AI_MODEL || "gpt-4o-mini"

  const userPrompt = `JOB DESCRIPTION:\n${body.jobDescription}\n\n---\n\nRESUME:\n${body.resumeText}`

  const upstream = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  })

  if (!upstream.ok) {
    const err = await upstream.text().catch(() => "")
    return new Response(`Upstream AI error: ${err.slice(0, 200)}`, {
      status: 502,
    })
  }

  const data = (await upstream.json()) as any
  const content: string = data?.choices?.[0]?.message?.content ?? "{}"
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return new Response("AI returned malformed JSON", { status: 502 })
  }
  return json(parsed)
}
