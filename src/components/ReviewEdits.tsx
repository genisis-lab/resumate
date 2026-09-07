import { useState } from 'react'

export function ReviewEdits({ originals, suggestions, reasons, onAccept, onClose }: {
  originals: string[]; suggestions: string[]; reasons?: string[]
  onAccept: (index: number, original: string, suggestion: string) => boolean
  onClose: () => void
}) {
  const [decisions, setDecisions] = useState<Record<number, string>>({})
  return <section className="ai-review" aria-label="Review AI suggestions">
    <h3>Review suggested changes</h3><p className="hint">Only accepted changes are applied. Check that each statement is accurate.</p>
    {suggestions.map((suggestion, index) => <article className="ai-review-item" key={index}>
      <strong>Original</strong><p>{originals[index] || '(empty)'}</p>
      <strong>Suggestion</strong><p>{suggestion}</p>
      <p className="hint">{reasons?.[index] || 'Alternative wording for clarity. Confirm it preserves your meaning.'}</p>
      {decisions[index] ? <p role="status">{decisions[index]}</p> : <div className="row gap">
        <button type="button" className="btn-primary small" onClick={() => setDecisions(d => ({ ...d, [index]: onAccept(index, originals[index], suggestion) ? 'Accepted' : 'The source changed. Generate a fresh suggestion.' }))}>Accept change {index + 1}</button>
        <button type="button" className="btn-ghost small" onClick={() => setDecisions(d => ({ ...d, [index]: 'Rejected' }))}>Reject change {index + 1}</button>
      </div>}
    </article>)}
    <button type="button" className="btn-ghost small" onClick={onClose}>Close review</button>
  </section>
}
