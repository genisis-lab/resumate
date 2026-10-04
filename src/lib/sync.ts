import { listApplications, replaceApplications } from "./applications"
import { listTombstones, saveTombstones, WORKSPACE_REPLACED_EVENT } from "./changes"
import { listJDs, replaceJDs } from "./jdLibrary"
import { loadStore, normalizeResume, persistStore } from "./storage"
import { decryptJson, deriveSyncKey, encryptJson, makeKeyCheck, newSalt, PBKDF2_ITERATIONS, verifyKeyCheck } from "./syncCrypto"
import { mergeWorkspaces, parseWorkspace, workspaceFingerprint, type Workspace } from "./workspace"

// Optional, end-to-end encrypted sync (Pro). Off by default. The passphrase
// and derived key stay on the device; the server stores ciphertext only.

const STATE_KEY = "resumate.sync.v1"
const MAX_CIPHERTEXT_CHARS = 1_500_000
const KEY_DB = "resumate-sync"
const KEY_STORE = "keys"

export interface SyncState {
  enabled: boolean
  userId: string
  version: number
  salt: string
  iterations: number
  keyCheck: string
  lastSyncedAt: number | null
  fingerprint: string
}

export interface RemoteVault {
  version: number
  ciphertext: string
  iv: string
  salt: string
  kdfIterations: number
  keyCheck: string
  deviceLabel: string | null
  updatedAt: number
}

export class SyncError extends Error {
  constructor(message: string, readonly code: "locked" | "passphrase" | "conflict" | "too_large" | "plan" | "auth" | "network" | "data") {
    super(message)
  }
}

let memoryKey: { userId: string; key: CryptoKey } | null = null
let applying = 0

export function isApplyingSync(): boolean {
  return applying > 0
}

export function readSyncState(): SyncState | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(STATE_KEY) || "null") as SyncState | null
    return parsed && parsed.enabled && typeof parsed.userId === "string" ? parsed : null
  } catch {
    return null
  }
}

function writeSyncState(state: SyncState | null): void {
  try {
    if (state) localStorage.setItem(STATE_KEY, JSON.stringify(state))
    else localStorage.removeItem(STATE_KEY)
  } catch {
    // Without storage, sync stays per-tab.
  }
}

// ---- Key storage: a non-extractable CryptoKey in IndexedDB, or memory only.

function openKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(KEY_DB, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(KEY_STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function keyDb<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  if (typeof indexedDB === "undefined") return undefined
  const db = await openKeyDb()
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const request = run(db.transaction(KEY_STORE, mode).objectStore(KEY_STORE))
      request.onsuccess = () => resolve(request.result as T | undefined)
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

async function rememberKey(userId: string, key: CryptoKey, persist: boolean): Promise<void> {
  memoryKey = { userId, key }
  if (!persist) return
  try {
    await keyDb("readwrite", (store) => store.put(key, userId))
  } catch {
    // Memory-only for this tab; the user is asked again next time.
  }
}

async function loadKey(userId: string): Promise<CryptoKey | null> {
  if (memoryKey?.userId === userId) return memoryKey.key
  try {
    const key = await keyDb<CryptoKey>("readonly", (store) => store.get(userId))
    if (key) memoryKey = { userId, key }
    return key || null
  } catch {
    return null
  }
}

async function forgetKey(userId: string): Promise<void> {
  memoryKey = null
  try {
    await keyDb("readwrite", (store) => store.delete(userId))
  } catch {
    // Nothing stored.
  }
}

export async function hasUnlockedKey(userId: string): Promise<boolean> {
  return Boolean(await loadKey(userId))
}

// ---- Workspace snapshot and apply.

export function localWorkspace(): Workspace {
  return { format: 1, resumes: loadStore().resumes, jds: listJDs(), applications: listApplications(), tombstones: listTombstones() }
}

function applyWorkspace(workspace: Workspace, before: Workspace): string[] {
  const previous = new Map(before.resumes.map((item) => [item.id, Number(item.updatedAt) || 0]))
  const changed = workspace.resumes.filter((item) => previous.get(item.id) !== (Number(item.updatedAt) || 0)).map((item) => item.id)
  const removed = before.resumes.filter((item) => !workspace.resumes.some((next) => next.id === item.id)).map((item) => item.id)
  applying += 1
  try {
    persistStore({ resumes: workspace.resumes.length ? workspace.resumes.map(normalizeResume) : loadStore().resumes })
    replaceJDs(workspace.jds)
    replaceApplications(workspace.applications)
    saveTombstones(workspace.tombstones)
  } finally {
    applying -= 1
  }
  const ids = [...changed, ...removed]
  if (ids.length) window.dispatchEvent(new CustomEvent(WORKSPACE_REPLACED_EVENT, { detail: { ids } }))
  return ids
}

// ---- Server calls.

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, { credentials: "same-origin", ...init, headers: { "content-type": "application/json", ...init?.headers } })
  } catch {
    throw new SyncError("You appear to be offline. Changes stay on this device and sync when you reconnect.", "network")
  }
  if (response.status === 401) throw new SyncError("Sign in to sync.", "auth")
  if (response.status === 403) throw new SyncError((await response.text()) || "Encrypted sync is part of Pro.", "plan")
  if (response.status === 413) throw new SyncError("Your workspace is too large to sync. Remove old applications or job posts and try again.", "too_large")
  if (response.status === 409) throw new SyncError("Another device synced at the same time.", "conflict")
  if (!response.ok) throw new SyncError((await response.text()) || "Sync is temporarily unavailable.", "network")
  return await response.json() as T
}

export async function fetchVault(): Promise<{ vault: RemoteVault | null; canWrite: boolean }> {
  return await api("/api/sync/vault")
}

function deviceLabel(): string {
  const agent = typeof navigator === "undefined" ? "" : navigator.userAgent
  const browser = /Edg\//.test(agent) ? "Edge" : /Firefox\//.test(agent) ? "Firefox" : /Chrome\//.test(agent) ? "Chrome" : /Safari\//.test(agent) ? "Safari" : "Browser"
  const system = /iPhone|iPad/.test(agent) ? "iOS" : /Android/.test(agent) ? "Android" : /Mac OS X/.test(agent) ? "macOS" : /Windows/.test(agent) ? "Windows" : /Linux/.test(agent) ? "Linux" : "device"
  return `${browser} on ${system}`
}

// ---- Public operations.

export interface SyncResult {
  version: number
  pulled: string[]
  pushed: boolean
  at: number
}

// Turn sync on for this device. With an existing vault the passphrase must
// open it; otherwise a new vault is created from this device's workspace.
export async function enableSync(userId: string, passphrase: string, remember: boolean): Promise<SyncResult> {
  const { vault, canWrite } = await fetchVault()
  if (!canWrite && !vault) throw new SyncError("Encrypted sync is part of Pro.", "plan")
  const salt = vault?.salt || newSalt()
  const iterations = vault?.kdfIterations || PBKDF2_ITERATIONS
  const key = await deriveSyncKey(passphrase, salt, iterations)
  if (vault && !(await verifyKeyCheck(key, userId, vault.keyCheck))) {
    throw new SyncError("That passphrase does not match your synced copy.", "passphrase")
  }
  const keyCheck = vault?.keyCheck || await makeKeyCheck(key, userId)
  await rememberKey(userId, key, remember)
  writeSyncState({ enabled: true, userId, version: 0, salt, iterations, keyCheck, lastSyncedAt: null, fingerprint: "" })
  return await syncNow(userId)
}

// Pull, merge, and push. Retries once when another device wins the race.
export async function syncNow(userId: string): Promise<SyncResult> {
  const state = readSyncState()
  if (!state || state.userId !== userId) throw new SyncError("Sync is off on this device.", "locked")
  const key = await loadKey(userId)
  if (!key) throw new SyncError("Enter your sync passphrase to unlock sync on this device.", "locked")

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { vault, canWrite } = await fetchVault()
    const before = localWorkspace()
    let remote: Workspace | null = null
    if (!vault && state.version > 0) {
      // Erased from another device: respect that instead of re-uploading.
      await disableSync(userId, false)
      throw new SyncError("Sync was turned off and the synced copy erased from another device. Your resumes on this device are unchanged.", "locked")
    }
    if (vault) {
      if (vault.salt !== state.salt || vault.kdfIterations !== state.iterations) {
        await disableSync(userId, false)
        throw new SyncError("Your synced copy was reset from another device. Turn sync on again with its passphrase.", "passphrase")
      }
      try {
        remote = parseWorkspace(await decryptJson(key, userId, vault))
      } catch (error) {
        throw new SyncError(error instanceof Error && /newer version/.test(error.message) ? error.message : "Your synced copy could not be decrypted with this device's key.", "data")
      }
    }
    const merged = remote ? mergeWorkspaces(before, remote) : before
    const pulled = workspaceFingerprint(merged) === workspaceFingerprint(before) ? [] : applyWorkspace(merged, before)
    const fingerprint = workspaceFingerprint(merged)
    const remoteFingerprint = remote ? workspaceFingerprint(remote) : null
    const version = vault?.version || 0
    if (fingerprint === remoteFingerprint || !canWrite) {
      const at = Date.now()
      writeSyncState({ ...state, version, lastSyncedAt: at, fingerprint })
      return { version, pulled, pushed: false, at }
    }
    const sealed = await encryptJson(key, userId, merged)
    if (sealed.ciphertext.length > MAX_CIPHERTEXT_CHARS) {
      throw new SyncError("Your workspace is too large to sync. Remove old applications or job posts and try again.", "too_large")
    }
    try {
      const saved = await api<{ version: number; updatedAt: number }>("/api/sync/vault", {
        method: "POST",
        body: JSON.stringify({ baseVersion: version, ...sealed, salt: state.salt, kdfIterations: state.iterations, keyCheck: state.keyCheck, deviceLabel: deviceLabel() }),
      })
      writeSyncState({ ...state, version: saved.version, lastSyncedAt: saved.updatedAt, fingerprint })
      return { version: saved.version, pulled, pushed: true, at: saved.updatedAt }
    } catch (error) {
      if (error instanceof SyncError && error.code === "conflict" && attempt < 2) continue
      throw error
    }
  }
  throw new SyncError("Another device keeps syncing at the same time. Try again in a moment.", "conflict")
}

// Turn sync off on this device. Optionally erase the server copy as well.
export async function disableSync(userId: string, deleteRemote: boolean): Promise<void> {
  if (deleteRemote) await api("/api/sync/delete", { method: "POST", body: "{}" })
  await forgetKey(userId)
  writeSyncState(null)
}
