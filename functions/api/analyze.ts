import {
  type AiEnv,
  type ClientAiOptions,
  aiSettings,
  callAI,
  enforceAiQuota,
  enforcePostAndOrigin,
  hasOnlyKeys,
  json,
  parseJsonObject,
  readBoundedJson,
  requestError,
  strictString,
  strictStringArray,
  text,
  validString,
  withActionReservation,
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

const ANALYSIS_SCHEMA = {
  type: "object" as const,
  additionalProperties: false as const,
  required: ["score", "matchedKeywords", "missingKeywords", "suggestions", "summary"],
  properties: {
    score: { type: "number", minimum: 0, maximum: 100 },
    matchedKeywords: { type: "array", maxItems: 15, items: { type: "string", maxLength: 120 } },
    missingKeywords: { type: "array", maxItems: 15, items: { type: "string", maxLength: 120 } },
    suggestions: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["section", "severity", "text"],
        properties: {
          section: { type: "string", minLength: 1, maxLength: 80 },
          severity: { type: "string", enum: ["high", "medium", "low"] },
          text: { type: "string", minLength: 1, maxLength: 500 },
        },
      },
    },
    summary: { type: "string", minLength: 1, maxLength: 1_000 },
  },
}

function strictResult(data: Record<string, unknown>) {
  if (!hasOnlyKeys(data, ANALYSIS_SCHEMA.required)) return null
  if (typeof data.score !== "number" || !Number.isFinite(data.score) || data.score < 0 || data.score > 100) return null
  if (!strictStringArray(data.matchedKeywords, 15, 120) || !strictStringArray(data.missingKeywords, 15, 120)) return null
  if (!strictString(data.summary, 1_000) || !Array.isArray(data.suggestions) || data.suggestions.length > 6) return null
  const suggestions = data.suggestions.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return []
    const item = candidate as Record<string, unknown>
    if (!hasOnlyKeys(item, ["section", "severity", "text"])) return []
    if (!strictString(item.section, 80) || !strictString(item.text, 500)) return []
    if (item.severity !== "high" && item.severity !== "medium" && item.severity !== "low") return []
    return [{ section: item.section.trim(), severity: item.severity, text: item.text.trim() }]
  })
  if (suggestions.length !== data.suggestions.length) return null
  return {
    score: Math.round(data.score),
    matchedKeywords: data.matchedKeywords.map((item) => item.trim()),
    missingKeywords: data.missingKeywords.map((item) => item.trim()),
    suggestions,
    summary: data.summary.trim(),
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
    const quota = await enforceAiQuota(request, env, "analyze", Boolean(body.clientKey))
    if (quota instanceof Response) return quota
    return await withActionReservation(quota, async () => {
      const content = await callAI(
        settings,
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `JOB DESCRIPTION:\n${body.jobDescription}\n\n---\n\nRESUME:\n${body.resumeText}` },
        ],
        true,
        0.2,
        ANALYSIS_SCHEMA,
      )
      const parsed = parseJsonObject(content)
      const result = parsed ? strictResult(parsed) : null
      if (!result) return text("AI returned an invalid structured response", 502)
      return json(result)
    })
  } catch (error) {
    return requestError(error)
  }
}

export const onRequest: PagesFunction<AiEnv> = ({ request, env }) => handle(request, env)
