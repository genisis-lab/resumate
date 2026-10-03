// Change notifications and deletion records for optional sync. Deletions are
// remembered briefly so a resume removed on one device is not restored by
// another device's older copy.

export const STORE_CHANGED_EVENT = "resumate:store-changed"
export const WORKSPACE_REPLACED_EVENT = "resumate:workspace-replaced"
const TOMBSTONE_KEY = "resumate.sync-tombstones.v1"
const TOMBSTONE_TTL_MS = 180 * 24 * 60 * 60 * 1_000

export interface Tombstone {
  id: string
  deletedAt: number
}

export function notifyStoreChanged(): void {
  try {
    window.dispatchEvent(new Event(STORE_CHANGED_EVENT))
  } catch {
    // No window (tests, workers).
  }
}

export function pruneTombstones(items: Tombstone[], now = Date.now()): Tombstone[] {
  const byId = new Map<string, Tombstone>()
  for (const item of items) {
    if (!item || typeof item.id !== "string" || !Number.isFinite(item.deletedAt) || now - item.deletedAt > TOMBSTONE_TTL_MS) continue
    const existing = byId.get(item.id)
    if (!existing || existing.deletedAt < item.deletedAt) byId.set(item.id, { id: item.id, deletedAt: item.deletedAt })
  }
  return [...byId.values()].slice(-500)
}

export function listTombstones(): Tombstone[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(TOMBSTONE_KEY) || "[]")
    return Array.isArray(parsed) ? pruneTombstones(parsed as Tombstone[]) : []
  } catch {
    return []
  }
}

export function saveTombstones(items: Tombstone[]): void {
  try {
    localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(pruneTombstones(items)))
  } catch {
    // Sync falls back to last-writer-wins for this item.
  }
}

export function recordDeletion(id: string): void {
  saveTombstones([...listTombstones(), { id, deletedAt: Date.now() }])
  notifyStoreChanged()
}
