// Anonymous visitor keys for rate limits and Free-plan counters. The key is an
// HMAC of the IP address, scope and month, so the raw address is never stored
// and keys cannot be linked across months. Set USAGE_HASH_SECRET in production.
export type VisitorEnv = { USAGE_HASH_SECRET?: string }

const encoder = new TextEncoder()

export function monthKey(now = new Date()): string {
  return now.toISOString().slice(0, 7)
}

export async function visitorKey(request: Request, env: VisitorEnv, scope: string, now = new Date()): Promise<string> {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown"
  const secret = env.USAGE_HASH_SECRET?.trim() || "resumate-visitor-key"
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(`${scope}:${monthKey(now)}:${ip}`)))
  let binary = ""
  for (const byte of digest.slice(0, 18)) binary += String.fromCharCode(byte)
  return `v:${btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")}`
}

// Fixed-window counter on auth_rate_limits. Returns true when over the limit.
export async function overRateLimit(db: D1Database, key: string, limit: number, windowMs: number, now = Date.now()): Promise<boolean> {
  await db.prepare(
    `INSERT INTO auth_rate_limits (key, attempts, window_started_at) VALUES (?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET
       attempts = CASE WHEN ? - window_started_at >= ? THEN 1 ELSE attempts + 1 END,
       window_started_at = CASE WHEN ? - window_started_at >= ? THEN ? ELSE window_started_at END`,
  ).bind(key, now, now, windowMs, now, windowMs, now).run()
  const rate = await db.prepare("SELECT attempts FROM auth_rate_limits WHERE key = ?").bind(key).first<{ attempts: number }>()
  return !rate || rate.attempts > limit
}
