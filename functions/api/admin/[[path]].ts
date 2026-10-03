import { adminForRequest, type AdminEnv } from "../../../server/admin"
import { aiSettings, enforcePostAndOrigin, readBoundedJson, requestError, text, json, type AiEnv } from "../../../server/ai-proxy"
import { runSmokeChecks, smokeModels } from "../../../server/ai-smoke"

type Env = AdminEnv & AiEnv

function actionFor(request: Request): string {
  return new URL(request.url).pathname.split("/").filter(Boolean).at(-1) || ""
}

async function overview(env: AdminEnv) {
  const now = Date.now()
  const monthKey = new Date().toISOString().slice(0, 7)
  const total = await env.DB.prepare(
    `SELECT COUNT(*) AS users,
            SUM(CASE WHEN email_verified_at IS NOT NULL THEN 1 ELSE 0 END) AS verified,
            SUM(CASE WHEN plan = 'sprint' THEN 1 ELSE 0 END) AS sprint,
            SUM(CASE WHEN plan = 'pro' THEN 1 ELSE 0 END) AS pro
     FROM users`,
  ).first<{ users: number; verified: number; sprint: number; pro: number }>()
  const ai = await env.DB.prepare(
    `SELECT COUNT(*) AS actions FROM ai_action_reservations
     WHERE period_key = ? AND status = 'committed'`,
  ).bind(monthKey).first<{ actions: number }>()
  const users = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.plan, u.email_verified_at AS emailVerifiedAt, u.created_at AS createdAt,
            (SELECT COUNT(*) FROM ai_action_reservations a
             WHERE a.user_id = u.id AND a.period_key = ? AND a.status = 'committed') AS aiActions
     FROM users u ORDER BY u.created_at DESC LIMIT 50`,
  ).bind(monthKey).all()
  const funnel = await env.DB.prepare(
    `SELECT event_name AS eventName, COUNT(*) AS count
     FROM conversion_events WHERE created_at >= ?
     GROUP BY event_name ORDER BY count DESC`,
  ).bind(now - 30 * 24 * 60 * 60 * 1_000).all()
  const webhookFailures = await env.DB.prepare(
    `SELECT provider, event_id AS eventId, event_type AS eventType,
            error_code AS errorCode, created_at AS createdAt
     FROM billing_webhook_failures WHERE resolved_at IS NULL
     ORDER BY created_at DESC LIMIT 20`,
  ).all()
  const audits = await env.DB.prepare(
    `SELECT action, target_user_id AS targetUserId, reason, created_at AS createdAt
     FROM admin_audit_log ORDER BY created_at DESC LIMIT 20`,
  ).all()
  return json({
    summary: {
      users: Number(total?.users) || 0,
      verified: Number(total?.verified) || 0,
      sprint: Number(total?.sprint) || 0,
      pro: Number(total?.pro) || 0,
      aiActions: Number(ai?.actions) || 0,
    },
    users: users.results,
    funnel: funnel.results,
    webhookFailures: webhookFailures.results,
    audits: audits.results,
  })
}

async function adminRateLimited(env: AdminEnv, key: string, limit: number): Promise<boolean> {
  const now = Date.now()
  await env.DB.prepare(
    `INSERT INTO auth_rate_limits (key, attempts, window_started_at) VALUES (?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET
       attempts = CASE WHEN ? - window_started_at >= 3600000 THEN 1 ELSE attempts + 1 END,
       window_started_at = CASE WHEN ? - window_started_at >= 3600000 THEN ? ELSE window_started_at END`,
  ).bind(key, now, now, now, now).run()
  const rate = await env.DB.prepare("SELECT attempts FROM auth_rate_limits WHERE key = ?").bind(key).first<{ attempts: number }>()
  return !rate || rate.attempts > limit
}

// Runs fixed, fictional prompts through the configured models. It never reads
// user data and does not count against anyone's AI allowance.
async function aiSmoke(request: Request, env: Env, admin: { id: string }) {
  const blocked = enforcePostAndOrigin(request)
  if (blocked) return blocked
  const body = await readBoundedJson<{ model?: unknown }>(request)
  const settings = aiSettings({}, env)
  if (!settings || settings.kind !== "workers-ai") return text("Workers AI is not bound in this environment", 501)
  if (await adminRateLimited(env, `admin:ai-smoke:${admin.id}`, 20)) return text("Smoke test limit reached. Try again in an hour.", 429)
  const models = smokeModels(body?.model, [settings.model, settings.writingModel ?? settings.model])
  const checks = await runSmokeChecks(settings.binding, models)
  return json({ precise: settings.model, writing: settings.writingModel ?? settings.model, ranAt: Date.now(), checks })
}

async function revokeSessions(request: Request, env: AdminEnv, admin: { id: string }) {
  const blocked = enforcePostAndOrigin(request)
  if (blocked) return blocked
  const body = await readBoundedJson<{ targetUserId?: unknown; reason?: unknown; confirmation?: unknown }>(request)
  const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId : ""
  const reason = typeof body?.reason === "string" ? body.reason.trim() : ""
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(targetUserId) || targetUserId === admin.id) return text("Invalid support target", 400)
  if (reason.length < 10 || reason.length > 300 || body.confirmation !== "REVOKE") return text("A reason and typed confirmation are required", 400)
  const now = Date.now()
  if (await adminRateLimited(env, `admin:revoke:${admin.id}`, 10)) return text("Support action limit reached", 429)
  const target = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(targetUserId).first<{ id: string }>()
  if (!target) return text("Account not found", 404)
  const result = await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(targetUserId).run()
  await env.DB.prepare(
    "INSERT INTO admin_audit_log (id, admin_user_id, action, target_user_id, reason, created_at) VALUES (?, ?, 'revoke_sessions', ?, ?, ?)",
  ).bind(crypto.randomUUID(), admin.id, targetUserId, reason, now).run()
  return json({ ok: true, revoked: Number(result.meta.changes) || 0 })
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const admin = await adminForRequest(request, env)
    if (!admin) return text("Admin access required", 403)
    const action = actionFor(request)
    if (request.method === "GET" && action === "overview") return await overview(env)
    if (request.method === "POST" && action === "revoke-sessions") return await revokeSessions(request, env, admin)
    if (request.method === "POST" && action === "ai-smoke") return await aiSmoke(request, env, admin)
    return text("Not found", 404)
  } catch (error) {
    return requestError(error)
  }
}
