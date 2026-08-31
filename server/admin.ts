export type AdminEnv = Cloudflare.Env & {
  ADMIN_USER_IDS?: string
  ADMIN_EMAILS?: string
}

export type AdminUser = { id: string; email: string; name: string }
const SESSION_COOKIE = "__Host-resumate_session"

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

function configured(value = ""): Set<string> {
  return new Set(value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean))
}

export async function adminForRequest(request: Request, env: AdminEnv): Promise<AdminUser | null> {
  const token = cookieValue(request, SESSION_COOKIE)
  if (!token) return null
  const user = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.email_verified_at AS emailVerifiedAt
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
  ).bind(await sha256(token), Date.now()).first<AdminUser & { emailVerifiedAt: number | null }>()
  if (!user?.emailVerifiedAt) return null
  const allowed = configured(env.ADMIN_USER_IDS).has(user.id.toLowerCase())
    || configured(env.ADMIN_EMAILS).has(user.email.toLowerCase())
  return allowed ? { id: user.id, email: user.email, name: user.name } : null
}
