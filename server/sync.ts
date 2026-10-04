import { isAdminUser, json, readBoundedJson, text, type AiEnv } from "./ai-proxy"
import { trackConversion } from "./analytics"
import { verifiedSessionUser } from "./billing"
import { overRateLimit } from "./visitor"

// Opt-in, end-to-end encrypted workspace sync for Pro. The browser derives an
// AES-GCM key from a passphrase that never leaves the device and uploads only
// ciphertext. The server checks sizes, formats and versions; it cannot read
// or verify the contents.

export const MAX_CIPHERTEXT_CHARS = 1_500_000
const MAX_BODY_BYTES = MAX_CIPHERTEXT_CHARS + 8_192
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/

export interface VaultRecord {
  version: number
  ciphertext: string
  iv: string
  salt: string
  kdfIterations: number
  keyCheck: string
  deviceLabel: string | null
  updatedAt: number
}

type SyncUser = { id: string; email: string; plan: string; emailVerifiedAt: number | null }

function canWrite(env: AiEnv, user: SyncUser): boolean {
  return user.plan === "pro" || isAdminUser(env, user)
}

function base64(value: unknown, min: number, max: number): value is string {
  return typeof value === "string" && value.length >= min && value.length <= max && value.length % 4 === 0 && BASE64.test(value)
}

export function validVaultUpload(body: Record<string, unknown> | null): Omit<VaultRecord, "version" | "updatedAt"> & { baseVersion: number } | string {
  if (!body || typeof body !== "object") return "Invalid sync upload"
  const baseVersion = body.baseVersion
  if (!Number.isSafeInteger(baseVersion) || Number(baseVersion) < 0) return "baseVersion must be a whole number"
  if (typeof body.ciphertext === "string" && body.ciphertext.length > MAX_CIPHERTEXT_CHARS) return "Your workspace is too large to sync"
  if (!base64(body.ciphertext, 24, MAX_CIPHERTEXT_CHARS)) return "Malformed sync upload"
  // AES-GCM nonce is 12 bytes (16 base64 chars); salt is 16-32 bytes.
  if (!base64(body.iv, 16, 16)) return "Invalid nonce"
  if (!base64(body.salt, 24, 44)) return "Invalid salt"
  if (!Number.isSafeInteger(body.kdfIterations) || Number(body.kdfIterations) < 100_000 || Number(body.kdfIterations) > 5_000_000) return "Invalid key-derivation settings"
  if (typeof body.keyCheck !== "string" || body.keyCheck.length < 16 || body.keyCheck.length > 200 || !/^[A-Za-z0-9+/=.]+$/.test(body.keyCheck)) return "Invalid key check"
  const deviceLabel = typeof body.deviceLabel === "string" ? body.deviceLabel.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 60) || null : null
  return {
    baseVersion: Number(baseVersion),
    ciphertext: body.ciphertext as string,
    iv: body.iv as string,
    salt: body.salt as string,
    kdfIterations: Number(body.kdfIterations),
    keyCheck: body.keyCheck,
    deviceLabel,
  }
}

async function readVault(env: AiEnv, userId: string): Promise<VaultRecord | null> {
  return await env.DB.prepare(
    `SELECT version, ciphertext, iv, salt, kdf_iterations AS kdfIterations, key_check AS keyCheck,
            device_label AS deviceLabel, updated_at AS updatedAt
     FROM sync_vaults WHERE user_id = ?`,
  ).bind(userId).first<VaultRecord>()
}

async function syncUser(request: Request, env: AiEnv): Promise<SyncUser | Response> {
  const user = await verifiedSessionUser(request, env)
  if (!user) return text("Sign in to use sync", 401)
  if (!user.emailVerifiedAt) return text("Verify your email to use sync", 403)
  return user
}

export async function getVault(request: Request, env: AiEnv): Promise<Response> {
  const user = await syncUser(request, env)
  if (user instanceof Response) return user
  // Readable after a downgrade so nobody loses access to their own copy.
  return json({ vault: await readVault(env, user.id), canWrite: canWrite(env, user) })
}

export async function deleteVault(request: Request, env: AiEnv): Promise<Response> {
  const user = await syncUser(request, env)
  if (user instanceof Response) return user
  const result = await env.DB.prepare("DELETE FROM sync_vaults WHERE user_id = ?").bind(user.id).run()
  return json({ deleted: Number(result.meta?.changes) > 0 })
}

export async function putVault(request: Request, env: AiEnv): Promise<Response> {
  const user = await syncUser(request, env)
  if (user instanceof Response) return user
  if (!canWrite(env, user)) return text("Encrypted sync is part of Pro", 403)
  if (await overRateLimit(env.DB, `sync:put:${user.id}`, 240, 60 * 60 * 1_000)) return text("Too many sync uploads. Try again later.", 429)
  const upload = validVaultUpload(await readBoundedJson<Record<string, unknown>>(request, MAX_BODY_BYTES))
  if (typeof upload === "string") return text(upload, upload.startsWith("Your workspace") ? 413 : 400)

  const now = Date.now()
  const nextVersion = upload.baseVersion + 1
  // Optimistic concurrency: write only on top of the version the client merged.
  const written = upload.baseVersion === 0
    ? await env.DB.prepare(
      `INSERT INTO sync_vaults (user_id, version, ciphertext, iv, salt, kdf_iterations, key_check, device_label, updated_at)
       VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO NOTHING
       RETURNING version`,
    ).bind(user.id, upload.ciphertext, upload.iv, upload.salt, upload.kdfIterations, upload.keyCheck, upload.deviceLabel, now).first<{ version: number }>()
    : await env.DB.prepare(
      `UPDATE sync_vaults
       SET version = ?, ciphertext = ?, iv = ?, salt = ?, kdf_iterations = ?, key_check = ?, device_label = ?, updated_at = ?
       WHERE user_id = ? AND version = ?
       RETURNING version`,
    ).bind(nextVersion, upload.ciphertext, upload.iv, upload.salt, upload.kdfIterations, upload.keyCheck, upload.deviceLabel, now, user.id, upload.baseVersion).first<{ version: number }>()
  if (!written) {
    const current = await readVault(env, user.id)
    return json({ conflict: true, version: current?.version ?? 0 }, 409)
  }
  if (upload.baseVersion === 0) await trackConversion(env, "sync_enabled", user.id)
  return json({ version: written.version, updatedAt: now })
}
