import { Resume } from "../types/resume"
import { createEmptyResume } from "../data/sample"

const STORE_KEY = "resumate.resumes.v1"
const ACTIVE_KEY = "resumate.active.v1"
const THEME_KEY = "resumate.theme.v1"

interface StoreShape {
  resumes: Resume[]
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function loadStore(): StoreShape {
  const store = safeParse<StoreShape>(localStorage.getItem(STORE_KEY), {
    resumes: [],
  })
  if (!store.resumes || store.resumes.length === 0) {
    const first = createEmptyResume("My Resume")
    store.resumes = [first]
    persistStore(store)
    setActiveId(first.id)
  }
  return store
}

export function persistStore(store: StoreShape): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store))
  } catch (e) {
    console.warn("ResuMate: could not save to this browser's storage (it may be full or blocked).", e)
  }
}

export function getActiveId(): string | null {
  return localStorage.getItem(ACTIVE_KEY)
}

export function setActiveId(id: string): void {
  localStorage.setItem(ACTIVE_KEY, id)
}

export function saveResume(resume: Resume): void {
  const store = loadStore()
  const idx = store.resumes.findIndex((r) => r.id === resume.id)
  const updated = { ...resume, updatedAt: Date.now() }
  if (idx >= 0) store.resumes[idx] = updated
  else store.resumes.push(updated)
  persistStore(store)
}

export function deleteResume(id: string): void {
  const store = loadStore()
  store.resumes = store.resumes.filter((r) => r.id !== id)
  if (store.resumes.length === 0) {
    const first = createEmptyResume("My Resume")
    store.resumes.push(first)
    setActiveId(first.id)
  } else if (getActiveId() === id) {
    setActiveId(store.resumes[0].id)
  }
  persistStore(store)
}

// ---- Theme (dark mode) ----
export function getTheme(): "light" | "dark" {
  const t = localStorage.getItem(THEME_KEY)
  if (t === "dark" || t === "light") return t
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

export function setTheme(theme: "light" | "dark"): void {
  localStorage.setItem(THEME_KEY, theme)
  document.documentElement.dataset.theme = theme
}

// ---- Import / Export JSON ----
export function exportResumeJSON(resume: Resume): void {
  const blob = new Blob([JSON.stringify(resume, null, 2)], {
    type: "application/json",
  })
  triggerDownload(blob, `${sanitize(resume.contact.fullName || resume.name)}.resume.json`)
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function sanitize(name: string): string {
  return (name || "resume").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "resume"
}

// ---- Privacy: wipe all locally stored resume data ----
export function clearAllData(): void {
  localStorage.removeItem(STORE_KEY)
  localStorage.removeItem(ACTIVE_KEY)
  // Theme preference is intentionally kept; it isn't personal resume data.
}

// ---- Backup: download every saved resume as one JSON file ----
export function exportAllJSON(): void {
  const store = loadStore()
  const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" })
  triggerDownload(blob, "resumate_backup.json")
}

// ---- Restore: merge a full backup produced by exportAllJSON ----
export async function importAllJSON(file: File): Promise<number> {
  const text = await file.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error("That file isn't valid JSON.")
  }
  const incoming = (parsed as Partial<StoreShape>)?.resumes
  if (!Array.isArray(incoming) || incoming.length === 0) {
    throw new Error("This doesn't look like a ResuMate backup (no resumes found).")
  }
  const store = loadStore()
  const byId = new Map(store.resumes.map((r) => [r.id, r]))
  for (const r of incoming) {
    if (r && typeof r.id === "string") byId.set(r.id, r as Resume)
  }
  store.resumes = Array.from(byId.values())
  persistStore(store)
  return incoming.length
}

// ---- Duplicate a saved resume ----
export function duplicateResume(id: string): Resume | null {
  const store = loadStore()
  const src = store.resumes.find((r) => r.id === id)
  if (!src) return null
  const copy: Resume = {
    ...JSON.parse(JSON.stringify(src)),
    id: createEmptyResume().id,
    name: `${src.name} (copy)`,
    updatedAt: Date.now(),
  }
  store.resumes.push(copy)
  persistStore(store)
  return copy
}
