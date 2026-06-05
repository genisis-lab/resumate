import React from "react"
import { aiRewriteBullets } from "../lib/ai"

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
  aiContext?: { role?: string; company?: string }
}) {
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState("")

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
      // Map improved bullets back onto the non-empty positions, preserving blanks.
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
      {bullets.map((b, i) => (
        <div className="bullet-row" key={i}>
          <textarea
            className="field-input bullet-input"
            rows={2}
            value={b}
            placeholder="Start with an action verb and quantify the impact…"
            onChange={(e) => set(i, e.target.value)}
            aria-label={`Bullet ${i + 1}`}
          />
          <div className="bullet-actions">
            <button type="button" title="Move up" aria-label="Move bullet up" onClick={() => move(i, -1)}>↑</button>
            <button type="button" title="Move down" aria-label="Move bullet down" onClick={() => move(i, 1)}>↓</button>
            <button type="button" title="Remove" aria-label="Remove bullet" className="danger" onClick={() => remove(i)}>✕</button>
          </div>
        </div>
      ))}
      <div className="bullet-toolbar">
        <button type="button" className="btn-ghost small" onClick={add}>+ Add bullet</button>
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
