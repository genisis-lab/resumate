import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { fileURLToPath } from "node:url"
import { describe, expect, it, vi } from "vitest"

import { onRequest as eventEndpoint } from "../functions/api/analytics/event"
import { browserMetadata, upgradeSource } from "./analytics"

function analyticsDb() {
  const inserts: unknown[][] = []
  return {
    inserts,
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn((...values: unknown[]) => ({
        run: vi.fn(async () => {
          if (sql.includes("INSERT INTO conversion_events")) inserts.push(values)
          return { success: true }
        }),
        first: vi.fn(async () => ({ attempts: 1 })),
      })),
    })),
  }
}

function post(body: unknown) {
  return new Request("https://resume.builtwai.com/api/analytics/event", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://resume.builtwai.com", "CF-Connecting-IP": "203.0.113.9" },
    body: JSON.stringify(body),
  })
}

describe("funnel analytics", () => {
  it("keeps only enumerable labels from the browser", () => {
    expect(browserMetadata({ source: "export_limit", template: "horizon", plan: "free", format: "pdf" })).toEqual({ source: "export_limit", template: "horizon", plan: "free", format: "pdf" })
    expect(browserMetadata({ source: "Jordan's resume", template: "<script>", plan: "enterprise", note: "free text" })).toBeNull()
    expect(upgradeSource("nav")).toBe("nav")
    expect(upgradeSource("anything")).toBeNull()
  })

  it("records browser events without a user id and refuses server-only events", async () => {
    const DB = analyticsDb()
    const ok = await eventEndpoint({ request: post({ event: "upgrade_prompt_clicked", source: "export_limit", resumeText: "secret" }), env: { DB } } as never)
    expect(ok.status).toBe(204)
    expect(DB.inserts).toHaveLength(1)
    const [, name, userId, metadata] = DB.inserts[0]
    expect(name).toBe("upgrade_prompt_clicked")
    expect(userId).toBeNull()
    expect(metadata).toBe(JSON.stringify({ source: "export_limit" }))
    const forged = await eventEndpoint({ request: post({ event: "purchase_activated" }), env: { DB } } as never)
    expect(forged.status).toBe(400)
    expect(DB.inserts).toHaveLength(1)
  })

  it("migrates existing events and still rejects malformed event names", () => {
    const db = new DatabaseSync(":memory:")
    const root = join(dirname(fileURLToPath(import.meta.url)), "../migrations")
    for (const file of ["0001_accounts.sql", "0002_ai_billing.sql", "0003_password_versioning.sql", "0004_admin_analytics.sql"]) db.exec(readFileSync(join(root, file), "utf8"))
    db.prepare("INSERT INTO conversion_events (id, event_name, created_at) VALUES ('e1', 'landing_view', 1)").run()
    db.exec(readFileSync(join(root, "0005_funnel_usage_sync.sql"), "utf8"))
    expect(db.prepare("SELECT event_name AS name FROM conversion_events").all()).toEqual([{ name: "landing_view" }])
    db.prepare("INSERT INTO conversion_events (id, event_name, created_at) VALUES ('e2', 'upgrade_prompt_viewed', 2)").run()
    expect(() => db.prepare("INSERT INTO conversion_events (id, event_name, created_at) VALUES ('e3', 'Bad Name!', 3)").run()).toThrow()
  })
})
