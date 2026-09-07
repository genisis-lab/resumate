import { useRef, useState } from 'react'
import type { Resume } from '../types/resume'
import type { PlanId } from '../lib/billing'
import { aiCoach, type CoachMode, type CoachResult } from '../lib/ai'
import { coachSource, consistencyIssues, writingFields, replaceWritingField } from '../lib/coach'
import { ReviewEdits } from '../components/ReviewEdits'
import { AiActionBudget } from '../components/AiActionBudget'
import { uid } from '../lib/id'
import { navigate } from '../router'

const modes: {id: Exclude<CoachMode, 'rewrite'>; label: string}[] = [
  {id: 'role', label: 'Guided role builder'}, {id: 'grammar', label: 'Grammar review'},
  {id: 'evidence', label: 'Job evidence'}, {id: 'consistency', label: 'Consistency check'}, {id: 'practice', label: 'Interview practice'},
]
export function Coach(props: {resume: Resume; setResume: (r: Resume | ((r: Resume) => Resume)) => void; plan: PlanId}) {
  const [mode, setMode] = useState<CoachMode>(() => { const requested = new URLSearchParams(window.location.search).get('mode'); return modes.find(m => m.id === requested)?.id || 'role' })
  return <div className="page narrow">
    <button className="btn-ghost small" onClick={() => navigate('/builder')}>← Back to editor</button>
    <h1>AI coach</h1>
    <p>Build from your real experience. Review suggestions before making changes.</p>
    <label className="field"><span>Choose a coaching tool</span><select className="field-input" value={mode} onChange={e => setMode(e.target.value as CoachMode)}>{modes.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
    <CoachTool key={`${mode}:${props.resume.id}`} {...props} mode={mode} />
  </div>
}
function CoachTool({resume, setResume, plan, mode}: {resume: Resume; setResume: (r: Resume | ((r: Resume) => Resume)) => void; plan: PlanId; mode: CoachMode}) {
  const latest = useRef(resume); latest.current = resume
  const fields = writingFields(resume)
  const [fieldKey, setFieldKey] = useState(fields[0]?.key || '')
  const field = fields.find(f => f.key === fieldKey)
  const [dialect, setDialect] = useState('US English')
  const [role, setRole] = useState('')
  const [company, setCompany] = useState('')
  const [duties, setDuties] = useState('')
  const [tools, setTools] = useState('')
  const [impact, setImpact] = useState('')
  const [clarification, setClarification] = useState('')
  const [current, setCurrent] = useState(true)
  const [jd, setJd] = useState(() => {try {return sessionStorage.getItem('resumate.jd') || ''} catch {return ''}})
  const [answer, setAnswer] = useState('')
  const [turns, setTurns] = useState<{question: string; answer: string; feedback: string}[]>([])
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState<CoachResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const [accepted, setAccepted] = useState<string[]>([])
  const [savedRole, setSavedRole] = useState(false)
  const snapshot = useRef({key: '', text: '', role: '', company: '', current: true, resumeId: resume.id})
  const grammarExpected = useRef('')
  const checks = consistencyIssues(resume)

  async function run() {
    setError('')
    if (mode === 'grammar' && !field) {setError('Write a summary, role bullet, or project description first.'); return}
    if (mode === 'role' && (!role.trim() || !duties.trim())) {setError('Enter a role and describe the work you actually did.'); return}
    if (mode === 'evidence' && jd.trim().length < 80) {setError('Paste at least 80 characters from the target job description.'); return}
    if (mode === 'practice' && question && !answer.trim()) {setError('Write your answer before requesting feedback.'); return}
    if (mode !== 'role' && mode !== 'grammar' && !fields.length) {setError('Add resume details in the editor first.'); return}
    setBusy(true)
    try {
      const source = mode === 'grammar' ? field!.text : mode === 'role' ? JSON.stringify({role, company, current, duties, tools, impact, clarification}) : coachSource(resume)
      const context = mode === 'grammar' ? `${dialect}. Field: ${field!.label}. Current role: ${field!.current ?? 'not specified'}.` : mode === 'practice' ? JSON.stringify({turns: turns.slice(-4), question, answer}) : ''
      if (source.length + (['evidence', 'practice'].includes(mode) ? jd.length : 0) + context.length > 23000) throw new Error('This request is too long. Shorten the job description or resume before trying again.')
      setResult(null)
      const response = await aiCoach(mode, source, ['evidence', 'practice'].includes(mode) ? jd : '', context)
      snapshot.current = {key: fieldKey, text: field?.text || '', role, company, current, resumeId: resume.id}
      grammarExpected.current = field?.text || ''
      if (mode === 'practice') {
        if (question) setTurns(t => [...t, {question, answer, feedback: response.items.map(i => `${i.suggestion} ${i.reason}`).join('\n')}])
        setQuestion(response.followUp); setAnswer('')
      }
      setResult(response); setAccepted([]); setSavedRole(false); setVersion(v => v + 1)
    } catch (e) {setError(e instanceof Error ? e.message : 'Coaching is unavailable. Please try again.')}
    finally {setBusy(false)}
  }
  function acceptGrammar(_: number, original: string, suggestion: string) {
    const snap = snapshot.current
    const currentText = writingFields(latest.current).find(f => f.key === snap.key)?.text
    if (latest.current.id !== snap.resumeId || currentText !== grammarExpected.current || !original || currentText.split(original).length !== 2) return false
    const replacement = currentText.replace(original, suggestion)
    setResume(r => replaceWritingField(r, snap.key, currentText, replacement))
    grammarExpected.current = replacement
    return true
  }
  function saveRole() {
    if (!accepted.length || savedRole || busy) return
    const snap = snapshot.current
    if (resume.id !== snap.resumeId) {setError('Your active resume changed. Generate a new draft.'); return}
    setResume(r => r.id !== snap.resumeId ? r : ({...r, experience: [...r.experience, {id: uid('exp'), role: snap.role, company: snap.company, current: snap.current, startDate: '', endDate: '', location: '', bullets: accepted}]}))
    setSavedRole(true)
  }
  const area = (label: string, value: string, setter: (s: string) => void, placeholder = '') => <label className="field"><span className="field-label">{label}</span><textarea className="field-input" rows={3} value={value} disabled={busy} onChange={e => setter(e.target.value)} placeholder={placeholder} /></label>
  return <section>
    <h2>{modes.find(m => m.id === mode)?.label}</h2>
    {mode === 'role' && <>
      <div className="grid-2">{area('Role / title', role, setRole)}{area('Company', company, setCompany)}</div>
      <label className="checkbox"><input type="checkbox" checked={current} disabled={busy} onChange={e => setCurrent(e.target.checked)} />I currently work here</label>
      {area('What did you actually do?', duties, setDuties, 'Describe your daily responsibilities and a specific example.')}
      {area('Which tools or methods did you use?', tools, setTools)}
      {area('Who benefited, and what changed?', impact, setImpact, 'Numbers are optional. Only include outcomes you can support.')}
      {result?.followUp && <><p>{result.followUp}</p>{area('Additional detail', clarification, setClarification)}</>}
    </>}
    {mode === 'grammar' && <>
      <label className="field"><span>Section to review</span><select className="field-input" disabled={busy} value={fieldKey} onChange={e => {setFieldKey(e.target.value); setResult(null)}}><option value="">Choose text</option>{fields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}</select></label>
      <label className="field"><span>Writing dialect</span><select className="field-input" disabled={busy} value={dialect} onChange={e => {setDialect(e.target.value); setResult(null)}}><option>US English</option><option>UK English</option></select></label>
      <blockquote>{field?.text || 'No text selected.'}</blockquote>
    </>}
    {['evidence', 'practice'].includes(mode) && area('Target job description', jd, setJd)}
    {mode === 'consistency' && <div className="card"><h3>Local checks · no AI usage</h3>{checks.length ? <ul>{checks.map((issue, i) => <li key={i}>{issue}</li>)}</ul> : <p>No date-order or duplicate-bullet issues found.</p>}<p className="hint">AI review can also flag conflicting titles and claims for you to clarify.</p></div>}
    {mode === 'practice' && <>
      {turns.map((turn, i) => <article className="ai-review-item" key={i}><h3>Question {i + 1}</h3><p>{turn.question}</p><strong>Your answer</strong><p>{turn.answer}</p><strong>Feedback</strong><p>{turn.feedback || 'No specific feedback returned.'}</p></article>)}
      {question && <><h3>{question}</h3>{area('Your interview answer', answer, setAnswer)}</>}
      <p className="hint">Practice stays in this page until you leave. Each feedback request uses one AI action.</p>
    </>}
    <AiActionBudget plan={plan} refreshKey={version} />
    <p className="hint">On request, this tool sends {mode === 'grammar' ? 'only the selected text' : mode === 'role' ? 'your role answers' : 'your resume details'}{['evidence', 'practice'].includes(mode) ? ' and job description' : ''} to your configured AI provider. Review feedback for accuracy.</p>
    <button className="btn-primary" disabled={busy} onClick={run}>{busy ? 'Working…' : mode === 'practice' ? question ? 'Review answer and ask follow-up' : 'Start interview practice' : mode === 'role' ? 'Draft bullets from my answers' : 'Run review'}</button>
    {error && <p className="error-text" role="alert">{error}</p>}
    {result && mode === 'grammar' && (result.items.length ? <ReviewEdits key={version} originals={result.items.map(i => i.original)} suggestions={result.items.map(i => i.suggestion)} reasons={result.items.map(i => i.reason)} onAccept={acceptGrammar} onClose={() => setResult(null)} /> : <p>No concrete grammar issues found in the selected text.</p>)}
    {result && mode === 'role' && <>
      <p className="hint">Accept the bullets you want, then use Add role to save them to your resume.</p>
      {result.items.length > 0 && !savedRole && <ReviewEdits key={version} originals={result.items.map(() => '')} suggestions={result.items.map(i => i.suggestion)} reasons={result.items.map(i => i.reason)} onAccept={(_, __, suggestion) => {setAccepted(a => [...a, suggestion]); return true}} onClose={() => setResult(null)} />}
      <button className="btn-secondary" disabled={!accepted.length || savedRole || busy} onClick={saveRole}>{savedRole ? 'Added to resume' : `Add role with ${accepted.length} accepted bullets`}</button>
      {savedRole && <p role="status">Role added. Open the editor to fill in dates and location.</p>}
    </>}
    {result && mode === 'evidence' && <div className="coach-table"><table><caption>Job requirements and resume evidence · AI interpretation, not a hiring score</caption><thead><tr><th>Requirement</th><th>Assessment</th><th>Evidence and explanation</th></tr></thead><tbody>{result.items.map((item, i) => <tr key={i}><td>{item.original}</td><td>{item.category}</td><td>{item.suggestion && <blockquote>{item.suggestion}</blockquote>}{item.reason}</td></tr>)}</tbody></table>{!result.items.length && <p>No requirements could be extracted. Try a more complete job description.</p>}</div>}
    {result && mode === 'consistency' && <div className="ai-review">{result.items.length ? result.items.map((item, i) => <article className="ai-review-item" key={i}><blockquote>{item.original}</blockquote><p>{item.suggestion}</p><p className="hint">{item.reason}</p></article>) : <p>No additional inconsistencies found.</p>}</div>}
  </section>
}
