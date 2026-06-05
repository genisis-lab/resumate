import React from "react"

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
}: {
  bullets: string[]
  onChange: (b: string[]) => void
}) {
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
          />
          <div className="bullet-actions">
            <button title="Move up" onClick={() => move(i, -1)}>↑</button>
            <button title="Move down" onClick={() => move(i, 1)}>↓</button>
            <button title="Remove" className="danger" onClick={() => remove(i)}>✕</button>
          </div>
        </div>
      ))}
      <button className="btn-ghost small" onClick={add}>+ Add bullet</button>
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
        <button className="collapsible-toggle" onClick={() => setOpen((o) => !o)}>
          <span className={`chevron ${open ? "open" : ""}`}>›</span>
          <span className="collapsible-title">{title || "Untitled"}</span>
          {subtitle && <span className="collapsible-sub">{subtitle}</span>}
        </button>
        <div className="collapsible-actions">
          {onMoveUp && <button title="Move up" onClick={onMoveUp}>↑</button>}
          {onMoveDown && <button title="Move down" onClick={onMoveDown}>↓</button>}
          {onRemove && (
            <button title="Remove" className="danger" onClick={onRemove}>✕</button>
          )}
        </div>
      </div>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  )
}
