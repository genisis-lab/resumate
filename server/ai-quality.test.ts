import { beforeEach, describe, expect, it, vi } from "vitest"

import { onRequest as analyze } from "../functions/api/analyze"
import { onRequest as generate } from "../functions/api/generate"
import { cleanModelText, parseJsonObject } from "./ai-proxy"

function quotaDb() {
  const writes: Array<{ sql: string; values: unknown[] }> = []
  return {
    writes,
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn((...values: unknown[]) => ({
        first: vi.fn(async () => {
          if (sql.includes("FROM sessions")) return { id: "user-1", email: "owner@example.com", plan: "pro", emailVerifiedAt: Date.now() }
          if (sql.includes("INSERT INTO ai_action_reservations")) return { used: 1 }
          return { attempts: 1, windowStartedAt: Date.now() }
        }),
        run: vi.fn(async () => {
          writes.push({ sql, values })
          return { success: true }
        }),
      })),
    })),
  }
}

function request(body: unknown, path = "/api/generate") {
  return new Request(`https://resume.builtwai.com${path}`, {
    method: "POST",
    headers: {
      "CF-Connecting-IP": crypto.randomUUID(),
      "Content-Type": "application/json",
      Cookie: "__Host-resumate_session=test-session",
      Origin: "https://resume.builtwai.com",
    },
    body: JSON.stringify(body),
  })
}

function workersEnv(...responses: unknown[]) {
  const queue = [...responses]
  const run = vi.fn(async () => ({ response: queue.length > 1 ? queue.shift() : queue[0] }))
  return { env: { AI: { run }, DB: quotaDb() }, run }
}

const RESUME = "Jordan Avery. Senior Product Designer at Brightwave. Skills: Figma, Prototyping, Design Systems, Accessibility. Led onboarding redesign that raised activation 38%."
const JOB = "We are hiring a Senior Product Designer. Required: 5+ years with Figma and design systems, strong accessibility practice, and stakeholder communication. Nice to have: motion design."

async function call(handler: typeof generate, body: unknown, env: unknown, path?: string) {
  return await handler({ request: request(body, path), env } as never)
}

beforeEach(() => vi.unstubAllGlobals())

describe("model output cleanup", () => {
  it("strips reasoning blocks and code fences before parsing", () => {
    expect(cleanModelText("<think>plan the answer</think>\n```json\n{\"a\":1}\n```")).toBe('{"a":1}')
    expect(parseJsonObject('Here you go:\n{"summary":"ok"}\nThanks')).toEqual({ summary: "ok" })
    expect(parseJsonObject("<think>never finished")).toBeNull()
  })
})

describe("hosted Workers AI requests", () => {
  it("sends writing tasks to gpt-oss-120b with low reasoning effort and the schema in the developer prompt", async () => {
    const { env, run } = workersEnv({ summary: "Senior product designer who ships accessible design systems." })
    const response = await call(generate, { task: "summary_scratch", resumeText: RESUME }, env)
    expect(response.status).toBe(200)
    const [model, input] = run.mock.calls[0] as unknown as [string, { input: { role: string; content: string }[]; reasoning: { effort: string } }]
    expect(model).toBe("@cf/openai/gpt-oss-120b")
    expect(input.reasoning.effort).toBe("low")
    expect(input.input[0].role).toBe("developer")
    expect(input.input[0].content).toContain('"summary"')
    expect(input.input[0].content).not.toContain("/no_think")
  })

  it("keeps extraction tasks on Qwen3 with thinking turned off", async () => {
    const { env, run } = workersEnv({ summary: "Own product design.", seniority: "Senior", mustHaves: ["Figma"], niceToHaves: [], responsibilities: [], keywords: ["Figma"], watchOuts: [], questionsToAsk: [] })
    const response = await call(generate, { task: "job_decode", jobDescription: JOB }, env)
    expect(response.status).toBe(200)
    const [model, input] = run.mock.calls[0] as unknown as [string, { messages: { role: string; content: string }[]; response_format: unknown }]
    expect(model).toBe("@cf/qwen/qwen3-30b-a3b-fp8")
    expect(input.messages[0].content).toContain("/no_think")
    expect(input.response_format).toEqual({ type: "json_object" })
  })

  it("falls back to the precise model when the writing model errors", async () => {
    const run = vi.fn(async (model: string) => {
      if (model.includes("gpt-oss")) throw new Error("3040: capacity temporarily exceeded")
      return { response: { summary: "Designer focused on accessible systems." } }
    })
    const response = await call(generate, { task: "summary_scratch", resumeText: RESUME }, { AI: { run }, DB: quotaDb() })
    expect(response.status).toBe(200)
    expect(run.mock.calls.map((args) => args[0])).toEqual(["@cf/openai/gpt-oss-120b", "@cf/qwen/qwen3-30b-a3b-fp8"])
  })

  it("makes one corrective retry when the first reply is malformed", async () => {
    const { env, run } = workersEnv("not json at all", { summary: "Designer focused on accessible systems." })
    const response = await call(generate, { task: "summary_scratch", resumeText: RESUME }, env)
    expect(response.status).toBe(200)
    expect(run).toHaveBeenCalledTimes(2)
    // The corrective retry gets a second opinion from the precise model.
    const [retryModel, retryInput] = run.mock.calls[1] as unknown as [string, { messages: { role: string; content: string }[] }]
    expect(retryModel).toBe("@cf/qwen/qwen3-30b-a3b-fp8")
    expect(retryInput.messages.at(-1)?.content).toContain("previous reply was rejected")
    expect(env.DB.writes.filter((write) => write.values[0] === "committed")).toHaveLength(1)
  })

  it("stops after one retry and releases the reservation", async () => {
    const { env, run } = workersEnv("still not json")
    const response = await call(generate, { task: "summary_scratch", resumeText: RESUME }, env)
    expect(response.status).toBe(502)
    expect(run).toHaveBeenCalledTimes(2)
    expect(env.DB.writes.some((write) => write.values[0] === "released")).toBe(true)
  })

  it("accepts allowlisted model overrides and ignores anything else", async () => {
    const decoded = { summary: "Own product design.", seniority: "Senior", mustHaves: [], niceToHaves: [], responsibilities: [], keywords: [], watchOuts: [], questionsToAsk: [] }
    for (const [requested, expected] of [["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/meta/llama-3.3-70b-instruct-fp8-fast"], ["@cf/evil/model", "@cf/qwen/qwen3-30b-a3b-fp8"]]) {
      const run = vi.fn(async () => ({ response: decoded }))
      const response = await call(generate, { task: "job_decode", jobDescription: JOB }, { AI: { run }, DB: quotaDb(), AI_HOSTED_MODEL: requested })
      expect(response.status).toBe(200)
      expect((run.mock.calls[0] as unknown as [string])[0]).toBe(expected)
      const input = (run.mock.calls[0] as unknown as [string, { messages: { content: string }[] }])[1]
      expect(input.messages[0].content.includes("/no_think")).toBe(expected.includes("qwen3"))
    }
    for (const [requested, expected] of [["@cf/openai/gpt-oss-20b", "@cf/openai/gpt-oss-20b"], ["@cf/evil/model", "@cf/openai/gpt-oss-120b"]]) {
      const run = vi.fn(async () => ({ output_text: JSON.stringify({ summary: "Accessible design systems leader." }) }))
      const response = await call(generate, { task: "summary_scratch", resumeText: RESUME }, { AI: { run }, DB: quotaDb(), AI_WRITING_MODEL: requested })
      expect(response.status).toBe(200)
      expect((run.mock.calls[0] as unknown as [string])[0]).toBe(expected)
    }
  })

  it("uses one model for everything when the writing model matches the precise model", async () => {
    const run = vi.fn(async () => ({ response: { summary: "Accessible design systems leader." } }))
    const env = { AI: { run }, DB: quotaDb(), AI_WRITING_MODEL: "@cf/qwen/qwen3-30b-a3b-fp8" }
    expect((await call(generate, { task: "summary_scratch", resumeText: RESUME }, env)).status).toBe(200)
    expect((run.mock.calls[0] as unknown as [string])[0]).toBe("@cf/qwen/qwen3-30b-a3b-fp8")
  })

  it("treats an empty answer (reasoning used the whole budget) as a failure", async () => {
    const run = vi.fn(async () => ({ choices: [{ message: { content: "", reasoning_content: "long thoughts" } }] }))
    const response = await call(generate, { task: "summary_scratch", resumeText: RESUME }, { AI: { run }, DB: quotaDb() })
    expect(response.status).toBe(502)
  })
})

describe("new AI tasks", () => {
  it("builds a LinkedIn profile with skills grounded in the resume", async () => {
    const { env } = workersEnv({
      headline: "Senior Product Designer | Design Systems | Accessibility",
      about: "I design accessible products. At Brightwave I led an onboarding redesign. I am looking for my next design systems role.",
      skills: ["Figma", "Design Systems", "Kubernetes", "Accessibility"],
      highlights: ["Raised activation 38% with an onboarding redesign."],
    })
    const response = await call(generate, { task: "linkedin", resumeText: RESUME, targetRole: "Design Systems Lead" }, env)
    expect(response.status).toBe(200)
    const data = await response.json() as { skills: string[] }
    expect(data.skills).toEqual(["Figma", "Design Systems", "Accessibility"])
  })

  it("decodes a job description and keeps only keywords found in it", async () => {
    const { env } = workersEnv({
      summary: "Own end-to-end product design. Success means accessible, consistent experiences.",
      seniority: "Senior",
      mustHaves: ["5+ years with Figma", "Design systems"],
      niceToHaves: ["Motion design"],
      responsibilities: ["Design product flows"],
      keywords: ["Figma", "design systems", "Rust"],
      watchOuts: [],
      questionsToAsk: ["How is design measured here?"],
    })
    const response = await call(generate, { task: "job_decode", jobDescription: JOB }, env)
    expect(response.status).toBe(200)
    const data = await response.json() as { keywords: string[]; seniority: string }
    expect(data.keywords).toEqual(["Figma", "design systems"])
    expect(data.seniority).toBe("Senior")
  })

  it("rejects job decoding for a too-short description before using quota", async () => {
    const { env, run } = workersEnv({})
    const response = await call(generate, { task: "job_decode", jobDescription: "Designer" }, env)
    expect(response.status).toBe(400)
    expect(run).not.toHaveBeenCalled()
  })

  it("validates resume review priorities and quotes", async () => {
    const good = { items: [{ original: "Led onboarding redesign that raised activation 38%.", suggestion: "Name the team size.", reason: "Scope helps recruiters.", category: "medium" }], followUp: "Strong metrics and clear focus." }
    const { env, run } = workersEnv({ items: [{ ...good.items[0], category: "urgent" }], followUp: "x" }, good)
    const response = await call(generate, { task: "coach", mode: "review", resumeText: RESUME }, env)
    expect(response.status).toBe(200)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it("supports follow-up email kinds and rejects unknown kinds", async () => {
    const bad = await call(generate, { task: "recruiter_email", emailKind: "spam", resumeText: RESUME, jobDescription: JOB }, { AI: { run: vi.fn() }, DB: quotaDb() })
    expect(bad.status).toBe(400)
    const run = vi.fn(async () => ({ response: "Subject: Thank you\n\nThank you for discussing the design systems roadmap.\n\nJordan Avery" }))
    const ok = await call(generate, { task: "recruiter_email", emailKind: "thank_you", context: "Interviewer: Sam. Discussed design systems roadmap.", resumeText: RESUME, jobDescription: JOB }, { AI: { run }, DB: quotaDb() })
    expect(ok.status).toBe(200)
    const input = (run.mock.calls[0] as unknown as [string, { input: { role: string; content: string }[] }])[1]
    expect(input.input[0].content).toContain("thank-you email")
    expect(input.input[1].content).toContain("Interviewer: Sam")
  })

  it("retries a cover letter that still contains template placeholders", async () => {
    const queue = ["Dear [Hiring Manager], I want the [Role] job.", "Dear Hiring Manager,\n\nI design accessible systems.\n\nSincerely,\nJordan Avery"]
    const run = vi.fn(async () => ({ response: queue.shift() }))
    const response = await call(generate, { task: "cover_letter", resumeText: RESUME, jobDescription: JOB }, { AI: { run }, DB: quotaDb() })
    expect(response.status).toBe(200)
    expect(((await response.json()) as { text: string }).text).not.toContain("[")
    expect(run).toHaveBeenCalledTimes(2)
  })

  it("grounds AI job-match keywords in the job description", async () => {
    const { env } = workersEnv({ score: 82, matchedKeywords: ["Figma", "GraphQL"], missingKeywords: ["motion design", "Kotlin"], suggestions: [], summary: "Strong match with a motion design gap." })
    const response = await call(analyze, { resumeText: RESUME, jobDescription: JOB }, env, "/api/analyze")
    expect(response.status).toBe(200)
    const data = await response.json() as { matchedKeywords: string[]; missingKeywords: string[] }
    expect(data.matchedKeywords).toEqual(["Figma"])
    expect(data.missingKeywords).toEqual(["motion design"])
  })
})
