import React from "react"
import { aiRewriteBullets } from "../lib/ai"
import { scoreBullet } from "../lib/writingCoach"
import { suggestVerbsFor, ACTION_VERBS } from "../lib/actionVerbs"

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

const LEVEL_LABEL: Record<string, string> = { weak: "Needs work", ok: "Good", strong: "Strong" }

export function BulletEditor({
  bullets,
  onChange,
  aiContext,
}: {
  bullets: string[]
  onChange: (b: string[]) => void
  aiContext?: { role?: string; company?: string }
}) {
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
  const add = () => onChange([...bullets, ""])
  const remove = (i: number) => onChange(bullets.filter((_, idx) => idx !== i))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= bullets.length) return
    const next = [...bullets]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  // Replace the leading word of a bullet with a stronger action verb.
  const applyVerb = (i: number, verb: string) => {
    const text = bullets[i] || ""
    const rest = text.trimStart().replace(/^[A-Za-z'\u2019]+\s*/, "")
    set(i, rest ? `${verb} ${rest}` : `${verb} `)
    setFocused(i)
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
      onChange(next)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "AI rewrite failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bullets">
      <span className="field-label">Highlights / bullet points</span>
      {bullets.map((b, i) => {
        const sc = scoreBullet(b)
        const verbs = sc && sc.level === "weak" ? suggestVerbsFor(b) : []
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
                placeholder="Start with an action verb and quantify the impact…"
                onChange={(e) => set(i, e.target.value)}
                onFocus={() => setFocused(i)}
                aria-label={`Bullet ${i + 1}`}
              />
              {sc && (
                <div className="bw">
                  <span className={`bw-meter level-${sc.level}`}>
                    <span style={{ width: `${sc.score}%` }} />
                  </span>
                  <span className={`bw-label level-${sc.level}`}>{LEVEL_LABEL[sc.level]}</span>
                </div>
              )}
              {sc && sc.issues.length > 0 && (
                <ul className="bw-issues">
                  {sc.issues.map((it, k) => (
                    <li key={k}>{it}</li>
                  ))}
                </ul>
              )}
              {verbs.length > 0 && (
                <div className="bw-verbs">
                  <span className="bw-verbs-label">Try:</span>
                  {verbs.map((v) => (
                    <button type="button" className="verb-chip" key={v} onClick={() => applyVerb(i, v)}>
                      {v}
                    </button>
                  ))}
                </div>
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
            disabled={busy}
            onClick={improve}
            title="Rewrite these bullets with stronger, ATS-friendly phrasing"
          >
            {busy ? "Improving…" : "✨ Improve with AI"}
          </button>
        )}
      </div>
      {showBank && (
        <div className="verb-bank">
          <p className="hint">Click a verb to begin your selected bullet with it.</p>
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
