import { describe, expect, it } from "vitest"

import { onRequest as usage } from "../functions/api/usage/[[path]]"
import { ANONYMOUS_NETWORK_LIMITS, FREE_LIMITS } from "./free-usage"
import { SqliteD1, signedInUser } from "./test-d1"

function call(env: unknown, path: string, init: { cookie?: string; ip?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { Origin: "https://resume.builtwai.com", "CF-Connecting-IP": init.ip || "198.51.100.7" }
  if (init.cookie) headers.Cookie = init.cookie
  if (init.body !== undefined) headers["Content-Type"] = "application/json"
  const request = new Request(`https://resume.builtwai.com/api/usage/${path}`, {
    method: init.body === undefined ? "GET" : "POST",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  return usage({ request, env } as never)
}

describe("server-side Free usage", () => {
  it("counts a signed-in Free account on the server and refuses past the limit", async () => {
    const DB = new SqliteD1()
    const { cookie } = await signedInUser(DB)
    for (let used = 1; used <= FREE_LIMITS.documentExports; used += 1) {
      const response = await call({ DB }, "consume", { cookie, body: { action: "documentExports" } })
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ allowed: true, used, scope: "account" })
    }
    const refused = await call({ DB }, "consume", { cookie, body: { action: "documentExports" } })
    expect(refused.status).toBe(429)
    expect(await refused.json()).toMatchObject({ allowed: false, remaining: 0, scope: "account" })
    // A different IP (new device) still sees the same account count.
    const snapshot = await (await call({ DB }, "free", { cookie, ip: "203.0.113.50" })).json() as Record<string, { used: number }>
    expect(snapshot.documentExports.used).toBe(FREE_LIMITS.documentExports)
    expect(snapshot.localAtsChecks.used).toBe(0)
  })

  it("does not meter paid plans", async () => {
    const DB = new SqliteD1()
    const { cookie } = await signedInUser(DB, "pro")
    for (let index = 0; index < 5; index += 1) {
      expect(await (await call({ DB }, "consume", { cookie, body: { action: "documentExports" } })).json()).toMatchObject({ allowed: true, limit: null, scope: "paid" })
    }
  })

  it("backs signed-out visitors with a looser per-network count", async () => {
    const DB = new SqliteD1()
    for (let used = 1; used <= ANONYMOUS_NETWORK_LIMITS.localAtsChecks; used += 1) {
      expect((await call({ DB }, "consume", { body: { action: "localAtsChecks" } })).status).toBe(200)
    }
    expect((await call({ DB }, "consume", { body: { action: "localAtsChecks" } })).status).toBe(429)
    expect((await call({ DB }, "consume", { ip: "192.0.2.1", body: { action: "localAtsChecks" } })).status).toBe(200)
    // The stored key is a hash, never the address itself.
    const keys = DB.sqlite.prepare("SELECT subject_key AS key FROM free_usage_counters").all() as Array<{ key: string }>
    expect(keys.every((row) => !row.key.includes("198.51.100.7") && !row.key.includes("192.0.2.1"))).toBe(true)
  })

  it("does not spend the network allowance for a browser already over its own limit", async () => {
    const DB = new SqliteD1()
    const refused = await call({ DB }, "consume", { body: { action: "documentExports", localAllowed: false } })
    expect(refused.status).toBe(429)
    expect(DB.sqlite.prepare("SELECT COUNT(*) AS count FROM free_usage_counters").get()).toEqual({ count: 0 })
  })

  it("rejects unknown actions and cross-origin posts", async () => {
    const DB = new SqliteD1()
    expect((await call({ DB }, "consume", { body: { action: "aiActions" } })).status).toBe(400)
    const request = new Request("https://resume.builtwai.com/api/usage/consume", { method: "POST", headers: { Origin: "https://evil.example", "Content-Type": "application/json" }, body: "{}" })
    expect((await usage({ request, env: { DB } } as never)).status).toBe(403)
  })
})
