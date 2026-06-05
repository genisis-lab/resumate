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
  localStorage.setItem(STORE_KEY, JSON.stringify(store))
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
