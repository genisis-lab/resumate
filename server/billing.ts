import { unwrapWebhook } from "@whop/sdk/helpers"

import { MAX_REQUEST_BYTES, json, text } from "./ai-proxy"

export type InternalPaidPlan = "sprint" | "pro"

export type BillingEnv = Cloudflare.Env & {
  WHOP_CHECKOUT_ENABLED?: string
  WHOP_BUSINESS_ID?: string
  WHOP_RESUMATE_PRODUCT_ID?: string
  WHOP_RESUMATE_SPRINT_PLAN_ID?: string
  WHOP_RESUMATE_PRO_PLAN_ID?: string
  WHOP_API_KEY?: string
  WHOP_WEBHOOK_SECRET?: string
}

interface WhopConfig {
  businessId: string
  productId: string
  planIds: Record<InternalPaidPlan, string>
}

interface SessionUser {
  id: string
  email: string
  plan: "free" | InternalPaidPlan
  emailVerifiedAt: number | null
}

const SESSION_COOKIE = "__Host-resumate_session"
const WHOP_API = "https://api.whop.com/api/v1"
const WEBHOOK_MAX_BYTES = MAX_REQUEST_BYTES
const CHECKOUT_RATE_LIMIT = 5
const CHECKOUT_RATE_WINDOW_MS = 15 * 60 * 1_000

function exactId(value: string | undefined, prefix: "biz_" | "prod_" | "plan_"): string | null {
  const normalized = value?.trim() || ""
  return new RegExp(`^${prefix}[A-Za-z0-9]{6,80}$`).test(normalized) ? normalized : null
}

export function whopConfig(env: BillingEnv): WhopConfig | null {
  const businessId = exactId(env.WHOP_BUSINESS_ID, "biz_")
  const productId = exactId(env.WHOP_RESUMATE_PRODUCT_ID, "prod_")
  const sprint = exactId(env.WHOP_RESUMATE_SPRINT_PLAN_ID, "plan_")
  const pro = exactId(env.WHOP_RESUMATE_PRO_PLAN_ID, "plan_")
  if (!businessId || !productId || !sprint || !pro || sprint === pro) return null
  return { businessId, productId, planIds: { sprint, pro } }
}

function cookieValue(request: Request, name: string): string | null {
  for (const pair of (request.headers.get("cookie") || "").split(";")) {
    const [key, ...value] = pair.trim().split("=")
    if (key === name) return value.join("=") || null
  }
  return null
}

async function sha256(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))
  let binary = ""
  for (const byte of digest) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

export async function verifiedSessionUser(request: Request, env: BillingEnv): Promise<SessionUser | null> {
  const token = cookieValue(request, SESSION_COOKIE)
  if (!token) return null
  return env.DB.prepare(
    `SELECT u.id, u.email, u.plan, u.email_verified_at AS emailVerifiedAt
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
  ).bind(await sha256(token), Date.now()).first<SessionUser>()
}

export async function createWhopCheckout(
  request: Request,
  env: BillingEnv,
  plan: InternalPaidPlan,
): Promise<Response> {
  const config = whopConfig(env)
  const apiKey = env.WHOP_API_KEY?.trim() || ""
  if (String(env.WHOP_CHECKOUT_ENABLED) !== "true" || !config || !apiKey || apiKey.length > 300) {
    return text("Checkout is not configured", 503)
  }
  const user = await verifiedSessionUser(request, env)
  if (!user) return text("Sign in to upgrade", 401)
  if (!user.emailVerifiedAt) return text("Verify your email before upgrading", 403)

  const now = Date.now()
  const existing = await env.DB.prepare(
    `SELECT status, current_period_end AS currentPeriodEnd
     FROM billing_subscriptions WHERE user_id = ? AND provider = 'whop'`,
  ).bind(user.id).first<{ status: string; currentPeriodEnd: number | null }>()
  if (existing && membershipGrantsAccess(existing.status, existing.currentPeriodEnd, now)) {
    return text("You already have an active paid plan. Manage billing from your account before changing plans.", 409)
  }

  const rate = await env.DB.prepare(
    `INSERT INTO auth_rate_limits (key, attempts, window_started_at) VALUES (?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET
       attempts = CASE WHEN ? - window_started_at >= ? THEN 1 ELSE attempts + 1 END,
       window_started_at = CASE WHEN ? - window_started_at >= ? THEN ? ELSE window_started_at END
     RETURNING attempts, window_started_at AS windowStartedAt`,
  ).bind(
    `billing:checkout:${user.id}`, now,
    now, CHECKOUT_RATE_WINDOW_MS,
    now, CHECKOUT_RATE_WINDOW_MS, now,
  ).first<{ attempts: number; windowStartedAt: number }>()
  if (!rate) return text("Checkout is temporarily unavailable", 503)
  if (rate.attempts > CHECKOUT_RATE_LIMIT) {
    const retryAfter = Math.max(1, Math.ceil((rate.windowStartedAt + CHECKOUT_RATE_WINDOW_MS - now) / 1_000))
    return text("Too many checkout attempts. Try again later.", 429, { "Retry-After": String(retryAfter) })
  }

  const planId = config.planIds[plan]
  const origin = new URL(request.url).origin
  const upstream = await fetch(`${WHOP_API}/checkout_configurations`, {
    method: "POST",
    headers: {
      "Api-Version-Date": "2026-08-25-2",
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      company_id: config.businessId,
      plan_id: planId,
      metadata: {
        resumate_user_id: user.id,
        resumate_plan: plan,
        resumate_product_id: config.productId,
      },
      mode: "payment",
      redirect_url: `${origin}/account?checkout=return`,
    }),
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  })
  if (!upstream.ok) return text("Checkout is temporarily unavailable", 502)
  const data: unknown = await upstream.json()
  if (!data || typeof data !== "object" || Array.isArray(data)) return text("Checkout returned an invalid response", 502)
  const responseData = data as Record<string, unknown>
  const checkoutId = responseData.id
  const responsePlan = objectValue(responseData.plan)
  const responseMetadata = objectValue(responseData.metadata)
  const purchaseUrl = responseData.purchase_url
  if (typeof checkoutId !== "string" || !/^ch_[A-Za-z0-9]{6,100}$/.test(checkoutId)
    || !matchesExpectedId([responseData.company_id, responseData.account_id], config.businessId)
    || responsePlan?.id !== planId
    || responseMetadata?.resumate_user_id !== user.id
    || responseMetadata?.resumate_plan !== plan
    || responseMetadata?.resumate_product_id !== config.productId
    || typeof purchaseUrl !== "string" || !safeWhopPurchaseUrl(purchaseUrl)) {
    return text("Checkout returned an invalid response", 502)
  }
  return json({
    provider: "whop",
    checkoutId,
    planId,
    purchaseUrl,
  })
}

function safeWhopPurchaseUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.hostname === "whop.com" && !url.username && !url.password
  } catch {
    return false
  }
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function consistentString(values: unknown[], pattern: RegExp): string | null {
  const present = values.filter((value) => value !== undefined && value !== null)
  if (!present.length || present.some((value) => typeof value !== "string" || !pattern.test(value))) return null
  const first = present[0] as string
  return present.every((value) => value === first) ? first : null
}

function matchesExpectedId(values: unknown[], expected: string): boolean {
  const present = values.filter((value) => value !== undefined && value !== null)
  return present.length > 0 && present.every((value) => value === expected)
}

function dateMillis(value: unknown): number | null {
  if (value === null) return null
  if (typeof value !== "string") return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

const MEMBERSHIP_EVENTS = new Set([
  "membership.activated",
  "membership.cancel_at_period_end_changed",
  "membership.deactivated",
])
const MEMBERSHIP_STATUSES = new Set([
  "trialing", "active", "past_due", "completed", "canceled", "expired", "unresolved", "drafted", "canceling",
])

interface NormalizedMembershipEvent {
  eventId: string
  eventType: string
  eventTime: number
  providerSubscriptionId: string
  productId: string
  providerPlanId: string
  userId: string
  internalPlan: InternalPaidPlan
  status: string
  cancelAtPeriodEnd: number
  currentPeriodStart: number | null
  currentPeriodEnd: number | null
}

function metadataString(sources: Array<Record<string, unknown> | null>, key: string): string | null {
  const values = sources
    .filter((source) => source && Object.prototype.hasOwnProperty.call(source, key))
    .map((source) => source?.[key])
  if (!values.length
    || values.some((value) => typeof value !== "string" || value.length === 0 || value.length > 160)
    || values.some((value) => value !== values[0])) return null
  return values[0] as string
}

export function normalizeWhopMembershipEvent(event: unknown, config: WhopConfig): NormalizedMembershipEvent | null {
  const envelope = objectValue(event)
  const data = objectValue(envelope?.data)
  if (!envelope || !data || envelope.api_version !== "v1") return null

  const eventId = envelope.id
  const eventType = envelope.type
  if (typeof eventId !== "string" || !/^(?:msg|evt)_[A-Za-z0-9_-]{4,160}$/.test(eventId)
    || typeof eventType !== "string" || !MEMBERSHIP_EVENTS.has(eventType)) return null

  const nestedCompany = objectValue(data.company)
  const nestedProduct = objectValue(data.product)
  const nestedPlan = objectValue(data.plan)
  if (!matchesExpectedId([envelope.company_id, envelope.account_id], config.businessId)
    || !matchesExpectedId([nestedCompany?.id, data.company_id, data.account_id], config.businessId)) return null

  const productId = consistentString([nestedProduct?.id, data.product_id], /^prod_[A-Za-z0-9]{6,80}$/)
  const providerPlanId = consistentString([nestedPlan?.id, data.plan_id], /^plan_[A-Za-z0-9]{6,80}$/)
  const providerSubscriptionId = consistentString([data.id], /^mem_[A-Za-z0-9_-]{4,160}$/)
  if (productId !== config.productId || !providerPlanId || !providerSubscriptionId) return null

  const metadataSources = [
    objectValue(data.metadata),
    objectValue(nestedPlan?.metadata),
    objectValue(nestedProduct?.metadata),
  ]
  const userId = metadataString(metadataSources, "resumate_user_id")
  const internalPlan = metadataString(metadataSources, "resumate_plan")
  const metadataProductId = metadataString(metadataSources, "resumate_product_id")
  if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)
    || metadataProductId !== config.productId
    || (internalPlan !== "sprint" && internalPlan !== "pro")
    || providerPlanId !== config.planIds[internalPlan]) return null

  const rawStatus = typeof data.status === "string" && MEMBERSHIP_STATUSES.has(data.status) ? data.status : null
  const cancelAtPeriodEnd = data.cancel_at_period_end === true ? 1 : 0
  const status = eventType === "membership.deactivated"
    ? "deactivated"
    : rawStatus || (eventType === "membership.activated" ? "active" : cancelAtPeriodEnd ? "canceling" : "active")
  const eventTime = dateMillis(envelope.timestamp)
  const rawPeriodStart = data.renewal_period_start ?? data.current_period_start ?? null
  const rawPeriodEnd = data.renewal_period_end ?? data.current_period_end ?? null
  const currentPeriodStart = dateMillis(rawPeriodStart)
  const currentPeriodEnd = dateMillis(rawPeriodEnd)
  if (eventTime === null
    || (rawPeriodStart !== null && currentPeriodStart === null)
    || (rawPeriodEnd !== null && currentPeriodEnd === null)) return null

  return {
    eventId,
    eventType,
    eventTime,
    providerSubscriptionId,
    productId,
    providerPlanId,
    userId,
    internalPlan,
    status,
    cancelAtPeriodEnd,
    currentPeriodStart,
    currentPeriodEnd,
  }
}

function activeMembershipStatus(status: string): boolean {
  return status === "active" || status === "trialing" || status === "completed" || status === "past_due" || status === "canceling"
}

export function membershipGrantsAccess(status: string, currentPeriodEnd: number | null, now = Date.now()): boolean {
  return activeMembershipStatus(status) && (currentPeriodEnd === null || currentPeriodEnd > now)
}

export async function processWhopWebhook(request: Request, env: BillingEnv): Promise<Response> {
  const config = whopConfig(env)
  const webhookSecret = env.WHOP_WEBHOOK_SECRET?.trim() || ""
  if (!config || !/^(?:ws|whsec)_[A-Za-z0-9_-]{10,200}$/.test(webhookSecret)) return text("Webhook is not configured", 503)
  if (request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    return text("Send a JSON request body", 415)
  }
  const declared = Number(request.headers.get("Content-Length") || 0)
  if (!Number.isFinite(declared) || declared < 0 || declared > WEBHOOK_MAX_BYTES) return text("Input too large", 413)
  const raw = await request.text()
  if (new TextEncoder().encode(raw).byteLength > WEBHOOK_MAX_BYTES) return text("Input too large", 413)

  let event: unknown
  try {
    event = unwrapWebhook(raw, {
      headers: Object.fromEntries(request.headers.entries()),
      key: webhookSecret,
    })
  } catch {
    return text("Invalid webhook signature", 400)
  }

  const normalized = normalizeWhopMembershipEvent(event, config)
  if (!normalized) return text("Unsupported or invalid webhook event", 202)
  if (request.headers.get("webhook-id") !== normalized.eventId) return text("Webhook delivery ID mismatch", 400)
  const {
    eventId,
    eventType,
    eventTime,
    providerSubscriptionId,
    productId,
    providerPlanId,
    userId,
    internalPlan,
    status,
    cancelAtPeriodEnd,
    currentPeriodStart,
    currentPeriodEnd,
  } = normalized
  const user = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(userId).first<{ id: string }>()
  if (!user) return text("Webhook account mapping was not found", 409)

  const inserted = await env.DB.prepare(
    `INSERT OR IGNORE INTO billing_webhook_events
     (provider, event_id, event_type, payload_hash, received_at)
     VALUES ('whop', ?, ?, ?, ?)`,
  ).bind(eventId, eventType, await sha256Hex(raw), Date.now()).run()
  if ((inserted.meta.changes || 0) === 0) return new Response(null, { status: 204 })

  try {
    await env.DB.prepare(
      `INSERT INTO billing_subscriptions
     (user_id, provider, provider_subscription_id, provider_product_id, provider_plan_id,
      internal_plan, status, current_period_start, current_period_end, cancel_at_period_end, updated_at)
     VALUES (?, 'whop', ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, provider) DO UPDATE SET
       provider_subscription_id = excluded.provider_subscription_id,
       provider_product_id = excluded.provider_product_id,
       provider_plan_id = excluded.provider_plan_id,
       internal_plan = excluded.internal_plan,
       status = excluded.status,
       current_period_start = excluded.current_period_start,
       current_period_end = excluded.current_period_end,
       cancel_at_period_end = excluded.cancel_at_period_end,
       updated_at = excluded.updated_at
     WHERE excluded.updated_at >= billing_subscriptions.updated_at`,
    ).bind(
      userId, providerSubscriptionId, productId, providerPlanId, internalPlan,
      status, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, eventTime,
    ).run()

    const latest = await env.DB.prepare(
      `SELECT internal_plan AS internalPlan, status, current_period_end AS currentPeriodEnd
       FROM billing_subscriptions WHERE user_id = ? AND provider = 'whop'`,
    ).bind(userId).first<{ internalPlan: InternalPaidPlan; status: string; currentPeriodEnd: number | null }>()
    const grantedPlan = latest && membershipGrantsAccess(latest.status, latest.currentPeriodEnd) ? latest.internalPlan : "free"
    const now = Date.now()
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET plan = ?, updated_at = ? WHERE id = ?").bind(grantedPlan, now, userId),
      ...(grantedPlan === "free"
        ? [env.DB.prepare("DELETE FROM entitlements WHERE user_id = ? AND source = 'whop'").bind(userId)]
        : [env.DB.prepare(
          `INSERT INTO entitlements (user_id, entitlement_key, source, valid_until, updated_at)
           VALUES (?, 'ai:hosted', 'whop', ?, ?)
           ON CONFLICT(user_id, entitlement_key) DO UPDATE SET
             source = excluded.source, valid_until = excluded.valid_until, updated_at = excluded.updated_at`,
        ).bind(userId, latest?.currentPeriodEnd ?? null, now)]),
      env.DB.prepare(
        "UPDATE billing_webhook_events SET processed_at = ? WHERE provider = 'whop' AND event_id = ?",
      ).bind(now, eventId),
    ])
  } catch (error) {
    await env.DB.prepare(
      "DELETE FROM billing_webhook_events WHERE provider = 'whop' AND event_id = ? AND processed_at IS NULL",
    ).bind(eventId).run()
    throw error
  }
  return new Response(null, { status: 204 })
}
