import { beforeEach, describe, expect, it, vi } from "vitest"

import { onRequest as analyze } from "../functions/api/analyze"
import { onRequest as generate } from "../functions/api/generate"

const env = { AI_API_KEY: "test-key" }

function request(path: string, body?: unknown, init: RequestInit = {}) {
  const headers = new Headers(body === undefined ? undefined : {
    "CF-Connecting-IP": crypto.randomUUID(),
    "Content-Type": "application/json",
    Origin: "https://resume.builtwai.com",
  })
  for (const [key, value] of new Headers(init.headers)) headers.set(key, value)
  return new Request(`https://resume.builtwai.com${path}`, {
    ...init,
    method: init.method || (body === undefined ? "GET" : "POST"),
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

async function invoke(
  handler: typeof analyze | typeof generate,
  incoming: Request,
  bindings: Record<string, string | undefined> = env,
) {
  return await handler({ request: incoming, env: bindings } as never)
}

function providerResponse(content: string) {
  return Response.json({ choices: [{ message: { content } }] })
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe("AI proxy boundary", () => {
  it("returns API-native method and media-type errors", async () => {
    const wrongMethod = await invoke(analyze, request("/api/analyze"))
    expect(wrongMethod.status).toBe(405)
    expect(wrongMethod.headers.get("Allow")).toBe("POST")

    const wrongType = await invoke(analyze, request("/api/analyze", {}, {
      headers: { "Content-Type": "text/plain" },
    }))
    expect(wrongType.status).toBe(415)
  })

  it("requires exact same-origin browser requests", async () => {
    const response = await invoke(analyze, request("/api/analyze", {}, {
      headers: { Origin: "https://attacker.example", "Sec-Fetch-Site": "cross-site" },
    }))
    expect(response.status).toBe(403)
  })

  it("rejects streaming request bodies above the byte limit", async () => {
    const response = await invoke(generate, request("/api/generate", {
      task: "proofread",
      resumeText: "x".repeat(129 * 1024),
    }))
    expect(response.status).toBe(413)
  })

  it("rejects arbitrary paths on otherwise allowed provider hosts", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const response = await invoke(analyze, request("/api/analyze", {
      resumeText: "Resume",
      jobDescription: "Job",
      clientKey: "user-key",
      clientUrl: "https://api.openai.com/v1/files",
      clientModel: "gpt-4o-mini",
    }))
    expect(response.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("refuses redirects, caps provider output, and normalizes analysis", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.redirect).toBe("error")
      expect(init.signal).toBeInstanceOf(AbortSignal)
      return providerResponse(JSON.stringify({
        score: 999,
        matchedKeywords: Array.from({ length: 30 }, (_, index) => `match-${index}`),
        missingKeywords: ["one"],
        suggestions: [{ section: "General", severity: "critical", text: "x".repeat(700) }],
        summary: "s".repeat(1_500),
      }))
    })
    vi.stubGlobal("fetch", fetchMock)
    const response = await invoke(analyze, request("/api/analyze", {
      resumeText: "Resume",
      jobDescription: "Job",
    }))
    expect(response.status).toBe(200)
    const data = await response.json() as Record<string, unknown>
    expect(data.score).toBe(100)
    expect(data.matchedKeywords).toHaveLength(15)
    expect((data.summary as string)).toHaveLength(1_000)
    expect((data.suggestions as Array<{ severity: string; text: string }>)[0]).toMatchObject({ severity: "low" })
    expect((data.suggestions as Array<{ text: string }>)[0].text).toHaveLength(500)
  })

  it("fails closed when a provider response exceeds the streaming cap", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x".repeat(513 * 1024))))
    const response = await invoke(generate, request("/api/generate", {
      task: "proofread",
      resumeText: "Resume",
    }))
    expect(response.status).toBe(502)
  })

  it("normalizes generated arrays before returning them", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => providerResponse(JSON.stringify({
      issues: Array.from({ length: 20 }, () => "x".repeat(700)),
    }))))
    const response = await invoke(generate, request("/api/generate", {
      task: "proofread",
      resumeText: "Resume",
    }))
    expect(response.status).toBe(200)
    const data = await response.json() as { issues: string[] }
    expect(data.issues).toHaveLength(12)
    expect(data.issues[0]).toHaveLength(500)
  })
})
