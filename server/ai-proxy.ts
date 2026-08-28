export type AiEnv = Cloudflare.Env & {
  AI_API_KEY?: string
  AI_API_URL?: string
  AI_MODEL?: string
}

export interface ClientAiOptions {
  clientKey?: string
  clientUrl?: string
  clientModel?: string
}

export interface AiSettings {
  key: string
  url: string
  model: string
}

interface OpenAiMessage {
  role: string
  content: string
}

export const MAX_REQUEST_BYTES = 128 * 1024
const MAX_PROVIDER_BYTES = 512 * 1024
const PROVIDER_TIMEOUT_MS = 30_000
const BYOK_RATE_LIMIT = 20
const BYOK_RATE_WINDOW_MS = 60_000
const HOSTED_RATE_WINDOW_MS = 24 * 60 * 60 * 1000
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
  return env.DB.prepare(
    `INSERT INTO auth_rate_limits (key, attempts, window_started_at) VALUES (?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET
       attempts = CASE WHEN ? - window_started_at >= ? THEN 1 ELSE attempts + 1 END,
       window_started_at = CASE WHEN ? - window_started_at >= ? THEN ? ELSE window_started_at END
     RETURNING attempts, window_started_at AS windowStartedAt`,
  ).bind(key.slice(0, 400), now, now, windowMs, now, windowMs, now).first<{ attempts: number; windowStartedAt: number }>()
}

// Persistent, provider-neutral quota enforcement. User-supplied provider keys
// receive a short abuse limit; any future hosted allowance additionally
// requires a verified ResuMate session and is capped by plan.
export async function enforceAiQuota(
  request: Request,
  env: AiEnv,
  action: string,
  usesClientKey: boolean,
): Promise<Response | null> {
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
      `SELECT u.id, u.plan, u.email_verified_at AS emailVerifiedAt
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    ).bind(await sha256(sessionToken), Date.now()).first<{ id: string; plan: "free" | "sprint" | "pro"; emailVerifiedAt: number | null }>()
    if (!user) return text("Sign in with a verified account to use hosted AI", 401)
    if (!user.emailVerifiedAt) return text("Verify your email to use hosted AI", 403)

    const limit = user.plan === "pro" ? 50 : user.plan === "sprint" ? 20 : 3
    const row = await incrementQuota(env, `ai:hosted:${action}:${user.id}`, HOSTED_RATE_WINDOW_MS)
    if (!row) return text("AI quota unavailable", 503)
    if (row.attempts > limit) {
      const retryAfter = Math.max(1, Math.ceil((row.windowStartedAt + HOSTED_RATE_WINDOW_MS - Date.now()) / 1000))
      return text("Hosted AI allowance reached", 429, { "Retry-After": String(retryAfter) })
    }
    return null
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
    return { key: suppliedKey, url: endpoint, model }
  }

  const siteKey = env.AI_API_KEY?.trim()
  const endpoint = exactProviderEndpoint(env.AI_API_URL?.trim() || "https://api.openai.com/v1/chat/completions")
  if (!siteKey || siteKey.length > 400 || /[\u0000-\u001f\u007f]/.test(siteKey) || !endpoint) return null
  return { key: siteKey, url: endpoint, model: defaultModel }
}

export async function callAI(
  settings: AiSettings,
  messages: OpenAiMessage[],
  jsonMode: boolean,
  temperature = 0.4,
): Promise<string> {
  const payload: Record<string, unknown> = {
    model: settings.model,
    temperature,
    max_tokens: 1_600,
    messages,
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
  return content
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
