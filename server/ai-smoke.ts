import { callAI, HOSTED_MODEL_ALLOWLIST, type HostedModel, type JsonSchema, type WorkersAiSettings } from "./ai-proxy"
import { generateStructured } from "./structured"

// A fixed, fictional sample so the smoke test never touches user data.
const SAMPLE_RESUME = "Riley Chen. Operations Analyst at Northwind Logistics, 2021 to present. Built a Python forecasting model that cut stockouts 22%. Automated weekly reporting in SQL and Tableau, saving 6 hours a week. Skills: Python, SQL, Tableau, Excel, Forecasting."

const SUMMARY_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    skills: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "skills"],
}

export interface SmokeCheck {
  model: HostedModel
  check: "structured" | "plain_text"
  ok: boolean
  latencyMs: number
  preview: string
  error?: string
}

export function smokeModels(requested: unknown, defaults: HostedModel[]): HostedModel[] {
  if (requested === "all") return [...HOSTED_MODEL_ALLOWLIST]
  const match = HOSTED_MODEL_ALLOWLIST.find((model) => model === requested)
  return match ? [match] : [...new Set(defaults)]
}

async function timed(model: HostedModel, check: SmokeCheck["check"], run: () => Promise<{ ok: boolean; preview: string; error?: string }>): Promise<SmokeCheck> {
  const started = Date.now()
  try {
    const result = await run()
    return { model, check, latencyMs: Date.now() - started, ...result }
  } catch (error) {
    return { model, check, ok: false, latencyMs: Date.now() - started, preview: "", error: error instanceof Error ? error.message.slice(0, 200) : "Request failed" }
  }
}

// Runs one structured and one plain-text request per model, in parallel and
// without fallback, so each model is judged on its own output.
export async function runSmokeChecks(binding: Ai, models: HostedModel[]): Promise<SmokeCheck[]> {
  const runs = models.flatMap((model) => {
    const settings: WorkersAiSettings = { kind: "workers-ai", binding, model }
    return [timed(model, "structured", async () => {
      const source = SAMPLE_RESUME.toLowerCase()
      const result = await generateStructured<{ summary: string; skills: string[] }>(settings, {
        messages: [
          { role: "system", content: "Write a three-sentence professional summary from the RESUME and list its skills. Use only facts from the RESUME." },
          { role: "user", content: `RESUME:\n${SAMPLE_RESUME}` },
        ],
        schema: SUMMARY_SCHEMA,
        temperature: 0.3,
        maxTokens: 600,
        validate: (value) => {
          const summary = typeof value.summary === "string" ? value.summary.trim() : ""
          const skills = Array.isArray(value.skills) ? value.skills.filter((skill): skill is string => typeof skill === "string") : []
          if (summary.length < 40) return { invalid: "summary must be at least 40 characters." }
          const invented = skills.filter((skill) => !source.includes(skill.toLowerCase()))
          if (!skills.length || invented.length) return { invalid: `skills must come from the resume${invented.length ? `; not found: ${invented.join(", ")}` : ""}.` }
          return { summary, skills }
        },
      })
      if ("error" in result) return { ok: false, preview: "", error: result.error }
      return { ok: true, preview: `${result.value.summary.slice(0, 220)} [${result.value.skills.join(", ")}]` }
    }), timed(model, "plain_text", async () => {
      const output = await callAI(settings, [
        { role: "system", content: "Write a two-sentence thank-you note after a job interview. Plain text only. Use real names from the details; never use bracketed placeholders." },
        { role: "user", content: "Candidate: Riley Chen. Interviewer: Dana. Role: Senior Operations Analyst. Topic discussed: demand forecasting." },
      ], false, 0.6, undefined, 300)
      const clean = output.trim()
      const ok = clean.length >= 40 && !/\[[^\]]+\]/.test(clean)
      return { ok, preview: clean.slice(0, 220), error: ok ? undefined : "Reply was too short or contained placeholders" }
    })]
  })
  return await Promise.all(runs)
}
