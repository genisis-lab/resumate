export type AiEnv = Cloudflare.Env & {
  AI?: Ai
  AI_API_KEY?: string
  AI_API_URL?: string
  AI_MODEL?: string
  /** Optional Workers AI model override; must be one of HOSTED_MODEL_ALLOWLIST. */
  AI_HOSTED_MODEL?: string
  /** Optional Workers AI model for prose-heavy tasks; defaults to gpt-oss-120b. */
  AI_WRITING_MODEL?: string
  ADMIN_USER_IDS?: string
  ADMIN_EMAILS?: string
}

export interface ClientAiOptions {
  clientKey?: string
  clientUrl?: string
  clientModel?: string
}

export interface ExternalAiSettings {
  kind: "external"
  key: string
  url: string
  model: string
}

export interface WorkersAiSettings {
  kind: "workers-ai"
  binding: Ai
  model: HostedModel
  /** Model used when a task is routed to the writing profile. */
  writingModel?: HostedModel
  /** Model retried automatically when `model` errors or returns invalid output. */
  fallbackModel?: HostedModel
}

export type TaskProfile = "writing" | "precise"

export type AiSettings = ExternalAiSettings | WorkersAiSettings

export interface OpenAiMessage {
  role: string
  content: string
}

export interface JsonSchema {
  type: "object"
  additionalProperties: false
  properties: Record<string, unknown>
  required: string[]
}

export const MAX_REQUEST_BYTES = 128 * 1024
export const HOSTED_AI_MODEL = "@cf/qwen/qwen3-30b-a3b-fp8" as const
// Workers AI models this app knows how to call. Qwen3 30B (MoE, 3B active) is
// the precise model: the cheapest capable option per neuron, used for scoring,
// extraction, proofreading and bullet rewrites. gpt-oss-120b is the writing
// model for summaries, letters, emails and coaching drafts; it costs roughly 2x
// per output token and 7x per input token, and falls back to the precise model
// on errors. Override either with AI_HOSTED_MODEL / AI_WRITING_MODEL and check
// the result with the admin console's AI smoke test.
export const HOSTED_MODEL_ALLOWLIST = [
  HOSTED_AI_MODEL,
  "@cf/openai/gpt-oss-120b",
  "@cf/openai/gpt-oss-20b",
  "@cf/meta/llama-4-scout-17b-16e-instruct",
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/ibm-granite/granite-4.0-h-micro",
] as const
export type HostedModel = typeof HOSTED_MODEL_ALLOWLIST[number]
export const DEFAULT_WRITING_MODEL: HostedModel = "@cf/openai/gpt-oss-120b"
const DEFAULT_MAX_TOKENS = 1_600
export const HOSTED_MONTHLY_LIMITS = { sprint: 40, pro: 150 } as const
const MAX_PROVIDER_BYTES = 512 * 1024
const PROVIDER_TIMEOUT_MS = 25_000
// gpt-oss always reasons before answering, so give it more time.
const REASONING_TIMEOUT_MS = 45_000
const BYOK_RATE_LIMIT = 20
const BYOK_RATE_WINDOW_MS = 60_000
const HOSTED_BURST_LIMIT = 10
const HOSTED_BURST_WINDOW_MS = 60_000
// Covers a primary attempt, a corrective retry, and a model fallback.
const STALE_RESERVATION_MS = 3 * 60_000
const SESSION_COOKIE = "__Host-resumate_session"

const PROVIDER_ENDPOINTS = new Set([
  "https://api.openai.com/v1/chat/completions",
  "https://api.groq.com/openai/v1/chat/completions",
  "https://openrouter.ai/api/v1/chat/completions",
  "https://api.openrouter.ai/api/v1/chat/completions",
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  "https://api.deepseek.com/v1/chat/completions",
])

export class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

function responseHeaders(contentType: string) {
  return {
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; sandbox",
    "Content-Type": contentType,
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  }
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: responseHeaders("application/json; charset=utf-8"),
  })
}

export function text(message: string, status: number, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(responseHeaders("text/plain; charset=utf-8"))
  for (const [key, value] of new Headers(extraHeaders)) headers.set(key, value)
  return new Response(message, { status, headers })
}

export function enforcePostAndOrigin(request: Request): Response | null {
  if (request.method !== "POST") return text("Method not allowed", 405, { Allow: "POST" })
  if (!sameOrigin(request)) return text("Forbidden", 403)
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
    return text("Send a JSON request body", 415)
  }
  return null
}

function sameOrigin(request: Request): boolean {
  const fetchSite = request.headers.get("Sec-Fetch-Site")
  if (fetchSite && fetchSite !== "same-origin") return false
  const source = request.headers.get("Origin") || request.headers.get("Referer")
  if (!source) return false
  try {
    return new URL(source).origin === new URL(request.url).origin
  } catch {
    return false
  }
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

async function incrementQuota(env: AiEnv, key: string, windowMs: number): Promise<{ attempts: number; windowStartedAt: number } | null> {
  const now = Date.now()
  const normalizedKey = key.slice(0, 400)
  await env.DB.prepare(
    `INSERT INTO auth_rate_limits (key, attempts, window_started_at) VALUES (?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET
       attempts = CASE WHEN ? - window_started_at >= ? THEN 1 ELSE attempts + 1 END,
       window_started_at = CASE WHEN ? - window_started_at >= ? THEN ? ELSE window_started_at END`,
  ).bind(normalizedKey, now, now, windowMs, now, windowMs, now).run()
  return env.DB.prepare(
    "SELECT attempts, window_started_at AS windowStartedAt FROM auth_rate_limits WHERE key = ?",
  ).bind(normalizedKey).first<{ attempts: number; windowStartedAt: number }>()
}

function adminValues(value = ""): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminUser(env: AiEnv, user: { id: string; email: string; emailVerifiedAt: number | null }): boolean {
  const userIdAllowed = adminValues(env.ADMIN_USER_IDS).includes(user.id.toLowerCase())
  const verifiedEmailAllowed = Boolean(user.emailVerifiedAt)
    && adminValues(env.ADMIN_EMAILS).includes(user.email.toLowerCase())
  return userIdAllowed || verifiedEmailAllowed
}

function utcMonthKey(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`
}

function secondsUntilNextUtcMonth(now = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  return Math.max(1, Math.ceil((next - now.getTime()) / 1_000))
}

export interface HostedActionReservation {
  readonly remaining: number
  finalize(success: boolean): Promise<void>
}

async function reserveMonthlyAction(
  env: AiEnv,
  userId: string,
  limit: number,
): Promise<HostedActionReservation | null> {
  const now = Date.now()
  const periodKey = utcMonthKey(new Date(now))
  await env.DB.prepare(
    `UPDATE ai_action_reservations
     SET status = 'released', finalized_at = ?
     WHERE user_id = ? AND period_key = ? AND status = 'reserved' AND created_at < ?`,
  ).bind(now, userId, periodKey, now - STALE_RESERVATION_MS).run()

  const reservationId = crypto.randomUUID()
  const row = await env.DB.prepare(
    `INSERT INTO ai_action_reservations (id, user_id, period_key, status, created_at)
     SELECT ?, ?, ?, 'reserved', ?
     WHERE (
       SELECT COUNT(*) FROM ai_action_reservations
       WHERE user_id = ? AND period_key = ? AND status IN ('reserved', 'committed')
     ) < ?
     RETURNING (
       SELECT COUNT(*) FROM ai_action_reservations
       WHERE user_id = ? AND period_key = ? AND status IN ('reserved', 'committed')
     ) AS used`,
  ).bind(
    reservationId, userId, periodKey, now,
    userId, periodKey, limit,
    userId, periodKey,
  ).first<{ used: number }>()
  if (!row) return null

  let finalized = false
  return {
    remaining: Math.max(0, limit - row.used),
    async finalize(success: boolean) {
      if (finalized) return
      const result = await env.DB.prepare(
        `UPDATE ai_action_reservations
         SET status = ?, finalized_at = ?
         WHERE id = ? AND user_id = ? AND status = 'reserved'`,
      ).bind(success ? "committed" : "released", Date.now(), reservationId, userId).run()
      if (!result.success) throw new Error("AI action finalization failed")
      finalized = true
    },
  }
}

export async function hostedAiUsage(request: Request, env: AiEnv): Promise<{
  plan: "free" | "sprint" | "pro"
  isAdmin: boolean
  unlimited: boolean
  limit: number | null
  used: number
  remaining: number | null
  periodKey: string
  resetsAt: string
} | null> {
  const sessionToken = cookieValue(request, SESSION_COOKIE)
  if (!sessionToken) return null
  const user = await env.DB.prepare(
     `SELECT u.id, u.email, u.email_verified_at AS emailVerifiedAt, u.plan
      FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`,
  ).bind(await sha256(sessionToken), Date.now()).first<{ id: string; email: string; emailVerifiedAt: number | null; plan: "free" | "sprint" | "pro" }>()
  if (!user) return null
  const isAdmin = isAdminUser(env, user)

  const now = new Date()
  const periodKey = utcMonthKey(now)
  await env.DB.prepare(
    `UPDATE ai_action_reservations
     SET status = 'released', finalized_at = ?
     WHERE user_id = ? AND period_key = ? AND status = 'reserved' AND created_at < ?`,
  ).bind(now.getTime(), user.id, periodKey, now.getTime() - STALE_RESERVATION_MS).run()
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS used FROM ai_action_reservations
     WHERE user_id = ? AND period_key = ? AND status IN ('reserved', 'committed')`,
  ).bind(user.id, periodKey).first<{ used: number }>()
  const limit = isAdmin ? null : user.plan === "free" ? 0 : HOSTED_MONTHLY_LIMITS[user.plan]
  const used = Math.max(0, Number(row?.used) || 0)
  return {
    plan: user.plan,
    isAdmin,
    unlimited: isAdmin,
    limit,
    used,
    remaining: limit === null ? null : Math.max(0, limit - used),
    periodKey,
    resetsAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString(),
  }
}

export async function withActionReservation(
  reservation: HostedActionReservation | null,
  operation: () => Promise<Response>,
): Promise<Response> {
  try {
    const response = await operation()
    await reservation?.finalize(response.ok)
    if (reservation && response.ok) response.headers.set("X-Resumate-AI-Actions-Remaining", String(reservation.remaining))
    return response
  } catch (error) {
    try {
      await reservation?.finalize(false)
    } catch (finalizeError) {
      console.error(JSON.stringify({
        event: "ai_action_release_failed",
        reason: finalizeError instanceof Error ? finalizeError.name : "unknown",
      }))
    }
    throw error
  }
}

// Persistent, provider-neutral quota enforcement. BYOK requests receive a
// short abuse limit. Hosted requests require a verified paid account, a burst
// limit, and one atomic action reservation in the user's UTC billing month.
export async function enforceAiQuota(
  request: Request,
  env: AiEnv,
  action: string,
  usesClientKey: boolean,
): Promise<Response | HostedActionReservation | null> {
  try {
    if (usesClientKey) {
      const ip = request.headers.get("CF-Connecting-IP") || "unknown"
      const row = await incrementQuota(env, `ai:byok:${action}:${ip}`, BYOK_RATE_WINDOW_MS)
      if (!row) return text("AI quota unavailable", 503)
      if (row.attempts > BYOK_RATE_LIMIT) {
        const retryAfter = Math.max(1, Math.ceil((row.windowStartedAt + BYOK_RATE_WINDOW_MS - Date.now()) / 1000))
        return text("Too many AI requests", 429, { "Retry-After": String(retryAfter) })
      }
      return null
    }

    const sessionToken = cookieValue(request, SESSION_COOKIE)
    if (!sessionToken) return text("Sign in with a verified account to use hosted AI", 401)
    const user = await env.DB.prepare(
      `SELECT u.id, u.email, u.plan, u.email_verified_at AS emailVerifiedAt
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    ).bind(await sha256(sessionToken), Date.now()).first<{ id: string; email: string; plan: "free" | "sprint" | "pro"; emailVerifiedAt: number | null }>()
    if (!user) return text("Sign in with a verified account to use hosted AI", 401)
    if (!user.emailVerifiedAt) return text("Verify your email to use hosted AI", 403)

    const isAdmin = isAdminUser(env, user)
    if (!isAdmin && user.plan === "free") return text("Hosted AI requires Career Sprint or Pro", 403)
    const paidPlan = user.plan === "sprint" || user.plan === "pro" ? user.plan : null

    const burst = await incrementQuota(env, `ai:hosted:burst:${user.id}`, HOSTED_BURST_WINDOW_MS)
    if (!burst) return text("AI quota unavailable", 503)
    if (burst.attempts > HOSTED_BURST_LIMIT) {
      const retryAfter = Math.max(1, Math.ceil((burst.windowStartedAt + HOSTED_BURST_WINDOW_MS - Date.now()) / 1000))
      return text("Too many AI requests", 429, { "Retry-After": String(retryAfter) })
    }

    if (isAdmin) return null
    if (!paidPlan) return text("Hosted AI requires Career Sprint or Pro", 403)

    const limit = HOSTED_MONTHLY_LIMITS[paidPlan]
    const reservation = await reserveMonthlyAction(env, user.id, limit)
    if (!reservation) return text("Hosted AI monthly allowance reached", 429, { "Retry-After": String(secondsUntilNextUtcMonth()) })
    return reservation
  } catch (error) {
    console.error(JSON.stringify({ event: "ai_quota_failed", reason: error instanceof Error ? error.name : "unknown" }))
    return text("AI quota unavailable", 503)
  }
}

export async function readBoundedJson<T>(request: Request): Promise<T> {
  const rawLength = request.headers.get("Content-Length")
  if (rawLength) {
    const declaredLength = Number(rawLength)
    if (!Number.isFinite(declaredLength) || declaredLength < 0) throw new RequestError("Invalid Content-Length", 400)
    if (declaredLength > MAX_REQUEST_BYTES) throw new RequestError("Input too large", 413)
  }
  if (!request.body) throw new RequestError("Invalid JSON body", 400)

  const bytes = await readBoundedStream(request.body, MAX_REQUEST_BYTES, "Input too large", 413)
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T
  } catch {
    throw new RequestError("Invalid JSON body", 400)
  }
}

async function readBoundedStream(
  stream: ReadableStream<Uint8Array>,
  maximumBytes: number,
  message: string,
  status: number,
): Promise<Uint8Array> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maximumBytes) {
        await reader.cancel()
        throw new RequestError(message, status)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const joined = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    joined.set(chunk, offset)
    offset += chunk.byteLength
  }
  return joined
}

function exactProviderEndpoint(value: string): string | null {
  try {
    const parsed = new URL(value)
    if (parsed.username || parsed.password || parsed.search || parsed.hash) return null
    const normalized = `${parsed.origin}${parsed.pathname}`
    return PROVIDER_ENDPOINTS.has(normalized) ? normalized : null
  } catch {
    return null
  }
}

function validModel(value: string) {
  return value.length >= 1 && value.length <= 160 && /^[A-Za-z0-9._:/+-]+$/.test(value)
}

export function aiSettings(body: ClientAiOptions, env: AiEnv): AiSettings | null {
  const suppliedKey = typeof body.clientKey === "string" ? body.clientKey.trim() : ""
  const defaultModel = env.AI_MODEL?.trim() || "gpt-4o-mini"
  if (!validModel(defaultModel)) return null

  if (suppliedKey) {
    if (suppliedKey.length > 400 || /[\u0000-\u001f\u007f]/.test(suppliedKey)) return null
    const endpoint = exactProviderEndpoint(
      typeof body.clientUrl === "string" && body.clientUrl.trim()
        ? body.clientUrl.trim()
        : "https://api.openai.com/v1/chat/completions",
    )
    const model = typeof body.clientModel === "string" && body.clientModel.trim()
      ? body.clientModel.trim()
      : defaultModel
    if (!endpoint || !validModel(model)) return null
    return { kind: "external", key: suppliedKey, url: endpoint, model }
  }

  if (env.AI) {
    const pick = (value: string | undefined) => HOSTED_MODEL_ALLOWLIST.find((candidate) => candidate === value?.trim())
    const model = pick(env.AI_HOSTED_MODEL) || HOSTED_AI_MODEL
    const writingModel = pick(env.AI_WRITING_MODEL) || DEFAULT_WRITING_MODEL
    return { kind: "workers-ai", binding: env.AI, model, writingModel }
  }

  const siteKey = env.AI_API_KEY?.trim()
  const endpoint = exactProviderEndpoint(env.AI_API_URL?.trim() || "https://api.openai.com/v1/chat/completions")
  if (!siteKey || siteKey.length > 400 || /[\u0000-\u001f\u007f]/.test(siteKey) || !endpoint) return null
  return { kind: "external", key: siteKey, url: endpoint, model: defaultModel }
}

// Qwen3 thinks before answering unless told not to. Hidden reasoning tokens
// count against max_tokens, so long reasoning truncated answers into invalid
// JSON, added latency against the timeout, and billed extra output neurons.
// "/no_think" is Qwen3's documented per-turn switch.
function withoutThinking(settings: AiSettings, messages: OpenAiMessage[]): OpenAiMessage[] {
  const qwen3 = /(^|\/)qwen3[-.]/i.test(settings.model.replace(/^@cf\/qwen\//, "qwen/"))
  if (!qwen3) return messages
  return messages.map((message, index) => (index === 0 && message.role === "system"
    ? { ...message, content: `${message.content}\n/no_think` }
    : message))
}

// Prose-heavy tasks use the writing model (gpt-oss-120b by default) with the
// precise model as an automatic fallback. Exact-quote tasks stay on the
// precise model. BYOK and external providers are unaffected.
export function forTask(settings: AiSettings, profile: TaskProfile): AiSettings {
  if (settings.kind !== "workers-ai" || profile !== "writing") return settings
  const writing = settings.writingModel
  if (!writing || writing === settings.model) return settings
  return { ...settings, model: writing, writingModel: undefined, fallbackModel: settings.model }
}

export function isReasoningModel(model: string): boolean {
  return model.startsWith("@cf/openai/gpt-oss-")
}

async function runWorkersAi(
  binding: Ai,
  model: HostedModel,
  messages: OpenAiMessage[],
  jsonMode: boolean,
  temperature: number,
  maxTokens: number,
): Promise<string> {
  const options = { signal: AbortSignal.timeout(isReasoningModel(model) ? REASONING_TIMEOUT_MS : PROVIDER_TIMEOUT_MS), tags: ["resumate", "hosted"] }
  if (isReasoningModel(model)) {
    // gpt-oss on Workers AI exposes reasoning effort only through the
    // Responses input format. Low effort keeps latency close to Qwen3; the
    // schema text in the prompt and the local validators stand in for JSON mode.
    const response = await (binding.run as unknown as (model: string, input: unknown, options: unknown) => Promise<unknown>)(model, {
      input: messages.map(({ role, content }) => ({ role: role === "system" ? "developer" : role, content })),
      reasoning: { effort: "low" },
    }, options)
    return cleanModelText(contentFromWorkersAi(response))
  }
  const response = await binding.run(model, {
    messages: withoutThinking({ kind: "workers-ai", binding, model }, messages),
    temperature,
    max_tokens: maxTokens,
    ...(jsonMode ? {
      // Qwen's current model-specific types advertise json_schema, but the
      // generic Workers AI compatibility list has not caught up. Use the
      // documented json_object envelope until a bound production smoke test
      // proves schema mode, then always enforce the stricter local validator.
      response_format: { type: "json_object" as const },
    } : {}),
  }, options)
  return cleanModelText(contentFromWorkersAi(response))
}

export async function callAI(
  settings: AiSettings,
  messages: OpenAiMessage[],
  jsonMode: boolean,
  temperature = 0.4,
  schema?: JsonSchema,
  maxTokens = DEFAULT_MAX_TOKENS,
): Promise<string> {
  const withSchema = schema ? withSchemaInstruction(messages, schema) : messages
  if (settings.kind === "workers-ai") {
    try {
      return await runWorkersAi(settings.binding, settings.model, withSchema, jsonMode, temperature, maxTokens)
    } catch (error) {
      if (!settings.fallbackModel || settings.fallbackModel === settings.model) throw error
      console.error(JSON.stringify({ event: "ai_model_fallback", model: settings.model, fallback: settings.fallbackModel, reason: error instanceof Error ? error.message.slice(0, 120) : "unknown" }))
      return await runWorkersAi(settings.binding, settings.fallbackModel, withSchema, jsonMode, temperature, maxTokens)
    }
  }
  const prepared = withoutThinking(settings, withSchema)

  const payload: Record<string, unknown> = {
    model: settings.model,
    temperature,
    max_tokens: maxTokens,
    messages: prepared,
  }
  if (jsonMode) payload.response_format = { type: "json_object" }

  const upstream = await fetch(settings.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    redirect: "error",
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  })
  if (!upstream.ok || !upstream.body) throw new Error("AI provider request failed")

  const bytes = await readBoundedStream(
    upstream.body,
    MAX_PROVIDER_BYTES,
    "AI provider response too large",
    502,
  )
  let data: unknown
  try {
    data = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new Error("AI provider returned invalid JSON")
  }
  const content = (data as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content
  if (typeof content !== "string") throw new Error("AI provider returned an invalid response")
  return cleanModelText(content)
}

// Tell the model the exact JSON shape. JSON mode guarantees syntax only; the
// schema text steers field names, counts, and enums, and the local validators
// still enforce every bound.
function withSchemaInstruction(messages: OpenAiMessage[], schema: JsonSchema): OpenAiMessage[] {
  const instruction = `Respond with one JSON object that validates against this JSON Schema. Use exactly these keys, no others, and no surrounding prose or code fences:\n${JSON.stringify(schema)}`
  return messages.map((message, index) => (index === 0 && message.role === "system"
    ? { ...message, content: `${message.content}\n\n${instruction}` }
    : message))
}

// Remove reasoning blocks and markdown fences some models add around answers.
export function cleanModelText(value: string): string {
  return value
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^\s*<think>[\s\S]*$/i, "")
    .replace(/^\s*```(?:json|text)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim()
}

function contentFromWorkersAi(value: unknown): string {
  if (typeof value === "string") return value
  if (!value || typeof value !== "object") throw new Error("Workers AI returned an invalid response")
  const response = value as {
    choices?: Array<{ message?: { content?: unknown }; text?: unknown }>
    response?: unknown
    output_text?: unknown
    output?: Array<{ type?: unknown; content?: Array<{ type?: unknown; text?: unknown }> }>
  }
  // Responses-API envelope (gpt-oss models).
  if (typeof response.output_text === "string") return response.output_text
  if (Array.isArray(response.output)) {
    const text = response.output
      .filter((item) => item?.type === "message")
      .flatMap((item) => item.content || [])
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("")
    if (text) return text
  }
  const content = response.choices?.[0]?.message?.content
    ?? response.choices?.[0]?.text
    ?? response.response
  if (typeof content === "string") {
    // An empty answer usually means reasoning consumed the whole token budget.
    if (!content.trim()) throw new Error("Workers AI returned an empty answer")
    return content
  }
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    throw new Error("Workers AI returned an invalid response")
  }
  const serialized = JSON.stringify(content)
  if (new TextEncoder().encode(serialized).byteLength > MAX_PROVIDER_BYTES) {
    throw new Error("Workers AI response too large")
  }
  return serialized
}

export function limitedString(value: unknown, maximum: number): string {
  return typeof value === "string" ? value.trim().slice(0, maximum) : ""
}

export function limitedStrings(value: unknown, count: number, length: number): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => limitedString(item, length))
    .filter(Boolean)
    .slice(0, count)
}

export function requestError(error: unknown): Response {
  if (error instanceof RequestError) return text(error.message, error.status)
  return text("AI provider request failed", 502)
}

export function validString(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length <= maximum
}

export function parseJsonObject(output: string): Record<string, unknown> | null {
  const attempt = (text: string): Record<string, unknown> | null => {
    try {
      const parsed: unknown = JSON.parse(text)
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null
    } catch {
      return null
    }
  }
  const cleaned = cleanModelText(output)
  const direct = attempt(cleaned)
  if (direct) return direct
  // Tolerate a short preamble or trailing note around a single JSON object.
  const first = cleaned.indexOf("{")
  const last = cleaned.lastIndexOf("}")
  return first >= 0 && last > first ? attempt(cleaned.slice(first, last + 1)) : null
}

export function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys)
  return Object.keys(value).every((key) => allowed.has(key))
}

export function strictString(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum
}

export function strictStringArray(value: unknown, maximumCount: number, maximumLength: number): value is string[] {
  return Array.isArray(value)
    && value.length <= maximumCount
    && value.every((item) => strictString(item, maximumLength))
}
