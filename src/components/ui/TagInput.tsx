import { KeyboardEvent, useId, useState } from "react"
import { X } from "lucide-react"

// Chip-style list editor. Type and press Enter or comma to add; paste a
// comma-separated list to add several; Backspace on an empty field removes
// the last chip. Replaces a comma textarea that swallowed typed commas.
export function TagInput({
  label,
  values,
  onChange,
  placeholder,
  hint,
}: {
  label: string
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  hint?: string
}) {
  const [draft, setDraft] = useState("")
  const inputId = useId()
  const hintId = useId()

  function add(raw: string) {
    const incoming = raw.split(/[,\n;]+/).map((item) => item.trim()).filter(Boolean)
    if (!incoming.length) return
    const seen = new Set(values.map((value) => value.toLowerCase()))
    const next = [...values]
    for (const item of incoming) {
      if (seen.has(item.toLowerCase())) continue
      seen.add(item.toLowerCase())
      next.push(item.slice(0, 80))
    }
    onChange(next)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if ((event.key === "Enter" || event.key === ",") && draft.trim()) {
      event.preventDefault()
      add(draft)
      setDraft("")
    } else if (event.key === "Enter") {
      event.preventDefault()
    } else if (event.key === "Backspace" && !draft && values.length) {
      event.preventDefault()
      onChange(values.slice(0, -1))
    }
  }

  return (
    <div className="field tag-field">
      <label className="field-label" htmlFor={inputId}>
        {label}
        {hint && <span className="field-hint" id={hintId}>{hint}</span>}
      </label>
      <div className="tag-input" onClick={(event) => (event.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus()}>
        {values.map((value, index) => (
          <span className="tag-chip" key={`${value}-${index}`}>
            {value}
            <button type="button" aria-label={`Remove ${value}`} onClick={() => onChange(values.filter((_, i) => i !== index))}>
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={inputId}
          value={draft}
          placeholder={values.length ? "Add another…" : placeholder}
          aria-describedby={hint ? hintId : undefined}
          onChange={(event) => {
            const text = event.target.value
            if (/[,;\n]/.test(text)) {
              add(text)
              setDraft("")
            } else {
              setDraft(text)
            }
          }}
          onKeyDown={onKeyDown}
          onBlur={() => { if (draft.trim()) { add(draft); setDraft("") } }}
          onPaste={(event) => {
            const text = event.clipboardData.getData("text")
            if (/[,;\n]/.test(text)) {
              event.preventDefault()
              add(draft + text)
              setDraft("")
            }
          }}
        />
      </div>
    </div>
  )
}
