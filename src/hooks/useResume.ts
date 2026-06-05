import { useCallback, useEffect, useRef, useState } from "react"
import { Resume } from "../types/resume"
import {
  getActiveId,
  loadStore,
  saveResume,
  setActiveId,
} from "../lib/storage"

// How long edits are coalesced into a single undo step (ms).
const HISTORY_COALESCE_MS = 700
const HISTORY_LIMIT = 100

// Debounced autosave hook backed by localStorage, with coarse undo/redo.
export function useResume() {
  const [resume, setResumeState] = useState<Resume>(() => {
    const store = loadStore()
    const activeId = getActiveId()
    return store.resumes.find((r) => r.id === activeId) ?? store.resumes[0]
  })

  const timer = useRef<number | undefined>(undefined)
  const [savedAt, setSavedAt] = useState<number>(resume.updatedAt)

  // Undo/redo stacks. We keep snapshots of whole resume objects.
  const past = useRef<Resume[]>([])
  const future = useRef<Resume[]>([])
  const lastPush = useRef<number>(0)
  const [, force] = useState(0)
  const rerender = useCallback(() => force((n) => n + 1), [])

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

  // Record a history entry, coalescing rapid edits into one step.
  const pushHistory = useCallback((prev: Resume) => {
    const now = Date.now()
    if (now - lastPush.current > HISTORY_COALESCE_MS) {
      past.current.push(prev)
      if (past.current.length > HISTORY_LIMIT) past.current.shift()
      future.current = []
      rerender()
    }
    lastPush.current = now
  }, [rerender])

  // setResume wrapper that records history for undo/redo.
  const setResume = useCallback(
    (next: Resume | ((p: Resume) => Resume)) => {
      setResumeState((prev) => {
        pushHistory(prev)
        return typeof next === "function" ? (next as (p: Resume) => Resume)(prev) : next
      })
    },
    [pushHistory],
  )

  const update = useCallback((patch: Partial<Resume>) => {
    setResume((prev) => ({ ...prev, ...patch }))
  }, [setResume])

  // Reset history when the active resume identity changes.
  const resetHistory = useCallback(() => {
    past.current = []
    future.current = []
    lastPush.current = 0
    rerender()
  }, [rerender])

  const switchResume = useCallback((id: string) => {
    const store = loadStore()
    const found = store.resumes.find((r) => r.id === id)
    if (found) {
      setActiveId(id)
      setResumeState(found)
      resetHistory()
    }
  }, [resetHistory])

  const replaceResume = useCallback((next: Resume) => {
    setActiveId(next.id)
    saveResume(next)
    setResumeState(next)
    resetHistory()
  }, [resetHistory])

  const undo = useCallback(() => {
    if (!past.current.length) return
    setResumeState((curr) => {
      const prev = past.current.pop() as Resume
      future.current.push(curr)
      lastPush.current = 0
      return prev
    })
    rerender()
  }, [rerender])

  const redo = useCallback(() => {
    if (!future.current.length) return
    setResumeState((curr) => {
      const next = future.current.pop() as Resume
      past.current.push(curr)
      lastPush.current = 0
      return next
    })
    rerender()
  }, [rerender])

  return {
    resume,
    setResume,
    update,
    switchResume,
    replaceResume,
    savedAt,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  }
}
