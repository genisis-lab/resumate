export const CONVERSION_EVENTS = new Set([
  "landing_view",
  "signup_started",
  "signup_completed",
  "email_verified",
  "checkout_started",
  "checkout_created",
  "purchase_activated",
  "ai_action_completed",
] as const)

export type ConversionEvent = typeof CONVERSION_EVENTS extends Set<infer T> ? T : never

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
