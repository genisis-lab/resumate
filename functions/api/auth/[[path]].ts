import { pbkdf2 } from "node:crypto"
import { trackConversion } from "../../../server/analytics"

type AuthEnv = Cloudflare.Env & {
  RESEND_API_KEY?: string
  ADMIN_USER_IDS?: string
  ADMIN_EMAILS?: string
  TURNSTILE_SITE_KEY?: string
  TURNSTILE_SECRET_KEY?: string
}

type UserRow = {
  id: string
  email: string
  name: string
  password_hash: string
  password_salt: string
  password_hash_version: number
  password_iterations: number
  email_verified_at: number | null
  plan: "free" | "sprint" | "pro"
  created_at: number
}

const encoder = new TextEncoder()
const SESSION_COOKIE = "__Host-resumate_session"
const SESSION_SECONDS = 60 * 60 * 24 * 30
const VERIFY_SECONDS = 60 * 60
const MAX_BODY_BYTES = 8_192
const PASSWORD_ITERATIONS = 100_000

function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      ...headers,
    },
  })
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function randomToken(size = 32): string {
  const bytes = new Uint8Array(size)
  crypto.getRandomValues(bytes)
  return bytesToBase64Url(bytes)
}

async function sha256(value: string): Promise<string> {
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))))
}

async function derivePassword(password: string, salt: string, iterations = PASSWORD_ITERATIONS): Promise<string> {
  const bits = await new Promise<Uint8Array>((resolve, reject) => {
    pbkdf2(password, salt, iterations, 32, "sha256", (error, derivedKey) => {
      if (error) reject(error)
      else resolve(new Uint8Array(derivedKey))
    })
  })
  return bytesToBase64Url(bits)
}

function constantTimeEqual(left: string, right: string): boolean {
  const a = encoder.encode(left)
  const b = encoder.encode(right)
  return a.byteLength === b.byteLength && crypto.subtle.timingSafeEqual(a, b)
}

function cookieValue(request: Request, name: string): string | null {
  const cookies = request.headers.get("cookie") || ""
  for (const pair of cookies.split(";")) {
    const [key, ...value] = pair.trim().split("=")
    if (key === name) return value.join("=") || null
  }
  return null
}

function sessionCookie(token: string, maxAge = SESSION_SECONDS): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}; Priority=High`
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

function validEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validPassword(password: unknown): password is string {
  return typeof password === "string" && password.length >= 10 && password.length <= 128
}

function passwordParameters(user: Pick<UserRow, "password_hash_version" | "password_iterations">): number | null {
  if (user.password_hash_version !== 1) return null
  if (!Number.isInteger(user.password_iterations)
    || user.password_iterations < 10_000
    || user.password_iterations > PASSWORD_ITERATIONS) return null
  return user.password_iterations
}

function turnstileConfigured(env: AuthEnv): boolean {
  return Boolean(env.TURNSTILE_SITE_KEY?.trim() && env.TURNSTILE_SECRET_KEY?.trim())
}

async function validateTurnstile(
  request: Request,
  env: AuthEnv,
  token: unknown,
  expectedAction: "signup" | "login",
): Promise<boolean> {
  if (!turnstileConfigured(env)) return true
  if (typeof token !== "string" || token.length < 1 || token.length > 2_048) return false
  const form = new FormData()
  form.set("secret", env.TURNSTILE_SECRET_KEY!.trim())
  form.set("response", token)
  form.set("idempotency_key", crypto.randomUUID())
  const remoteIp = request.headers.get("cf-connecting-ip")
  if (remoteIp) form.set("remoteip", remoteIp)
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(5_000),
    })
    if (!response.ok) return false
    const result = await response.json() as { success?: unknown; hostname?: unknown; action?: unknown }
    return result.success === true
      && result.hostname === new URL(request.url).hostname
      && result.action === expectedAction
  } catch {
    return false
  }
}

function clientKey(request: Request, action: string, email = ""): string {
  const forwarded = request.headers.get("cf-connecting-ip") || "unknown"
  return `${action}:${forwarded}:${email}`.slice(0, 400)
}

async function allowAttempt(env: AuthEnv, key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = Date.now()
  await env.DB.prepare(
    `INSERT INTO auth_rate_limits (key, attempts, window_started_at) VALUES (?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET
       attempts = CASE WHEN ? - window_started_at >= ? THEN 1 ELSE attempts + 1 END,
       window_started_at = CASE WHEN ? - window_started_at >= ? THEN ? ELSE window_started_at END`,
  ).bind(key, now, now, windowMs, now, windowMs, now).run()
  const row = await env.DB.prepare("SELECT attempts FROM auth_rate_limits WHERE key = ?")
    .bind(key).first<{ attempts: number }>()
  return Boolean(row && row.attempts <= limit)
}

function adminValues(value = ""): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

function isAdminUser(env: AuthEnv, user: UserRow): boolean {
  const userIdAllowed = adminValues(env.ADMIN_USER_IDS).includes(user.id.toLowerCase())
  const verifiedEmailAllowed = Boolean(user.email_verified_at)
    && adminValues(env.ADMIN_EMAILS).includes(user.email.toLowerCase())
  return userIdAllowed || verifiedEmailAllowed
}

async function bodyObject(request: Request): Promise<Record<string, unknown> | null> {
  const size = Number(request.headers.get("content-length") || 0)
  if (size > MAX_BODY_BYTES) return null
  try {
    const text = await request.text()
    if (text.length > MAX_BODY_BYTES) return null
    const value: unknown = JSON.parse(text)
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
  } catch {
    return null
  }
}

function safeRequestOrigin(request: Request): boolean {
  const origin = request.headers.get("origin")
  if (origin && origin !== new URL(request.url).origin) return false
  return request.headers.get("sec-fetch-site") !== "cross-site"
}

function isJsonRequest(request: Request): boolean {
  return request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() === "application/json"
}

function publicUser(user: UserRow, env: AuthEnv) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: Boolean(user.email_verified_at),
    plan: user.plan,
    isAdmin: isAdminUser(env, user),
    createdAt: user.created_at,
  }
}

async function userForRequest(request: Request, env: AuthEnv): Promise<UserRow | null> {
  const token = cookieValue(request, SESSION_COOKIE)
  if (!token) return null
  const tokenHash = await sha256(token)
  return env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.password_hash, u.password_salt,
            u.password_hash_version, u.password_iterations,
            u.email_verified_at, u.plan, u.created_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
  ).bind(tokenHash, Date.now()).first<UserRow>()
}

async function createSession(userId: string, env: AuthEnv): Promise<string> {
  const token = randomToken()
  const now = Date.now()
  await env.DB.prepare(
    "INSERT INTO sessions (token_hash, user_id, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)",
  ).bind(await sha256(token), userId, now + SESSION_SECONDS * 1000, now, now).run()
  return token
}

function emailHtml(name: string, verifyUrl: string): string {
  const safeName = name.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character)
  const safeUrl = verifyUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;")
  return `<!doctype html><html><body style="margin:0;background:#f5f6f8;color:#1a1d23;font-family:Arial,sans-serif"><div style="max-width:560px;margin:0 auto;padding:40px 24px"><div style="background:#fff;border:1px solid #e2e5ea;border-radius:12px;padding:32px"><p style="margin:0 0 24px;font-weight:700">ResuMate</p><h1 style="margin:0 0 16px;font-size:28px">Verify your email</h1><p style="line-height:1.6">Hi ${safeName}, confirm this address to finish creating your ResuMate account.</p><p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;padding:12px 18px;font-weight:700">Verify email address</a></p><p style="color:#667085;font-size:13px;line-height:1.5">This link expires in one hour. If you did not create this account, you can ignore this message.</p></div></div></body></html>`
}

async function sendVerification(request: Request, env: AuthEnv, user: Pick<UserRow, "id" | "email" | "name">): Promise<boolean> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return false
  const token = randomToken()
  const now = Date.now()
  await env.DB.batch([
    env.DB.prepare("DELETE FROM email_verification_tokens WHERE user_id = ?").bind(user.id),
    env.DB.prepare("INSERT INTO email_verification_tokens (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
      .bind(await sha256(token), user.id, now + VERIFY_SECONDS * 1000, now),
  ])
  const configuredOrigin = env.APP_URL?.replace(/\/$/, "")
  const origin = configuredOrigin || new URL(request.url).origin
  const verifyUrl = `${origin}/verify-email#token=${encodeURIComponent(token)}`
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [user.email],
        subject: "Verify your ResuMate email",
        html: emailHtml(user.name, verifyUrl),
        text: `Hi ${user.name}, verify your ResuMate email: ${verifyUrl}\n\nThis link expires in one hour.`,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (response.ok) return true
    console.error(JSON.stringify({ event: "verification_email_failed", status: response.status }))
  } catch (error) {
    console.error(JSON.stringify({
      event: "verification_email_failed",
      reason: error instanceof Error ? error.name : "unknown",
    }))
  }
  return false
}

async function register(request: Request, env: AuthEnv): Promise<Response> {
  const body = await bodyObject(request)
  if (!body) return json({ error: "Invalid request." }, 400)
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : ""
  const email = normalizeEmail(body.email)
  const password = body.password
  if (name.length < 2 || name.length > 80) return json({ error: "Enter your name." }, 400)
  if (!validEmail(email)) return json({ error: "Enter a valid email address." }, 400)
  if (!validPassword(password)) return json({ error: "Use at least 10 characters for your password." }, 400)
  if (!await allowAttempt(env, clientKey(request, "register", email), 5, 60 * 60 * 1000)) {
    return json({ error: "Too many attempts. Try again later." }, 429)
  }
  if (!await validateTurnstile(request, env, body.turnstileToken, "signup")) {
    return json({ error: "Complete the security check and try again." }, 403)
  }
  const existing = await env.DB.prepare("SELECT id, email_verified_at FROM users WHERE email = ?").bind(email).first<{ id: string; email_verified_at: number | null }>()
  if (existing) return json({ error: "An account already exists for this email. Sign in or resend verification." }, 409)
  const now = Date.now()
  const id = crypto.randomUUID()
  const salt = randomToken(24)
  await env.DB.prepare(
    `INSERT INTO users
     (id, email, name, password_hash, password_salt, password_hash_version, password_iterations, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
  ).bind(id, email, name, await derivePassword(password, salt), salt, PASSWORD_ITERATIONS, now, now).run()
  await trackConversion(env, "signup_completed", id)
  const emailSent = await sendVerification(request, env, { id, email, name })
  return json({ ok: true, emailSent }, emailSent ? 201 : 202)
}

async function verify(request: Request, env: AuthEnv): Promise<Response> {
  const body = await bodyObject(request)
  const token = typeof body?.token === "string" ? body.token : ""
  if (token.length < 32 || token.length > 128) return json({ error: "This verification link is invalid." }, 400)
  const tokenHash = await sha256(token)
  const now = Date.now()
  const record = await env.DB.prepare(
    "SELECT user_id FROM email_verification_tokens WHERE token_hash = ? AND expires_at > ?",
  ).bind(tokenHash, now).first<{ user_id: string }>()
  if (!record) return json({ error: "This verification link is invalid or expired." }, 400)
  const consumed = await env.DB.prepare(
    "DELETE FROM email_verification_tokens WHERE token_hash = ? AND expires_at > ?",
  ).bind(tokenHash, now).run()
  if (Number(consumed.meta.changes) !== 1) return json({ error: "This verification link is invalid or expired." }, 400)
  await env.DB.prepare("UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ?")
    .bind(now, now, record.user_id).run()
  await trackConversion(env, "email_verified", record.user_id)
  const session = await createSession(record.user_id, env)
  return json({ ok: true }, 200, { "set-cookie": sessionCookie(session) })
}

async function login(request: Request, env: AuthEnv): Promise<Response> {
  const body = await bodyObject(request)
  const email = normalizeEmail(body?.email)
  const password = body?.password
  if (!validEmail(email) || !validPassword(password)) return json({ error: "Email or password is incorrect." }, 401)
  if (!await allowAttempt(env, clientKey(request, "login", email), 8, 15 * 60 * 1000)) {
    return json({ error: "Too many attempts. Try again in 15 minutes." }, 429)
  }
  if (!await validateTurnstile(request, env, body?.turnstileToken, "login")) {
    return json({ error: "Complete the security check and try again." }, 403)
  }
  const user = await env.DB.prepare(
    `SELECT id, email, name, password_hash, password_salt, password_hash_version, password_iterations,
            email_verified_at, plan, created_at FROM users WHERE email = ?`,
  ).bind(email).first<UserRow>()
  const iterations = user ? passwordParameters(user) : PASSWORD_ITERATIONS
  const candidate = await derivePassword(password, user?.password_salt || "invalid-account-salt", iterations || PASSWORD_ITERATIONS)
  if (!user || !iterations || !constantTimeEqual(candidate, user.password_hash)) return json({ error: "Email or password is incorrect." }, 401)
  if (!user.email_verified_at) return json({ error: "Verify your email before signing in.", code: "EMAIL_NOT_VERIFIED" }, 403)
  const session = await createSession(user.id, env)
  return json({ user: publicUser(user, env) }, 200, { "set-cookie": sessionCookie(session) })
}

async function resend(request: Request, env: AuthEnv): Promise<Response> {
  const body = await bodyObject(request)
  const email = normalizeEmail(body?.email)
  if (!validEmail(email)) return json({ error: "Enter a valid email address." }, 400)
  if (!await allowAttempt(env, clientKey(request, "resend", email), 3, 60 * 60 * 1000)) {
    return json({ error: "Too many verification requests. Try again later." }, 429)
  }
  const user = await env.DB.prepare("SELECT id, email, name, email_verified_at FROM users WHERE email = ?")
    .bind(email).first<UserRow>()
  if (user && !user.email_verified_at) await sendVerification(request, env, user)
  return json({ ok: true, message: "If that unverified account exists, a new email is on its way." })
}

async function logout(request: Request, env: AuthEnv): Promise<Response> {
  const token = cookieValue(request, SESSION_COOKIE)
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run()
  return json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) })
}

async function deleteAccount(request: Request, env: AuthEnv): Promise<Response> {
  const user = await userForRequest(request, env)
  if (!user) return json({ error: "Sign in to delete your account." }, 401)
  const body = await bodyObject(request)
  const password = body?.password
  if (!validPassword(password)) return json({ error: "Enter your password to delete your account." }, 400)
  const iterations = passwordParameters(user)
  if (!iterations) return json({ error: "Password verification is unavailable. Contact support." }, 409)
  const candidate = await derivePassword(password, user.password_salt, iterations)
  if (!constantTimeEqual(candidate, user.password_hash)) return json({ error: "Password is incorrect." }, 403)
  await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(user.id).run()
  return json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) })
}

async function handle(request: Request, env: AuthEnv): Promise<Response> {
  if (!env.DB) return json({ error: "Account storage is not configured." }, 503)
  const url = new URL(request.url)
  const action = url.pathname.split("/").filter(Boolean).at(-1) || ""
  if (request.method !== "GET" && !safeRequestOrigin(request)) return json({ error: "Invalid request origin." }, 403)
  if (request.method !== "GET" && !isJsonRequest(request)) return json({ error: "Requests must use JSON." }, 415)
  if (request.method === "GET" && action === "session") {
    const user = await userForRequest(request, env)
    return json({ user: user ? publicUser(user, env) : null })
  }
  if (request.method === "GET" && action === "config") {
    return json({ turnstileSiteKey: turnstileConfigured(env) ? env.TURNSTILE_SITE_KEY!.trim() : null })
  }
  if (request.method === "POST" && action === "register") return register(request, env)
  if (request.method === "POST" && action === "verify") return verify(request, env)
  if (request.method === "POST" && action === "login") return login(request, env)
  if (request.method === "POST" && action === "resend-verification") return resend(request, env)
  if (request.method === "POST" && action === "logout") return logout(request, env)
  if (request.method === "DELETE" && action === "account") return deleteAccount(request, env)
  return json({ error: "Not found." }, 404)
}

export const onRequest: PagesFunction<AuthEnv> = async ({ request, env }) => {
  try {
    return await handle(request, env)
  } catch (error) {
    console.error(JSON.stringify({
      event: "auth_request_failed",
      action: new URL(request.url).pathname.split("/").filter(Boolean).at(-1) || "unknown",
      reason: error instanceof Error ? error.name : "unknown",
    }))
    return json({ error: "Account service is temporarily unavailable. Please try again in a moment." }, 503)
  }
}
