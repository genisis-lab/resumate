// Cloudflare Pages Function: POST /api/generate
// AI writing helpers used across the app. Uses the site-held key (AI_API_KEY /
// AI_API_URL / AI_MODEL) by default, OR a visitor-supplied key passed in the
// request body (clientKey / clientUrl / clientModel) for Bring-Your-Own-Key.

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
    headers: { "Content-Type": "application/json" },
  })
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin") || request.headers.get("Referer")
  if (!origin) return true
  try {
    return new URL(origin).host === new URL(request.url).host
  } catch {
    return false
  }
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
    const err = await upstream.text().catch(() => "")
    throw new Error(`Upstream AI error ${upstream.status}: ${err.slice(0, 200)}`)
  }
  const data = (await upstream.json()) as any
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

  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 })

  let body: GenerateBody
  try {
    body = (await request.json()) as GenerateBody
  } catch {
    return new Response("Invalid JSON body", { status: 400 })
  }
  if (JSON.stringify(body).length > MAX_CHARS) {
    return new Response("Input too large", { status: 413 })
  }

  const key = body.clientKey || env.AI_API_KEY
  if (!key) return new Response("AI not configured", { status: 501 })
  const settings: AiSettings = {
    key,
    url: body.clientUrl || env.AI_API_URL || "https://api.openai.com/v1/chat/completions",
    model: body.clientModel || env.AI_MODEL || "gpt-4o-mini",
  }

  try {
    if (body.task === "rewrite" || body.task === "quantify") {
      const bullets = (body.bullets || []).filter((b) => b && b.trim())
      if (!bullets.length) return new Response("No bullets provided", { status: 400 })
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
      if (!parsed) return new Response("AI returned malformed JSON", { status: 502 })
      const result = Array.isArray(parsed?.bullets) ? parsed.bullets.map((x: unknown) => String(x)) : bullets
      return json({ bullets: result })
    }

    if (body.task === "summary" || body.task === "summary_scratch") {
      if (!body.resumeText) return new Response("Missing resumeText", { status: 400 })
      const withJd = body.task === "summary"
      if (withJd && !body.jobDescription) return new Response("Missing jobDescription", { status: 400 })
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
      if (!parsed) return new Response("AI returned malformed JSON", { status: 502 })
      return json({ summary: String(parsed?.summary || "") })
    }

    if (body.task === "tailor") {
      if (!body.resumeText || !body.jobDescription) {
        return new Response("Missing resumeText or jobDescription", { status: 400 })
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
      if (!parsed) return new Response("AI returned malformed JSON", { status: 502 })
      return json({
        summary: String(parsed?.summary || ""),
        missingKeywords: Array.isArray(parsed?.missingKeywords) ? parsed.missingKeywords.map((x: unknown) => String(x)) : [],
        suggestions: Array.isArray(parsed?.suggestions) ? parsed.suggestions.map((x: unknown) => String(x)) : [],
      })
    }

    if (body.task === "proofread") {
      if (!body.resumeText) return new Response("Missing resumeText", { status: 400 })
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
      if (!parsed) return new Response("AI returned malformed JSON", { status: 502 })
      return json({ issues: Array.isArray(parsed?.issues) ? parsed.issues.map((x: unknown) => String(x)) : [] })
    }

    if (body.task === "interview") {
      if (!body.resumeText || !body.jobDescription) {
        return new Response("Missing resumeText or jobDescription", { status: 400 })
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
      if (!parsed) return new Response("AI returned malformed JSON", { status: 502 })
      const raw = Array.isArray(parsed?.questions) ? parsed.questions : []
      const questions = raw.map((q: any) => ({ question: String(q?.question || ""), tip: String(q?.tip || "") })).filter((q: any) => q.question)
      return json({ questions })
    }

    if (body.task === "recruiter_email") {
      if (!body.resumeText || !body.jobDescription) {
        return new Response("Missing resumeText or jobDescription", { status: 400 })
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
        return new Response("Missing resumeText or jobDescription", { status: 400 })
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

    return new Response("Unknown task", { status: 400 })
  } catch (e) {
    return new Response(`AI error: ${e instanceof Error ? e.message : "unknown"}`, { status: 502 })
  }
}
