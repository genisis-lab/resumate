import { isAdminUser, type AiEnv } from "./ai-proxy"
import { verifiedSessionUser } from "./billing"
import { monthKey, visitorKey, type VisitorEnv } from "./visitor"

export type FreeUsageEnv = AiEnv & VisitorEnv
export type FreeAction = "documentExports" | "localAtsChecks"

// Mirrors FREE_PLAN_LIMITS in src/lib/usage.ts. These are per person per month.
export const FREE_LIMITS: Record<FreeAction, number> = { documentExports: 3, localAtsChecks: 5 }
// Signed-out visitors are counted per network, which many people can share
// (offices, campuses, mobile carriers), so that backstop is looser than the
// per-person limit the browser also enforces.
export const ANONYMOUS_NETWORK_LIMITS: Record<FreeAction, number> = { documentExports: 10, localAtsChecks: 20 }

export interface FreeUsageResult {
  allowed: boolean
  limit: number | null
  used: number
  remaining: number | null
  scope: "paid" | "account" | "network"
}

export function freeAction(value: unknown): FreeAction | null {
  return value === "documentExports" || value === "localAtsChecks" ? value : null
}

async function subjectFor(request: Request, env: FreeUsageEnv): Promise<{ key: string; scope: FreeUsageResult["scope"] } | { paid: true }> {
  const user = await verifiedSessionUser(request, env)
  if (user) {
    if (user.plan === "sprint" || user.plan === "pro" || isAdminUser(env, user)) return { paid: true }
    return { key: `u:${user.id}`, scope: "account" }
  }
  return { key: await visitorKey(request, env, "free-usage"), scope: "network" }
}

function limitFor(action: FreeAction, scope: FreeUsageResult["scope"]): number {
  return scope === "network" ? ANONYMOUS_NETWORK_LIMITS[action] : FREE_LIMITS[action]
}

export async function readFreeUsage(request: Request, env: FreeUsageEnv): Promise<Record<FreeAction, FreeUsageResult>> {
  const subject = await subjectFor(request, env)
  if ("paid" in subject) {
    const unlimited: FreeUsageResult = { allowed: true, limit: null, used: 0, remaining: null, scope: "paid" }
    return { documentExports: unlimited, localAtsChecks: unlimited }
  }
  const rows = await env.DB.prepare(
    "SELECT action, used FROM free_usage_counters WHERE subject_key = ? AND period_key = ?",
  ).bind(subject.key, monthKey()).all<{ action: FreeAction; used: number }>()
  const usedFor = (action: FreeAction) => Number(rows.results?.find((row) => row.action === action)?.used) || 0
  const result = (action: FreeAction): FreeUsageResult => {
    const limit = limitFor(action, subject.scope)
    const used = Math.min(usedFor(action), limit)
    return { allowed: used < limit, limit, used, remaining: limit - used, scope: subject.scope }
  }
  return { documentExports: result("documentExports"), localAtsChecks: result("localAtsChecks") }
}

// Atomically count one use if the subject is still under its limit. A
// signed-out browser that is already over its own limit is refused without
// spending the shared network allowance.
export async function consumeFreeUsage(request: Request, env: FreeUsageEnv, action: FreeAction, localAllowed = true): Promise<FreeUsageResult> {
  const subject = await subjectFor(request, env)
  if ("paid" in subject) return { allowed: true, limit: null, used: 0, remaining: null, scope: "paid" }
  const limit = limitFor(action, subject.scope)
  if (subject.scope === "network" && !localAllowed) return { allowed: false, limit, used: limit, remaining: 0, scope: subject.scope }
  const row = await env.DB.prepare(
    `INSERT INTO free_usage_counters (subject_key, period_key, action, used, updated_at)
     VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(subject_key, period_key, action) DO UPDATE SET used = used + 1, updated_at = excluded.updated_at
     WHERE free_usage_counters.used < ?
     RETURNING used`,
  ).bind(subject.key, monthKey(), action, Date.now(), limit).first<{ used: number }>()
  if (!row) return { allowed: false, limit, used: limit, remaining: 0, scope: subject.scope }
  const used = Number(row.used) || limit
  return { allowed: true, limit, used, remaining: Math.max(0, limit - used), scope: subject.scope }
}
