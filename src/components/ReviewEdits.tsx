import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { diffWords } from '../lib/diff'

function DiffText({ original, suggestion }: { original: string; suggestion: string }) {
  if (!original) return <p className="diff-text">{suggestion}</p>
  return (
    <p className="diff-text">
      {diffWords(original, suggestion).map((part, i) => part.type === 'same'
        ? <span key={i}>{part.text}</span>
        : part.type === 'removed'
          ? <del key={i}>{part.text}</del>
          : <ins key={i}>{part.text}</ins>)}
    </p>
  )
}

export function ReviewEdits({ originals, suggestions, reasons, onAccept, onClose, acceptLabel = 'Accept' }: {
  originals: string[]; suggestions: string[]; reasons?: string[]
  onAccept: (index: number, original: string, suggestion: string) => boolean
  onClose: () => void
  acceptLabel?: string
}) {
  const [decisions, setDecisions] = useState<Record<number, 'accepted' | 'rejected' | 'stale'>>({})
  const pending = suggestions.map((_, index) => index).filter((index) => !decisions[index] && suggestions[index] !== originals[index])
  const decide = (index: number, accept: boolean) => setDecisions((d) => ({ ...d, [index]: accept ? (onAccept(index, originals[index], suggestions[index]) ? 'accepted' : 'stale') : 'rejected' }))
  const acceptAll = () => {
    const next: Record<number, 'accepted' | 'stale'> = {}
    for (const index of pending) next[index] = onAccept(index, originals[index], suggestions[index]) ? 'accepted' : 'stale'
    setDecisions((d) => ({ ...d, ...next }))
  }
  return <section className="ai-review" aria-label="Review AI suggestions">
    <div className="ai-review-head">
      <div><h3>Review suggested changes</h3><p className="hint">Only accepted changes are applied. Check that each statement is accurate.</p></div>
      {pending.length > 1 && <button type="button" className="btn-secondary small" onClick={acceptAll}><Check size={14} aria-hidden="true" /> {acceptLabel} all ({pending.length})</button>}
    </div>
    {suggestions.map((suggestion, index) => {
      const unchanged = suggestion === originals[index]
      const decision = decisions[index]
      return <article className={`ai-review-item${decision ? ` decided ${decision}` : ''}`} key={index}>
        <DiffText original={originals[index]} suggestion={suggestion} />
        <p className="hint">{unchanged ? 'Already clear — no change suggested.' : reasons?.[index] || 'Alternative wording for clarity. Confirm it preserves your meaning.'}</p>
        {unchanged ? null : decision ? <p role="status" className="decision-status">{decision === 'accepted' ? 'Applied' : decision === 'rejected' ? 'Kept your original' : 'The source changed. Generate a fresh suggestion.'}</p> : <div className="row gap">
          <button type="button" className="btn-primary small" aria-label={`${acceptLabel} change ${index + 1}`} onClick={() => decide(index, true)}><Check size={14} aria-hidden="true" /> {acceptLabel}</button>
          <button type="button" className="btn-ghost small" aria-label={`Reject change ${index + 1}`} onClick={() => decide(index, false)}><X size={14} aria-hidden="true" /> Reject</button>
        </div>}
      </article>
    })}
    <button type="button" className="btn-ghost small" onClick={onClose}>Done reviewing</button>
  </section>
}
