import { describe, expect, it, vi } from "vitest"

import { runSmokeChecks, smokeModels } from "./ai-smoke"

describe("AI smoke test", () => {
  it("defaults to the configured models and accepts only allowlisted picks", () => {
    expect(smokeModels(undefined, ["@cf/qwen/qwen3-30b-a3b-fp8", "@cf/openai/gpt-oss-120b"])).toEqual(["@cf/qwen/qwen3-30b-a3b-fp8", "@cf/openai/gpt-oss-120b"])
    expect(smokeModels(undefined, ["@cf/qwen/qwen3-30b-a3b-fp8", "@cf/qwen/qwen3-30b-a3b-fp8"])).toHaveLength(1)
    expect(smokeModels("@cf/openai/gpt-oss-20b", [])).toEqual(["@cf/openai/gpt-oss-20b"])
    expect(smokeModels("@cf/evil/model", ["@cf/qwen/qwen3-30b-a3b-fp8"])).toEqual(["@cf/qwen/qwen3-30b-a3b-fp8"])
    expect(smokeModels("all", []).length).toBeGreaterThan(2)
  })

  it("reports grounded output, invented skills, and provider errors per model", async () => {
    const run = vi.fn(async (model: string, input: { messages?: unknown; input?: unknown }) => {
      if (model.includes("llama")) throw new Error("5007: model unavailable")
      const structured = JSON.stringify(input).includes("skills")
      if (model.includes("gpt-oss")) {
        return { output_text: structured ? JSON.stringify({ summary: "Operations analyst who builds forecasting models and automated reporting.", skills: ["Python", "SQL"] }) : "Thank you, Dana, for discussing demand forecasting with me. I enjoyed learning about the team. Riley Chen" }
      }
      return { response: structured ? { summary: "Operations analyst who builds forecasting models and dashboards.", skills: ["Python", "Kubernetes"] } : "Dear [Name], thanks." }
    })
    const checks = await runSmokeChecks({ run } as unknown as Ai, ["@cf/openai/gpt-oss-120b", "@cf/qwen/qwen3-30b-a3b-fp8", "@cf/meta/llama-3.3-70b-instruct-fp8-fast"])
    const byKey = Object.fromEntries(checks.map((check) => [`${check.model}:${check.check}`, check]))
    expect(byKey["@cf/openai/gpt-oss-120b:structured"].ok).toBe(true)
    expect(byKey["@cf/openai/gpt-oss-120b:plain_text"].ok).toBe(true)
    expect(byKey["@cf/qwen/qwen3-30b-a3b-fp8:structured"]).toMatchObject({ ok: false, error: expect.stringContaining("Kubernetes") })
    expect(byKey["@cf/qwen/qwen3-30b-a3b-fp8:plain_text"].ok).toBe(false)
    expect(byKey["@cf/meta/llama-3.3-70b-instruct-fp8-fast:structured"]).toMatchObject({ ok: false, error: expect.stringContaining("unavailable") })
  })
})
