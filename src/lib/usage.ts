import type { PlanId } from "./billing"
import type { TemplateId } from "../types/resume"

export const FREE_PLAN_LIMITS = {
  activeResumes: 1,
  documentExports: 3,
  localAtsChecks: 5,
} as const

export const FREE_TEMPLATE_IDS = ["modern", "classic", "ats"] as const satisfies readonly TemplateId[]

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
  return plan !== "free" || (FREE_TEMPLATE_IDS as readonly TemplateId[]).includes(template)
}
