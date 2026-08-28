import { describe, expect, it } from "vitest"
import { onRequest } from "./[[path]]"

const unusedDb = {} as D1Database

async function call(request: Request) {
  return onRequest({ request, env: { DB: unusedDb } } as Parameters<typeof onRequest>[0])
}

describe("auth request boundary", () => {
  it("rejects cross-site mutations before touching account storage", async () => {
    const response = await call(new Request("https://resume.builtwai.com/api/auth/logout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://attacker.example",
        "sec-fetch-site": "cross-site",
      },
      body: "{}",
    }))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: "Invalid request origin." })
  })

  it("requires JSON for every mutating request", async () => {
    const response = await call(new Request("https://resume.builtwai.com/api/auth/logout", {
      method: "POST",
      headers: { origin: "https://resume.builtwai.com" },
      body: "not-json",
    }))

    expect(response.status).toBe(415)
    await expect(response.json()).resolves.toEqual({ error: "Requests must use JSON." })
  })

  it("adds no-store and response hardening headers", async () => {
    const response = await call(new Request("https://resume.builtwai.com/api/auth/unknown"))

    expect(response.status).toBe(404)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(response.headers.get("referrer-policy")).toBe("no-referrer")
  })
})
