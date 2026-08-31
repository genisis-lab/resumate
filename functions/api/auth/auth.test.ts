import { afterEach, describe, expect, it, vi } from "vitest"
import { onRequest } from "./[[path]]"

const unusedDb = {} as D1Database

afterEach(() => vi.unstubAllGlobals())

function registrationDb(sql: string[] = []) {
  return {
    prepare: (statement: string) => ({
      bind: (..._values: unknown[]) => ({
        run: async () => {
          sql.push(statement)
          return { success: true, meta: { changes: 1 } }
        },
        first: async () => {
          sql.push(statement)
          if (statement.includes("SELECT attempts")) return { attempts: 1 }
          return null
        },
      }),
    }),
    batch: async () => [],
  } as unknown as D1Database
}

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

  it("registers through a portable upsert without relying on a write RETURNING clause", async () => {
    const sql: string[] = []
    const db = registrationDb(sql)
    const response = await onRequest({
      request: new Request("https://resume.builtwai.com/api/auth/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://resume.builtwai.com",
          "sec-fetch-site": "same-origin",
        },
        body: JSON.stringify({ name: "Test User", email: "test@example.com", password: "a-secure-test-password" }),
      }),
      env: { DB: db },
    } as Parameters<typeof onRequest>[0])

    expect(response.status).toBe(202)
    expect(sql.some((statement) => statement.includes("RETURNING attempts"))).toBe(false)
  })

  it("publishes only the Turnstile sitekey when both bindings are present", async () => {
    const response = await onRequest({
      request: new Request("https://resume.builtwai.com/api/auth/config"),
      env: { DB: unusedDb, TURNSTILE_SITE_KEY: "public-site-key", TURNSTILE_SECRET_KEY: "private-secret" },
    } as Parameters<typeof onRequest>[0])

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ turnstileSiteKey: "public-site-key" })
  })

  it("requires a valid Turnstile token when account protection is configured", async () => {
    const response = await onRequest({
      request: new Request("https://resume.builtwai.com/api/auth/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://resume.builtwai.com",
          "sec-fetch-site": "same-origin",
        },
        body: JSON.stringify({ name: "Test User", email: "protected@example.com", password: "a-secure-test-password" }),
      }),
      env: { DB: registrationDb(), TURNSTILE_SITE_KEY: "public-site-key", TURNSTILE_SECRET_KEY: "private-secret" },
    } as Parameters<typeof onRequest>[0])

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: "Complete the security check and try again." })
  })

  it("accepts only a matching Turnstile hostname and signup action", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      success: true,
      hostname: "resume.builtwai.com",
      action: "signup",
    }), { status: 200, headers: { "content-type": "application/json" } })))
    const response = await onRequest({
      request: new Request("https://resume.builtwai.com/api/auth/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://resume.builtwai.com",
          "sec-fetch-site": "same-origin",
        },
        body: JSON.stringify({
          name: "Test User",
          email: "protected@example.com",
          password: "a-secure-test-password",
          turnstileToken: "signed-turnstile-token",
        }),
      }),
      env: { DB: registrationDb(), TURNSTILE_SITE_KEY: "public-site-key", TURNSTILE_SECRET_KEY: "private-secret" },
    } as Parameters<typeof onRequest>[0])

    expect(response.status).toBe(202)
  })
})
