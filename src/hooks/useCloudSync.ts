import { useEffect, useSyncExternalStore } from "react"
import type { AccountUser } from "../lib/auth"
import { STORE_CHANGED_EVENT } from "../lib/changes"
import { isApplyingSync, readSyncState, SyncError, syncNow } from "../lib/sync"

export type SyncStatus =
  | { kind: "off" }
  | { kind: "locked"; message: string }
  | { kind: "syncing" }
  | { kind: "synced"; at: number; version: number }
  | { kind: "error"; message: string; code: SyncError["code"] | "unknown" }

let status: SyncStatus = { kind: "off" }
let settingsRevision = 0
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function setStatus(next: SyncStatus): void {
  if (next.kind === "off" && status.kind === "off") return
  status = next
  emit()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribe, () => status, () => status)
}

// Call after turning sync on or off so the background hook re-attaches.
export function syncSettingsChanged(): void {
  settingsRevision += 1
  if (!readSyncState()) setStatus({ kind: "off" })
  emit()
}

let running: Promise<void> | null = null
let again = false

// Serialized: a request made while a sync runs triggers exactly one more.
export async function runSync(userId: string): Promise<void> {
  if (running) {
    again = true
    return await running
  }
  running = (async () => {
    do {
      again = false
      const state = readSyncState()
      if (!state || state.userId !== userId) {
        setStatus({ kind: "off" })
        return
      }
      setStatus({ kind: "syncing" })
      try {
        const result = await syncNow(userId)
        setStatus({ kind: "synced", at: result.at, version: result.version })
      } catch (error) {
        if (error instanceof SyncError && error.code === "locked") setStatus(readSyncState() ? { kind: "locked", message: error.message } : { kind: "off" })
        else setStatus({ kind: "error", message: error instanceof Error ? error.message : "Sync failed.", code: error instanceof SyncError ? error.code : "unknown" })
      }
    } while (again)
  })()
  try {
    await running
  } finally {
    running = null
  }
}

const EDIT_DEBOUNCE_MS = 4_000

// Mounted once in App. Does nothing unless the user turned sync on here.
export function useCloudSync(user: AccountUser | null): void {
  const userId = user?.emailVerified ? user.id : null
  const revision = useSyncExternalStore(subscribe, () => settingsRevision, () => settingsRevision)
  useEffect(() => {
    if (!userId) {
      setStatus({ kind: "off" })
      return
    }
    if (!readSyncState()) {
      setStatus({ kind: "off" })
      return
    }
    let timer: number | undefined
    const soon = () => {
      if (isApplyingSync() || !readSyncState()) return
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void runSync(userId), EDIT_DEBOUNCE_MS)
    }
    const now = () => {
      window.clearTimeout(timer)
      void runSync(userId)
    }
    const onVisibility = () => {
      if (document.visibilityState === "visible") now()
    }
    void runSync(userId)
    window.addEventListener(STORE_CHANGED_EVENT, soon)
    window.addEventListener("online", now)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener(STORE_CHANGED_EVENT, soon)
      window.removeEventListener("online", now)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [userId, revision])
}
