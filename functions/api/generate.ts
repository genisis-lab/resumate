// Cloudflare Pages Function: POST /api/generate
// AI writing helpers used by the editor and analyzer: bullet rewriting, summary
// tailoring, and cover-letter drafting. Shares the same server-side key model as
// /api/analyze (AI_API_KEY / AI_API_URL / AI_MODEL).

interface Env {
  AI_API_KEY?: string
  AI_API_URL?: string
  AI_MODEL?: string
}

type Task = "rewrite" | "summary" | "cover_letter"

interface GenerateBody {
  task: Task
  bullets?: string[]
  role?: string
  company?: string
  resumeText?: string
  jobDescription?: string
  currentSummary?: string
  tone?: string
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

async function callAI(
  env: Env,
  messages: Array<{ role: string; content: string }>,
  jsonMode: boolean,
): Promise<string> {
  const url = env.AI_API_URL || "https://api.openai.com/v1/chat/completions"
  const model = env.AI_MODEL || "gpt-4o-mini"
  const payload: Record<string, unknown> = { model, temperature: 0.4, messages }
  if (jsonMode) payload.response_format = { type: "json_object" }

  const upstream = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.AI_API_KEY}`,
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

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 })
  if (!env.AI_API_KEY) return new Response("AI not configured", { status: 501 })

  let body: GenerateBody
  try {
    body = (await request.json()) as GenerateBody
  } catch {
    return new Response("Invalid JSON body", { status: 400 })
  }
  if (JSON.stringify(body).length > MAX_CHARS) {
    return new Response("Input too large", { status: 413 })
  }

  try {
    if (body.task === "rewrite") {
      const bullets = (body.bullets || []).filter((b) => b && b.trim())
      if (!bullets.length) return new Response("No bullets provided", { status: 400 })
      const ctx = [body.role, body.company].filter(Boolean).join(" at ")
      const sys = `You are an expert resume writer. Rewrite each bullet point to be concise, achievement-oriented, and ATS-friendly. Start each with a strong past-tense action verb, keep any real metrics the user provided, and never fabricate specific numbers. Remove filler and keep each to a single line. Return STRICT JSON: { "bullets": string[] } with exactly the same number of items, in the same order.`
      const intro = ctx ? `Role context: ${ctx}\n` : ""
      const jd = body.jobDescription ? `Target job (for tone and relevant keywords, do not copy verbatim):\n${body.jobDescription}\n\n` : ""
      const list = bullets.map((b, i) => `${i + 1}. ${b}`).join("\n")
      const out = await callAI(
        env,
        [
          { role: "system", content: sys },
          { role: "user", content: `${intro}${jd}Bullets:\n${list}` },
        ],
        true,
      )
      let parsed: any
      try {
        parsed = JSON.parse(out)
      } catch {
        return new Response("AI returned malformed JSON", { status: 502 })
      }
      const result = Array.isArray(parsed?.bullets) ? parsed.bullets.map((x: unknown) => String(x)) : bullets
      return json({ bullets: result })
    }

    if (body.task === "summary") {
      if (!body.resumeText || !body.jobDescription) {
        return new Response("Missing resumeText or jobDescription", { status: 400 })
      }
      const sys = `You are an expert resume writer. Write a tailored 2-3 sentence professional summary that aligns the candidate's real background with the target job. Front-load the strongest match and naturally weave in the most important keywords from the job description. Never invent experience, employers, or metrics that are not in the resume. Return STRICT JSON: { "summary": string }.`
      const user = `TARGET JOB:\n${body.jobDescription}\n\nCURRENT SUMMARY:\n${body.currentSummary || "(none)"}\n\nRESUME:\n${body.resumeText}`
      const out = await callAI(
        env,
        [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        true,
      )
      let parsed: any
      try {
        parsed = JSON.parse(out)
      } catch {
        return new Response("AI returned malformed JSON", { status: 502 })
      }
      return json({ summary: String(parsed?.summary || "") })
    }

    if (body.task === "cover_letter") {
      if (!body.resumeText || !body.jobDescription) {
        return new Response("Missing resumeText or jobDescription", { status: 400 })
      }
      const tone = body.tone || "professional"
      const sys = `You are an expert career writer. Write a compelling, concise cover letter (about 250-350 words, 3-4 short paragraphs) in a ${tone} tone. Ground every claim in the candidate's actual resume and never fabricate experience, employers, or metrics. Connect the candidate's strengths to the target role. Do not include placeholder brackets, a date, or mailing addresses. Begin with "Dear Hiring Manager," and end with a sign-off using the candidate's name. Return plain text only.`
      const user = `TARGET JOB:\n${body.jobDescription}\n\nRESUME:\n${body.resumeText}`
      const out = await callAI(
        env,
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
