import React from "react"
import { aiRewriteBullets } from "../lib/ai"
import { scoreBullet } from "../lib/writingCoach"
import { ACTION_VERBS } from "../lib/actionVerbs"

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        className="field-input"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  hint?: string
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {hint && <span className="field-hint">{hint}</span>}
      </span>
      <textarea
        className="field-input"
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}


export function BulletEditor({
  bullets,
  onChange,
  aiContext,
}: {
  bullets: string[]
  onChange: (b: string[]) => void
  aiContext?: { role?: string; company?: string; current?: boolean }
}) {
  const bulletRoot = React.useRef<HTMLDivElement>(null)
  const pendingFocus = React.useRef<number | null>(null)
  React.useEffect(() => {
    if (pendingFocus.current === null) return
    const input = bulletRoot.current?.querySelectorAll<HTMLTextAreaElement>('textarea')[pendingFocus.current]
    input?.focus({ preventScroll: true })
    input?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    pendingFocus.current = null
  }, [bullets.length])
  const latest = React.useRef(bullets)
  latest.current = bullets
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState("")
  const [focused, setFocused] = React.useState<number | null>(null)
  const [showBank, setShowBank] = React.useState(false)
  const [dragIndex, setDragIndex] = React.useState<number | null>(null)

  const set = (i: number, v: string) => {
    const next = [...bullets]
    next[i] = v
    onChange(next)
  }
  const add = () => { pendingFocus.current = bullets.length; onChange([...bullets, ""]) }
  const remove = (i: number) => onChange(bullets.filter((_, idx) => idx !== i))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= bullets.length) return
    const next = [...bullets]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  // Verb examples start a new bullet; never destructively rewrite a sentence.
  const applyVerb = (i: number, verb: string) => {
    if (bullets[i]?.trim()) { pendingFocus.current = bullets.length; onChange([...bullets, `${verb} `]); setFocused(bullets.length) }
    else { set(i, `${verb} `); setFocused(i) }
  }

  const onDrop = (target: number) => {
    if (dragIndex === null || dragIndex === target) {
      setDragIndex(null)
      return
    }
    const next = [...bullets]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(target, 0, moved)
    onChange(next)
    setDragIndex(null)
  }

  async function improve() {
    const filled = bullets.filter((b) => b.trim())
    if (!filled.length) {
      setErr("Add a bullet first, then let AI polish it.")
      return
    }
    setErr("")
    setBusy(true)
    try {
      const improved = await aiRewriteBullets(filled, aiContext || {})
      let k = 0
      const next = bullets.map((b) => (b.trim() ? improved[k++] ?? b : b))
      if (latest.current !== bullets) { setErr("Your bullets changed while AI was working. Try again to improve the latest version."); return }
      onChange(next)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "AI rewrite failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bullets" ref={bulletRoot}>
      <span className="field-label">Highlights / bullet points</span>
      {bullets.map((b, i) => {
        const sc = scoreBullet(b, aiContext)
        return (
          <div
            className={`bullet-row ${dragIndex === i ? "dragging" : ""}`}
            key={i}
            onDragOver={(e) => {
              if (dragIndex !== null) e.preventDefault()
            }}
            onDrop={() => onDrop(i)}
          >
            <span
              className="drag-handle"
              draggable
              title="Drag to reorder"
              aria-label="Drag to reorder bullet"
              onDragStart={(e) => {
                setDragIndex(i)
                e.dataTransfer.effectAllowed = "move"
              }}
              onDragEnd={() => setDragIndex(null)}
            >
              ⠿
            </span>
            <div className="bullet-main">
              <textarea
                className="field-input bullet-input"
                rows={2}
                value={b}
                placeholder="Describe what you did, who or what it helped, and the outcome…"
                onChange={(e) => set(i, e.target.value)}
                onFocus={() => setFocused(i)}
                aria-label={`Bullet ${i + 1}`}
              />
              {sc && (
                <div className="bw">
                  <span className="bw-label">{sc.issues.length ? 'Writing checks' : 'No basic writing issues found'}</span>
                </div>
              )}
              {sc && sc.issues.length > 0 && (
                <ul className="bw-issues">
                  {sc.issues.map((it, k) => (
                    <li key={k}>{it}</li>
                  ))}
                </ul>
              )}

            </div>
            <div className="bullet-actions">
              <button type="button" title="Move up" aria-label="Move bullet up" onClick={() => move(i, -1)}>↑</button>
              <button type="button" title="Move down" aria-label="Move bullet down" onClick={() => move(i, 1)}>↓</button>
              <button type="button" title="Remove" aria-label="Remove bullet" className="danger" onClick={() => remove(i)}>✕</button>
            </div>
          </div>
        )
      })}
      <div className="bullet-toolbar">
        <button type="button" className="btn-ghost small" onClick={add}>+ Add bullet</button>
        <button type="button" className="btn-ghost small" onClick={() => setShowBank((s) => !s)} aria-expanded={showBank}>
          {showBank ? "Hide verb bank" : "Action verbs"}
        </button>
        {aiContext && (
          <button
            type="button"
            className="btn-secondary small"
            disabled={busy || !bullets.some(b => b.trim())}
            onClick={improve}
            title="Rewrite these bullets with stronger, ATS-friendly phrasing"
          >
            {busy ? "Improving…" : "✨ Improve with AI"}
          </button>
        )}
      </div>
      {showBank && (
        <div className="verb-bank">
          <p className="hint">Examples only: choose a verb that accurately describes your work. Clicking starts a new bullet if the selected one has text.</p>
          {Object.entries(ACTION_VERBS).map(([group, verbs]) => (
            <div className="verb-group" key={group}>
              <span className="verb-group-name">{group}</span>
              {verbs.map((v) => (
                <button
                  type="button"
                  className="verb-chip"
                  key={v}
                  onClick={() => {
                    const target = focused !== null && focused < bullets.length ? focused : bullets.length ? 0 : null
                    if (target === null) {
                      onChange([`${v} `])
                      setFocused(0)
                    } else {
                      applyVerb(target, v)
                    }
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      {aiContext && !bullets.some(b => b.trim()) && <p className="hint">Add a bullet about your work before improving it with AI.</p>}
      {err && <p className="ai-error">{err}</p>}
    </div>
  )
}

export function Collapsible({
  title,
  subtitle,
  children,
  onRemove,
  onMoveUp,
  onMoveDown,
  defaultOpen,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  onRemove?: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  defaultOpen?: boolean
}) {
  const [open, setOpen] = React.useState(defaultOpen ?? true)
  return (
    <div className="collapsible">
      <div className="collapsible-head">
        <button
          type="button"
          className="collapsible-toggle"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <span className={`chevron ${open ? "open" : ""}`} aria-hidden="true">›</span>
          <span className="collapsible-title">{title || "Untitled"}</span>
          {subtitle && <span className="collapsible-sub">{subtitle}</span>}
        </button>
        <div className="collapsible-actions">
          {onMoveUp && <button type="button" title="Move up" aria-label="Move up" onClick={onMoveUp}>↑</button>}
          {onMoveDown && <button type="button" title="Move down" aria-label="Move down" onClick={onMoveDown}>↓</button>}
          {onRemove && (
            <button type="button" title="Remove" aria-label="Remove" className="danger" onClick={onRemove}>✕</button>
          )}
        </div>
      </div>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  )
}
