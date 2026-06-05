// A small library of saved job descriptions, stored on-device. Lets the user
// keep the postings they're targeting and re-run the ATS check / tailoring
// against any of them without re-pasting.

import { uid } from "./id"

export interface SavedJD {
  id: string
  title: string
  text: string
  savedAt: number
}

const JD_KEY = "resumate.jds.v1"

export function listJDs(): SavedJD[] {
  try {
    const raw = localStorage.getItem(JD_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as SavedJD[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function persist(list: SavedJD[]): void {
  try {
    localStorage.setItem(JD_KEY, JSON.stringify(list))
  } catch {
    /* ignore storage errors */
  }
}

function deriveTitle(text: string): string {
  const firstLine = text.split(/\n/).map((l) => l.trim()).find((l) => l.length > 0) || "Untitled role"
  return firstLine.slice(0, 80)
}

export function saveJD(text: string, title?: string): SavedJD {
  const list = listJDs()
  const entry: SavedJD = {
    id: uid("jd"),
    title: (title && title.trim()) || deriveTitle(text),
    text,
    savedAt: Date.now(),
  }
  list.unshift(entry)
  persist(list.slice(0, 30))
  return entry
}

export function deleteJD(id: string): void {
  persist(listJDs().filter((j) => j.id !== id))
}
