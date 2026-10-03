export const CONVERSION_EVENTS = new Set([
  "landing_view",
  "signup_started",
  "signup_completed",
  "email_verified",
  "pricing_view",
  "template_previewed",
  "upgrade_prompt_viewed",
  "upgrade_prompt_clicked",
  "checkout_started",
  "checkout_created",
  "purchase_activated",
  "ai_action_completed",
  "export_completed",
  "export_blocked",
  "sync_enabled",
] as const)

export type ConversionEvent = typeof CONVERSION_EVENTS extends Set<infer T> ? T : never

// Events the browser may report. Account, checkout and purchase events are
// recorded only by the server code that performs those actions.
export const BROWSER_EVENTS = new Set<ConversionEvent>([
  "landing_view",
  "signup_started",
  "pricing_view",
  "template_previewed",
  "upgrade_prompt_viewed",
  "upgrade_prompt_clicked",
  "ai_action_completed",
  "export_completed",
  "export_blocked",
])

// Where an upgrade prompt was shown. Kept in sync with src/lib/analytics.ts.
export const UPGRADE_SOURCES = new Set([
  "export_premium_template",
  "export_limit",
  "ats_limit",
  "ai_locked",
  "ai_limit",
  "template_gallery",
  "builder_template",
  "builder_banner",
  "account",
  "landing",
  "nav",
  "sync",
  "languages",
] as const)

export type UpgradeSource = typeof UPGRADE_SOURCES extends Set<infer T> ? T : never

export function upgradeSource(value: unknown): UpgradeSource | null {
  return typeof value === "string" && UPGRADE_SOURCES.has(value as UpgradeSource) ? value as UpgradeSource : null
}

// Only short, enumerable labels are accepted from the browser, so analytics
// can never carry resume text, names, or free-form input.
export function browserMetadata(body: Record<string, unknown>): Record<string, string> | null {
  const metadata: Record<string, string> = {}
  const source = upgradeSource(body.source)
  if (source) metadata.source = source
  if (typeof body.template === "string" && /^[a-z][a-z0-9-]{1,30}$/.test(body.template)) metadata.template = body.template
  if (body.plan === "free" || body.plan === "sprint" || body.plan === "pro") metadata.plan = body.plan
  if (body.format === "pdf" || body.format === "docx" || body.format === "txt") metadata.format = body.format
  return Object.keys(metadata).length ? metadata : null
}

export async function trackConversion(
  env: { DB: D1Database },
  eventName: ConversionEvent,
  userId: string | null = null,
  metadata: Record<string, string> | null = null,
): Promise<void> {
  const serialized = metadata ? JSON.stringify(metadata) : null
  if (serialized && serialized.length > 1_000) return
  try {
    await env.DB.prepare(
      "INSERT INTO conversion_events (id, event_name, user_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?)",
    ).bind(crypto.randomUUID(), eventName, userId, serialized, Date.now()).run()
  } catch (error) {
    console.error(JSON.stringify({ event: "conversion_tracking_failed", name: eventName, reason: error instanceof Error ? error.name : "unknown" }))
  }
}
