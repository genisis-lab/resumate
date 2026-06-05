import { useCallback, useEffect, useRef, useState } from "react"
import { Resume } from "../types/resume"
import {
  getActiveId,
  loadStore,
  saveResume,
  setActiveId,
} from "../lib/storage"

// Debounced autosave hook backed by localStorage.
export function useResume() {
  const [resume, setResume] = useState<Resume>(() => {
    const store = loadStore()
    const activeId = getActiveId()
    return (
      store.resumes.find((r) => r.id === activeId) ?? store.resumes[0]
    )
  })

  const timer = useRef<number | undefined>(undefined)
  const [savedAt, setSavedAt] = useState<number>(resume.updatedAt)

  // Debounced persistence on every change.
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      saveResume(resume)
      setSavedAt(Date.now())
    }, 500)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [resume])

  const update = useCallback((patch: Partial<Resume>) => {
    setResume((prev) => ({ ...prev, ...patch }))
  }, [])

  const switchResume = useCallback((id: string) => {
    const store = loadStore()
    const found = store.resumes.find((r) => r.id === id)
    if (found) {
      setActiveId(id)
      setResume(found)
    }
  }, [])

  const replaceResume = useCallback((next: Resume) => {
    setActiveId(next.id)
    saveResume(next)
    setResume(next)
  }, [])

  return { resume, setResume, update, switchResume, replaceResume, savedAt }
}
