import {
  type AiEnv,
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

interface AnalyzeBody extends ClientAiOptions {
  resumeText: string
  jobDescription: string
}

const SYSTEM_PROMPT = `You are an expert technical recruiter and ATS (Applicant Tracking System) analyst.
Given a candidate's resume text and a target job description, evaluate how well the resume matches.
Return STRICT JSON only (no markdown, no prose) matching this TypeScript type:
{
  "score": number,
  "matchedKeywords": string[],
  "missingKeywords": string[],
  "suggestions": { "section": string, "severity": "high"|"medium"|"low", "text": string }[],
  "summary": string
}
Be specific and actionable. Prioritize the highest-impact changes. Limit keywords to 15 each and suggestions to 6.`

const MAX_CHARS = 24_000

function normalizeResult(value: unknown) {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {}
  const numericScore = typeof data.score === "number" ? data.score : Number(data.score)
  const score = Number.isFinite(numericScore) ? Math.max(0, Math.min(100, Math.round(numericScore))) : 0
  const suggestions = Array.isArray(data.suggestions)
    ? data.suggestions.flatMap((candidate) => {
        if (!candidate || typeof candidate !== "object") return []
        const item = candidate as Record<string, unknown>
        const severity = item.severity === "high" || item.severity === "medium" ? item.severity : "low"
        const suggestion = {
          section: limitedString(item.section, 80) || "General",
          severity,
          text: limitedString(item.text, 500),
        }
        return suggestion.text ? [suggestion] : []
      }).slice(0, 6)
    : []
  return {
    score,
    matchedKeywords: limitedStrings(data.matchedKeywords, 15, 120),
    missingKeywords: limitedStrings(data.missingKeywords, 15, 120),
    suggestions,
    summary: limitedString(data.summary, 1_000),
  }
}

async function handle(request: Request, env: AiEnv): Promise<Response> {
  const blocked = enforcePostAndOrigin(request)
  if (blocked) return blocked

  try {
    const body = await readBoundedJson<AnalyzeBody>(request)
    if (!body || typeof body !== "object") return text("Invalid request body", 400)
    if (!validString(body.resumeText, MAX_CHARS) || !validString(body.jobDescription, MAX_CHARS)
      || !body.resumeText.trim() || !body.jobDescription.trim()) {
      return text("Missing or invalid resumeText or jobDescription", 400)
    }
    if (body.resumeText.length + body.jobDescription.length > MAX_CHARS) return text("Input too large", 413)

    const settings = aiSettings(body, env)
    if (!settings) return text(body.clientKey ? "Unsupported AI provider" : "AI not configured", body.clientKey ? 400 : 501)
    const content = await callAI(
      settings,
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `JOB DESCRIPTION:\n${body.jobDescription}\n\n---\n\nRESUME:\n${body.resumeText}` },
      ],
      true,
      0.2,
    )
    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      return text("AI returned malformed JSON", 502)
    }
    return json(normalizeResult(parsed))
  } catch (error) {
    return requestError(error)
  }
}

export const onRequest: PagesFunction<AiEnv> = ({ request, env }) => handle(request, env)
