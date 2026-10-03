import { describe, expect, it, vi } from "vitest"

import { onRequest as generate } from "../functions/api/generate"
import { checkTranslations, digitSignature, validTranslationRequest } from "./translate"

function quotaDb() {
  return {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => {
          if (sql.includes("FROM sessions")) return { id: "user-1", email: "owner@example.com", plan: "pro", emailVerifiedAt: Date.now() }
          if (sql.includes("INSERT INTO ai_action_reservations")) return { used: 1 }
          return { attempts: 1, windowStartedAt: Date.now() }
        }),
        run: vi.fn(async () => ({ success: true })),
      })),
    })),
  }
}

function request(body: unknown) {
  return new Request("https://resume.builtwai.com/api/generate", {
    method: "POST",
    headers: { "CF-Connecting-IP": crypto.randomUUID(), "Content-Type": "application/json", Cookie: "__Host-resumate_session=test", Origin: "https://resume.builtwai.com" },
    body: JSON.stringify(body),
  })
}

const SEGMENTS = [
  { id: "summary", text: "Product designer who raised activation 38% across 2 launches." },
  { id: "exp.0.b.0", text: "Led onboarding redesign for 1,500 customers in 2023." },
  { id: "date:exp.0.start", text: "Jan 2021" },
]

describe("resume translation", () => {
  it("keeps numbers while allowing reordering and separators", () => {
    expect(digitSignature("1,500 customers in 2023")).toBe(digitSignature("en 2023, 1 500 clientes"))
    expect(digitSignature("raised 38%")).not.toBe(digitSignature("aumentó un 83 %"))
  })

  it("validates every segment, numbers, and length", () => {
    const good = { translations: [
      { id: "summary", text: "Diseñador de producto que aumentó la activación un 38 % en 2 lanzamientos." },
      { id: "exp.0.b.0", text: "Dirigió el rediseño del onboarding para 1.500 clientes en 2023." },
      { id: "date:exp.0.start", text: "Ene 2021" },
    ] }
    expect(checkTranslations(SEGMENTS, good)).toBeInstanceOf(Map)
    expect(checkTranslations(SEGMENTS, { translations: good.translations.slice(0, 2) })).toMatchObject({ invalid: expect.stringContaining("date:exp.0.start") })
    expect(checkTranslations(SEGMENTS, { translations: [{ ...good.translations[0], text: "Diseñador que aumentó la activación un 40 % en 2 lanzamientos." }, ...good.translations.slice(1)] })).toMatchObject({ invalid: expect.stringContaining("same numbers") })
    expect(checkTranslations(SEGMENTS, { translations: [{ ...good.translations[0], text: "Diseñador 38 2." }, ...good.translations.slice(1)] })).toMatchObject({ invalid: expect.stringContaining("similar length") })
  })

  it("rejects bad requests before using an AI action", () => {
    expect(validTranslationRequest("de", SEGMENTS)).toBe("Choose English, Spanish, or French")
    expect(validTranslationRequest("es", [])).toBe("Nothing to translate")
    expect(validTranslationRequest("es", [SEGMENTS[0], SEGMENTS[0]])).toBe("Invalid segment id")
    expect(validTranslationRequest("es", [{ id: "x", text: "a".repeat(2_001) }])).toBe("Invalid segment text")
  })

  it("translates on the writing model and retries a reply that drops a segment", async () => {
    const replies = [
      { translations: [{ id: "summary", text: "Diseñador de producto que aumentó la activación un 38 % en 2 lanzamientos." }] },
      { translations: [
        { id: "summary", text: "Diseñador de producto que aumentó la activación un 38 % en 2 lanzamientos." },
        { id: "exp.0.b.0", text: "Dirigió el rediseño del onboarding para 1.500 clientes en 2023." },
        { id: "date:exp.0.start", text: "Ene 2021" },
      ] },
    ]
    const run = vi.fn(async () => ({ output_text: JSON.stringify(replies.shift()) }))
    const response = await generate({ request: request({ task: "translate", targetLanguage: "es", segments: SEGMENTS }), env: { AI: { run }, DB: quotaDb() } } as never)
    expect(response.status).toBe(200)
    const data = await response.json() as { language: string; translations: { id: string; text: string }[] }
    expect(data.language).toBe("es")
    expect(data.translations.map((item) => item.id)).toEqual(SEGMENTS.map((item) => item.id))
    expect((run.mock.calls[0] as unknown as [string])[0]).toBe("@cf/openai/gpt-oss-120b")
    expect(run).toHaveBeenCalledTimes(2)
  })

  it("refuses translation fields on other tasks", async () => {
    const response = await generate({ request: request({ task: "summary_scratch", resumeText: "Designer", targetLanguage: "es" }), env: { AI: { run: vi.fn() }, DB: quotaDb() } } as never)
    expect(response.status).toBe(400)
  })
})
