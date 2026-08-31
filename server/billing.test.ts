import { Webhook } from "standardwebhooks"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { fileURLToPath } from "node:url"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { createWhopCheckout, processWhopWebhook, whopConfig } from "./billing"

const config = {
  WHOP_CHECKOUT_ENABLED: "true",
  WHOP_BUSINESS_ID: "biz_resumate123",
  WHOP_RESUMATE_PRODUCT_ID: "prod_resumate1",
  WHOP_RESUMATE_SPRINT_PLAN_ID: "plan_sprint123",
  WHOP_RESUMATE_PRO_PLAN_ID: "plan_pro123456",
  WHOP_WEBHOOK_SECRET: "ws_resumate_test_secret",
  WHOP_API_KEY: "test_checkout_configuration_key",
}
const USER_ID = "4e4cf3b0-4479-4fd7-8d19-0d6ff7f24069"

class SqliteD1 {
  readonly sqlite = new DatabaseSync(":memory:")

  constructor() {
    const migrationRoot = join(dirname(fileURLToPath(import.meta.url)), "../migrations")
    this.sqlite.exec(readFileSync(join(migrationRoot, "0001_accounts.sql"), "utf8"))
    this.sqlite.exec(readFileSync(join(migrationRoot, "0002_ai_billing.sql"), "utf8"))
    this.sqlite.exec(readFileSync(join(migrationRoot, "0003_password_versioning.sql"), "utf8"))
    this.sqlite.exec(readFileSync(join(migrationRoot, "0004_admin_analytics.sql"), "utf8"))
    this.sqlite.prepare(
      `INSERT INTO users
       (id, email, name, password_hash, password_salt, email_verified_at, plan, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'free', ?, ?)`,
    ).run(USER_ID, "user@example.com", "Test User", "hash", "salt", Date.now(), Date.now(), Date.now())
  }

  prepare(sql: string) {
    const statement = this.sqlite.prepare(sql)
    return {
      bind: (...values: Array<null | number | bigint | string | Uint8Array>) => ({
        first: async <T>() => (statement.get(...values) || null) as T | null,
        run: async () => {
          const result = statement.run(...values)
          return { success: true, meta: { changes: Number(result.changes) } }
        },
      }),
    }
  }

  async batch(statements: Array<{ run(): Promise<unknown> }>) {
    this.sqlite.exec("BEGIN IMMEDIATE")
    try {
      const results = []
      for (const statement of statements) results.push(await statement.run())
      this.sqlite.exec("COMMIT")
      return results
    } catch (error) {
      this.sqlite.exec("ROLLBACK")
      throw error
    }
  }

  userPlan() {
    return (this.sqlite.prepare("SELECT plan FROM users WHERE id = ?").get(USER_ID) as { plan: string }).plan
  }

  entitlementExpiry() {
    return (this.sqlite.prepare(
      "SELECT valid_until AS validUntil FROM entitlements WHERE user_id = ? AND entitlement_key = 'ai:hosted'",
    ).get(USER_ID) as { validUntil: number } | undefined)?.validUntil ?? null
  }

  webhookEventCount() {
    return (this.sqlite.prepare("SELECT COUNT(*) AS count FROM billing_webhook_events").get() as { count: number }).count
  }
}

function database() {
  const statements: Array<{ sql: string; values: unknown[] }> = []
  return {
    statements,
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn((...values: unknown[]) => {
        const statement = { sql, values }
        return {
          first: vi.fn(async () => {
            statements.push(statement)
            if (sql.includes("FROM sessions")) {
              return { id: USER_ID, email: "user@example.com", plan: "free", emailVerifiedAt: Date.now() }
            }
            if (sql.includes("SELECT status, current_period_end")) return null
            if (sql.includes("SELECT attempts") && sql.includes("auth_rate_limits")) return { attempts: 1, windowStartedAt: Date.now() }
            if (sql.includes("SELECT id FROM users")) return { id: USER_ID }
            if (sql.includes("SELECT internal_plan")) return { internalPlan: "pro", status: "active", currentPeriodEnd: Date.now() + 86_400_000 }
            return null
          }),
          run: vi.fn(async () => {
            statements.push(statement)
            return { success: true, meta: { changes: 1 } }
          }),
        }
      }),
    })),
    batch: vi.fn(async (items: unknown[]) => {
      statements.push({ sql: "BATCH", values: items })
      return []
    }),
  }
}

function sameOriginRequest(path: string, body: unknown, cookie = "__Host-resumate_session=test-session") {
  return new Request(`https://resume.builtwai.com${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      Origin: "https://resume.builtwai.com",
      "Sec-Fetch-Site": "same-origin",
    },
    body: JSON.stringify(body),
  })
}

function signedWebhook(
  data: Record<string, unknown>,
  type = "membership.activated",
  id = `msg_${crypto.randomUUID().replaceAll("-", "")}`,
  eventTimestamp = new Date().toISOString(),
) {
  const event = {
    company_id: config.WHOP_BUSINESS_ID,
    id,
    api_version: "v1",
    api_version_date: "2026-08-25-2",
    type,
    timestamp: eventTimestamp,
    data,
  }
  const raw = JSON.stringify(event)
  const date = new Date()
  const timestamp = String(Math.floor(date.getTime() / 1_000))
  const signature = new Webhook(btoa(config.WHOP_WEBHOOK_SECRET)).sign(event.id, date, raw)
  return new Request("https://resume.builtwai.com/api/billing/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "webhook-id": event.id,
      "webhook-signature": signature,
      "webhook-timestamp": timestamp,
    },
    body: raw,
  })
}

function officialMembership(overrides: Record<string, unknown> = {}) {
  return {
    id: "mem_resumate123",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    renewal_period_start: new Date().toISOString(),
    renewal_period_end: new Date(Date.now() + 86_400_000).toISOString(),
    cancel_at_period_end: false,
    company: { id: config.WHOP_BUSINESS_ID, title: "Builtwai" },
    product: { id: config.WHOP_RESUMATE_PRODUCT_ID, title: "ResuMate", metadata: {} },
    plan: { id: config.WHOP_RESUMATE_PRO_PLAN_ID, metadata: { resumate_plan: "pro" } },
    metadata: {
      resumate_user_id: USER_ID,
      resumate_plan: "pro",
      resumate_product_id: config.WHOP_RESUMATE_PRODUCT_ID,
    },
    ...overrides,
  }
}

beforeEach(() => vi.unstubAllGlobals())

describe("inactive Whop billing boundary", () => {
  it("requires every exact ResuMate catalog allowlist", () => {
    expect(whopConfig({ ...config, WHOP_CHECKOUT_ENABLED: "false" } as never)?.businessId).toBe(config.WHOP_BUSINESS_ID)
    expect(whopConfig({ ...config, WHOP_RESUMATE_PRODUCT_ID: "wrong-prefix" } as never)).toBeNull()
    expect(whopConfig({ ...config, WHOP_RESUMATE_SPRINT_PLAN_ID: config.WHOP_RESUMATE_PRO_PLAN_ID } as never)).toBeNull()
  })

  it("keeps checkout inactive behind the explicit launch flag", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const response = await createWhopCheckout(
      sameOriginRequest("/api/billing/checkout", { plan: "pro" }),
      { ...config, WHOP_CHECKOUT_ENABLED: "false", DB: database() } as never,
      "pro",
    )
    expect(response.status).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("creates only the selected allowlisted plan with internal user metadata", async () => {
    const db = database()
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const payload = JSON.parse(String(init.body)) as Record<string, unknown>
      expect(payload).toMatchObject({
        company_id: config.WHOP_BUSINESS_ID,
        plan_id: config.WHOP_RESUMATE_SPRINT_PLAN_ID,
        metadata: {
          resumate_user_id: USER_ID,
          resumate_plan: "sprint",
          resumate_product_id: config.WHOP_RESUMATE_PRODUCT_ID,
        },
      })
      expect(new Headers(init.headers).get("Authorization")).toBe(`Bearer ${config.WHOP_API_KEY}`)
      expect(new Headers(init.headers).get("Api-Version-Date")).toBe("2026-08-25-2")
      expect(init.signal).toBeInstanceOf(AbortSignal)
      return Response.json({
        id: "ch_resumate123",
        company_id: config.WHOP_BUSINESS_ID,
        plan: { id: config.WHOP_RESUMATE_SPRINT_PLAN_ID },
        metadata: {
          resumate_user_id: USER_ID,
          resumate_plan: "sprint",
          resumate_product_id: config.WHOP_RESUMATE_PRODUCT_ID,
        },
        purchase_url: "https://whop.com/checkout/plan_sprint123",
      })
    })
    vi.stubGlobal("fetch", fetchMock)
    const response = await createWhopCheckout(
      sameOriginRequest("/api/billing/checkout", { plan: "sprint" }),
      { ...config, DB: db } as never,
      "sprint",
    )
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      provider: "whop",
      checkoutId: "ch_resumate123",
      planId: config.WHOP_RESUMATE_SPRINT_PLAN_ID,
    })
  })

  it("rate limits repeated checkout-configuration creation before calling Whop", async () => {
    const db = database()
    db.prepare = vi.fn((sql: string) => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => {
          if (sql.includes("FROM sessions")) return { id: USER_ID, email: "user@example.com", plan: "free", emailVerifiedAt: Date.now() }
          if (sql.includes("SELECT status, current_period_end")) return null
          if (sql.includes("SELECT attempts") && sql.includes("auth_rate_limits")) return { attempts: 6, windowStartedAt: Date.now() }
          return null
        }),
        run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
      })),
    })) as typeof db.prepare
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const response = await createWhopCheckout(
      sameOriginRequest("/api/billing/checkout", { plan: "pro" }),
      { ...config, DB: db } as never,
      "pro",
    )
    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects a new checkout while an unexpired paid membership is active", async () => {
    const db = database()
    db.prepare = vi.fn((sql: string) => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => sql.includes("FROM sessions")
          ? { id: USER_ID, email: "user@example.com", plan: "pro", emailVerifiedAt: Date.now() }
          : sql.includes("SELECT status, current_period_end")
            ? { status: "active", currentPeriodEnd: Date.now() + 86_400_000 }
            : null),
        run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
      })),
    })) as typeof db.prepare
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const response = await createWhopCheckout(
      sameOriginRequest("/api/billing/checkout", { plan: "sprint" }),
      { ...config, DB: db } as never,
      "sprint",
    )
    expect(response.status).toBe(409)
    await expect(response.text()).resolves.toContain("already have an active paid plan")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("ignores a validly signed webhook for any other product", async () => {
    const db = database()
    const response = await processWhopWebhook(signedWebhook(officialMembership({
      product: { id: "prod_other123", title: "Other", metadata: {} },
    })), { ...config, DB: db } as never)
    expect(response.status).toBe(202)
    expect(db.statements).toHaveLength(0)
  })

  it("rejects conflicting duplicate catalog identifiers even when one value is allowlisted", async () => {
    const db = database()
    const response = await processWhopWebhook(signedWebhook(officialMembership({
      product_id: "prod_conflict123",
    })), { ...config, DB: db } as never)
    expect(response.status).toBe(202)
    expect(db.statements).toHaveLength(0)
  })

  it("requires the checkout-bound product metadata before mapping an account", async () => {
    const db = database()
    const response = await processWhopWebhook(signedWebhook(officialMembership({
      metadata: { resumate_user_id: USER_ID, resumate_plan: "pro" },
    })), { ...config, DB: db } as never)
    expect(response.status).toBe(202)
    expect(db.statements).toHaveLength(0)
  })

  it.each([
    ["membership.activated", officialMembership()],
    ["membership.cancel_at_period_end_changed", officialMembership({ cancel_at_period_end: true })],
    ["membership.deactivated", officialMembership({ renewal_period_end: null })],
  ])("maps the official nested v1 %s fixture", async (eventType, membership) => {
    const db = database()
    const response = await processWhopWebhook(signedWebhook(membership, eventType), { ...config, DB: db } as never)
    expect(response.status).toBe(204)
    expect(db.statements.some((statement) => statement.sql.includes("billing_webhook_events"))).toBe(true)
    expect(db.statements.some((statement) => statement.sql.includes("billing_subscriptions"))).toBe(true)
    expect(db.statements.some((statement) => statement.sql === "BATCH")).toBe(true)
  })

  it("carefully accepts a signed flat compatibility payload with the same strict allowlists", async () => {
    const db = database()
    const response = await processWhopWebhook(signedWebhook({
      id: "mem_flat12345",
      account_id: config.WHOP_BUSINESS_ID,
      product_id: config.WHOP_RESUMATE_PRODUCT_ID,
      plan_id: config.WHOP_RESUMATE_SPRINT_PLAN_ID,
      status: "active",
      cancel_at_period_end: false,
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 86_400_000).toISOString(),
      metadata: {
        resumate_user_id: USER_ID,
        resumate_plan: "sprint",
        resumate_product_id: config.WHOP_RESUMATE_PRODUCT_ID,
      },
    }, "membership.activated", "evt_compat123"), { ...config, DB: db } as never)
    expect(response.status).toBe(204)
  })

  it("does not grant access for an activated membership whose term already expired", async () => {
    const db = new SqliteD1()
    const response = await processWhopWebhook(signedWebhook(officialMembership({
      renewal_period_start: new Date(Date.now() - 172_800_000).toISOString(),
      renewal_period_end: new Date(Date.now() - 86_400_000).toISOString(),
    })), { ...config, DB: db } as never)
    expect(response.status).toBe(204)
    expect(db.userPlan()).toBe("free")
  })

  it("keeps a newer deactivation authoritative over an out-of-order activation", async () => {
    const db = new SqliteD1()
    const oldTimestamp = new Date(Date.now() - 120_000).toISOString()
    const newerTimestamp = new Date(Date.now() - 60_000).toISOString()
    const futureEnd = new Date(Date.now() + 86_400_000).toISOString()

    await processWhopWebhook(signedWebhook(
      officialMembership({ renewal_period_end: futureEnd }),
      "membership.activated",
      "msg_order_active_first",
      oldTimestamp,
    ), { ...config, DB: db } as never)
    expect(db.userPlan()).toBe("pro")

    await processWhopWebhook(signedWebhook(
      officialMembership({ renewal_period_end: futureEnd }),
      "membership.deactivated",
      "msg_order_deactivated_newer",
      newerTimestamp,
    ), { ...config, DB: db } as never)
    expect(db.userPlan()).toBe("free")

    await processWhopWebhook(signedWebhook(
      officialMembership({ renewal_period_end: futureEnd }),
      "membership.activated",
      "msg_order_active_stale",
      oldTimestamp,
    ), { ...config, DB: db } as never)
    expect(db.userPlan()).toBe("free")
  })

  it("keeps the newer entitlement expiry when an older active event arrives late", async () => {
    const db = new SqliteD1()
    const olderEventTime = new Date(Date.now() - 120_000).toISOString()
    const newerEventTime = new Date(Date.now() - 60_000).toISOString()
    const earlierEnd = new Date(Date.now() + 86_400_000).toISOString()
    const laterEnd = new Date(Date.now() + 172_800_000).toISOString()

    await processWhopWebhook(signedWebhook(
      officialMembership({ renewal_period_end: laterEnd }),
      "membership.activated",
      "msg_active_newer_expiry",
      newerEventTime,
    ), { ...config, DB: db } as never)
    const expectedExpiry = Date.parse(laterEnd)
    expect(db.entitlementExpiry()).toBe(expectedExpiry)

    await processWhopWebhook(signedWebhook(
      officialMembership({ renewal_period_end: earlierEnd }),
      "membership.activated",
      "msg_active_older_expiry",
      olderEventTime,
    ), { ...config, DB: db } as never)
    expect(db.userPlan()).toBe("pro")
    expect(db.entitlementExpiry()).toBe(expectedExpiry)
  })

  it("records and processes a signed event only once", async () => {
    const db = new SqliteD1()
    const request = signedWebhook(officialMembership(), "membership.activated", "msg_replay_once")
    const raw = await request.text()
    const headers = new Headers(request.headers)
    const first = await processWhopWebhook(new Request(request.url, { method: "POST", headers, body: raw }), { ...config, DB: db } as never)
    const replay = await processWhopWebhook(new Request(request.url, { method: "POST", headers, body: raw }), { ...config, DB: db } as never)
    expect(first.status).toBe(204)
    expect(replay.status).toBe(204)
    expect(db.webhookEventCount()).toBe(1)
  })

  it("rejects an invalid signature before touching D1", async () => {
    const db = database()
    const request = signedWebhook({})
    request.headers.set("webhook-signature", "v1,invalid")
    const response = await processWhopWebhook(request, { ...config, DB: db } as never)
    expect(response.status).toBe(400)
    expect(db.statements).toHaveLength(0)
  })
})
