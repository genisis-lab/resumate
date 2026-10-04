import type { PlanId } from "./billing"
import type { TemplateId } from "../types/resume"
import { FREE_TEMPLATE_IDS } from "../templates/registry"

export const FREE_PLAN_LIMITS = {
  activeResumes: 1,
  documentExports: 3,
  localAtsChecks: 5,
} as const

export { FREE_TEMPLATE_IDS }

export type MeteredLocalAction = "documentExports" | "localAtsChecks"

interface MonthlyUsage {
  period: string
  documentExports: number
  localAtsChecks: number
}

export interface UsageResult {
  allowed: boolean
  limit: number | null
  used: number
  remaining: number | null
  /** Set when the server refused: "account" for this user, "network" for a shared signed-out network. */
  blockedBy?: "account" | "network"
}

const USAGE_KEY = "resumate.free-usage.v1"
let volatileUsage: MonthlyUsage | null = null

function periodKey(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`
}

function emptyUsage(period: string): MonthlyUsage {
  return { period, documentExports: 0, localAtsChecks: 0 }
}

function normalizedUsage(value: unknown, period: string): MonthlyUsage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyUsage(period)
  const row = value as Partial<MonthlyUsage>
  if (row.period !== period) return emptyUsage(period)
  return {
    period,
    documentExports: Number.isSafeInteger(row.documentExports) && Number(row.documentExports) >= 0 ? Number(row.documentExports) : 0,
    localAtsChecks: Number.isSafeInteger(row.localAtsChecks) && Number(row.localAtsChecks) >= 0 ? Number(row.localAtsChecks) : 0,
  }
}

function readUsage(storage: Storage | null, now: Date): MonthlyUsage {
  const period = periodKey(now)
  if (storage) {
    try {
      return normalizedUsage(JSON.parse(storage.getItem(USAGE_KEY) || "null"), period)
    } catch {
      volatileUsage = normalizedUsage(volatileUsage, period)
      return volatileUsage
    }
  }
  volatileUsage = normalizedUsage(volatileUsage, period)
  return volatileUsage
}

function writeUsage(storage: Storage | null, usage: MonthlyUsage): void {
  volatileUsage = usage
  if (!storage) return
  try {
    storage.setItem(USAGE_KEY, JSON.stringify(usage))
  } catch {
    // Keep a per-tab fallback when browser storage is unavailable.
  }
}

export function browserStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function usageSnapshot(
  plan: PlanId,
  action: MeteredLocalAction,
  storage: Storage | null = browserStorage(),
  now = new Date(),
): UsageResult {
  if (plan !== "free") return { allowed: true, limit: null, used: 0, remaining: null }
  const usage = readUsage(storage, now)
  const limit = FREE_PLAN_LIMITS[action]
  const used = Math.min(usage[action], limit)
  return { allowed: used < limit, limit, used, remaining: Math.max(0, limit - used) }
}

export function consumeUsage(
  plan: PlanId,
  action: MeteredLocalAction,
  storage: Storage | null = browserStorage(),
  now = new Date(),
): UsageResult {
  const current = usageSnapshot(plan, action, storage, now)
  if (plan !== "free" || !current.allowed) return current
  const usage = readUsage(storage, now)
  usage[action] += 1
  writeUsage(storage, usage)
  return { ...current, used: usage[action], remaining: Math.max(0, Number(current.limit) - usage[action]) }
}

export function canUseTemplate(plan: PlanId, template: TemplateId): boolean {
  return plan !== "free" || FREE_TEMPLATE_IDS.includes(template)
}

// Overwrite one counter in the local mirror, e.g. with the account's server count.
export function setLocalUsage(action: MeteredLocalAction, used: number, storage: Storage | null = browserStorage(), now = new Date()): void {
  const usage = readUsage(storage, now)
  usage[action] = Math.max(0, Math.floor(used))
  writeUsage(storage, usage)
}

type ServerUsage = { allowed: boolean; limit: number | null; used: number; remaining: number | null; scope: "paid" | "account" | "network" }
const UNLIMITED: UsageResult = { allowed: true, limit: null, used: 0, remaining: null }

function serverUsage(value: unknown): ServerUsage | null {
  if (!value || typeof value !== "object") return null
  const row = value as Partial<ServerUsage>
  if (typeof row.allowed !== "boolean" || (row.scope !== "paid" && row.scope !== "account" && row.scope !== "network")) return null
  return { allowed: row.allowed, limit: typeof row.limit === "number" ? row.limit : null, used: Number(row.used) || 0, remaining: typeof row.remaining === "number" ? row.remaining : null, scope: row.scope }
}

// Count a Free-plan export or ATS check. Signed-in Free accounts are counted on
// the server, so clearing browser data does not reset them. Signed-out visitors
// keep the per-browser count, backed by a looser per-network server count.
// Offline or when the server is unreachable, the browser count alone applies.
export async function consumeFreeAction(plan: PlanId, action: MeteredLocalAction, storage: Storage | null = browserStorage()): Promise<UsageResult> {
  if (plan !== "free") return UNLIMITED
  const local = usageSnapshot(plan, action, storage)
  let server: ServerUsage | null = null
  try {
    const response = await fetch("/api/usage/consume", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, localAllowed: local.allowed }),
      signal: AbortSignal.timeout(4_000),
    })
    if (response.ok || response.status === 429) server = serverUsage(await response.json())
  } catch {
    server = null
  }
  if (!server) return consumeUsage(plan, action, storage)
  if (server.scope === "paid") return UNLIMITED
  if (server.scope === "account") {
    setLocalUsage(action, server.used, storage)
    return server.allowed ? server : { ...server, blockedBy: "account" }
  }
  if (!server.allowed) return local.allowed ? { ...local, allowed: false, remaining: 0, blockedBy: "network" } : local
  return consumeUsage(plan, action, storage)
}

// Refresh the local mirror from a signed-in Free account's server counts.
export async function syncFreeUsage(plan: PlanId, storage: Storage | null = browserStorage()): Promise<boolean> {
  if (plan !== "free") return false
  try {
    const response = await fetch("/api/usage/free", { credentials: "same-origin", signal: AbortSignal.timeout(4_000) })
    if (!response.ok) return false
    const data = await response.json() as Record<string, unknown>
    let changed = false
    for (const action of ["documentExports", "localAtsChecks"] as const) {
      const row = serverUsage(data[action])
      if (row?.scope === "account") {
        setLocalUsage(action, row.used, storage)
        changed = true
      }
    }
    return changed
  } catch {
    return false
  }
}
