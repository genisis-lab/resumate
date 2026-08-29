import { describe, expect, it } from "vitest"
import { canUseTemplate, consumeUsage, FREE_PLAN_LIMITS, usageSnapshot } from "./usage"

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

describe("free local usage", () => {
  it("allows exactly three document exports per UTC month", () => {
    const storage = new MemoryStorage()
    const now = new Date("2026-08-29T04:00:00Z")
    for (let count = 1; count <= FREE_PLAN_LIMITS.documentExports; count += 1) {
      expect(consumeUsage("free", "documentExports", storage, now)).toMatchObject({ allowed: true, used: count })
    }
    expect(consumeUsage("free", "documentExports", storage, now)).toMatchObject({ allowed: false, remaining: 0 })
  })

  it("allows exactly five local ATS checks and resets in a new month", () => {
    const storage = new MemoryStorage()
    const august = new Date("2026-08-29T04:00:00Z")
    for (let count = 0; count < FREE_PLAN_LIMITS.localAtsChecks; count += 1) {
      expect(consumeUsage("free", "localAtsChecks", storage, august).allowed).toBe(true)
    }
    expect(usageSnapshot("free", "localAtsChecks", storage, august).allowed).toBe(false)
    expect(usageSnapshot("free", "localAtsChecks", storage, new Date("2026-09-01T00:00:00Z"))).toMatchObject({ allowed: true, used: 0 })
  })

  it("does not meter paid plans and limits Free to three templates", () => {
    const storage = new MemoryStorage()
    expect(consumeUsage("pro", "documentExports", storage)).toMatchObject({ allowed: true, limit: null })
    expect(canUseTemplate("free", "modern")).toBe(true)
    expect(canUseTemplate("free", "creative")).toBe(false)
    expect(canUseTemplate("sprint", "creative")).toBe(true)
  })
})
