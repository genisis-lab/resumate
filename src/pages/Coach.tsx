import { useRef, useState } from 'react'
import { ArrowLeft, ClipboardCheck, GitCompareArrows, MessageCircleQuestion, PenLine, SearchCheck, SpellCheck, Sparkles, type LucideIcon } from 'lucide-react'
import type { Resume } from '../types/resume'
import type { PlanId } from '../lib/billing'
import { aiCoach, type CoachMode, type CoachResult } from '../lib/ai'
import { coachSource, consistencyIssues, writingFields, replaceWritingField } from '../lib/coach'
import { ReviewEdits } from '../components/ReviewEdits'
import { AiActionBudget } from '../components/AiActionBudget'
import { uid } from '../lib/id'
import { navigate } from '../router'
import { readSavedJob, writeSavedJob } from '../lib/jobContext'

type ToolMode = Exclude<CoachMode, 'rewrite'>
const modes: { id: ToolMode; label: string; description: string; icon: LucideIcon }[] = [
  { id: 'review', label: 'Resume review', description: 'Prioritized fixes for your whole resume', icon: ClipboardCheck },
  { id: 'role', label: 'Role builder', description: 'Turn answers about a job into bullets', icon: PenLine },
  { id: 'grammar', label: 'Grammar review', description: 'Spelling, tense, and phrasing fixes', icon: SpellCheck },
  { id: 'evidence', label: 'Job evidence', description: 'Map job requirements to your proof', icon: SearchCheck },
  { id: 'consistency', label: 'Consistency check', description: 'Dates, titles, and duplicate claims', icon: GitCompareArrows },
  { id: 'practice', label: 'Interview practice', description: 'Answer questions and get feedback', icon: MessageCircleQuestion },
]
const PRIORITY_LABEL: Record<string, string> = { high: 'High impact', medium: 'Worth doing', low: 'Polish' }

export function Coach(props: {resume: Resume; setResume: (r: Resume | ((r: Resume) => Resume)) => void; plan: PlanId}) {
  const [mode, setMode] = useState<ToolMode>(() => { const requested = new URLSearchParams(window.location.search).get('mode'); return modes.find(m => m.id === requested)?.id || 'review' })
  return <div className="tool-page coach-page">
    <header className="page-header">
      <button className="btn-ghost small back-link" onClick={() => navigate('/builder')}><ArrowLeft size={15} aria-hidden="true" /> Back to editor</button>
      <h1>AI coach</h1>
      <p className="page-sub">Build from your real experience. Every suggestion is grounded in your resume and waits for your review before anything changes.</p>
    </header>
    <div className="mode-grid" role="radiogroup" aria-label="Coaching tool">
      {modes.map(m => <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} className={`mode-card${mode === m.id ? ' active' : ''}`} onClick={() => setMode(m.id)}>
        <span className="mode-icon" aria-hidden="true"><m.icon size={18} /></span>
        <span><strong>{m.label}</strong><span>{m.description}</span></span>
      </button>)}
    </div>
    <CoachTool key={`${mode}:${props.resume.id}`} {...props} mode={mode} />
  </div>
}

function CoachTool({resume, setResume, plan, mode}: {resume: Resume; setResume: (r: Resume | ((r: Resume) => Resume)) => void; plan: PlanId; mode: ToolMode}) {
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
  const [jd, setJdState] = useState(readSavedJob)
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
  const meta = modes.find(m => m.id === mode)!
  const setJd = (value: string) => { setJdState(value); writeSavedJob(value) }

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
  const area = (label: string, value: string, setter: (s: string) => void, placeholder = '', rows = 3) => <label className="field"><span className="field-label">{label}</span><textarea className="field-input" rows={rows} value={value} disabled={busy} onChange={e => setter(e.target.value)} placeholder={placeholder} /></label>
  const input = (label: string, value: string, setter: (s: string) => void, placeholder = '') => <label className="field"><span className="field-label">{label}</span><input className="field-input" value={value} disabled={busy} maxLength={160} onChange={e => setter(e.target.value)} placeholder={placeholder} /></label>
  const runLabel = busy ? 'Working…' : mode === 'practice' ? question ? 'Review answer and ask follow-up' : 'Start interview practice' : mode === 'role' ? 'Draft bullets from my answers' : mode === 'review' ? 'Review my resume' : 'Run review'

  return <div className="tool-grid coach-grid">
    <section className="card tool-input" aria-labelledby="coach-tool-title">
      <h2 className="card-title" id="coach-tool-title">{meta.label}</h2>
      {mode === 'review' && <p className="hint">A recruiter-style pass over your whole resume: structure, clarity, evidence, consistency, and keywords. Fixes are ranked by impact.</p>}
      {mode === 'role' && <>
        <div className="grid-2">{input('Role / title', role, setRole, 'Customer Success Manager')}{input('Company', company, setCompany, 'Acme Corp')}</div>
        <label className="checkbox"><input type="checkbox" checked={current} disabled={busy} onChange={e => setCurrent(e.target.checked)} />I currently work here</label>
        {area('What did you actually do?', duties, setDuties, 'Describe your daily responsibilities and a specific example.', 4)}
        {area('Which tools or methods did you use?', tools, setTools, 'Salesforce, weekly QBRs, onboarding playbooks…', 2)}
        {area('Who benefited, and what changed?', impact, setImpact, 'Numbers are optional. Only include outcomes you can support.')}
        {result?.followUp && <><p className="coach-followup">{result.followUp}</p>{area('Additional detail', clarification, setClarification)}</>}
      </>}
      {mode === 'grammar' && <>
        <label className="field"><span className="field-label">Section to review</span><select className="field-input" disabled={busy} value={fieldKey} onChange={e => {setFieldKey(e.target.value); setResult(null)}}><option value="">Choose text</option>{fields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}</select></label>
        <div className="segmented" role="radiogroup" aria-label="Writing dialect">{['US English', 'UK English'].map(d => <button key={d} type="button" role="radio" aria-checked={dialect === d} disabled={busy} onClick={() => {setDialect(d); setResult(null)}}>{d}</button>)}</div>
        <blockquote className="coach-quote">{field?.text || 'No text selected.'}</blockquote>
      </>}
      {['evidence', 'practice'].includes(mode) && area('Target job description', jd, setJd, 'Paste the full job posting…', 7)}
      {mode === 'consistency' && <div className="local-checks"><h3>Local checks · no AI usage</h3>{checks.length ? <ul>{checks.map((issue, i) => <li key={i}>{issue}</li>)}</ul> : <p>No date-order or duplicate-bullet issues found.</p>}<p className="hint">AI review can also flag conflicting titles and claims for you to clarify.</p></div>}
      {mode === 'practice' && <>
        {question && <><p className="coach-followup"><strong>Question:</strong> {question}</p>{area('Your interview answer', answer, setAnswer, 'Answer as you would out loud. Situation, action, result works well.', 6)}</>}
        <p className="hint">Practice stays on this page until you leave. Each feedback request uses one AI action.</p>
      </>}
      <AiActionBudget plan={plan} refreshKey={version} />
      <button className="btn-primary" disabled={busy} onClick={run}><Sparkles size={16} aria-hidden="true" /> {runLabel}</button>
      {error && <p className="error-text" role="alert">{error}</p>}
      <p className="hint">On request, this sends {mode === 'grammar' ? 'only the selected text' : mode === 'role' ? 'your role answers' : 'your resume details'}{['evidence', 'practice'].includes(mode) ? ' and the job description' : ''} to the configured AI provider. Review feedback for accuracy.</p>
    </section>

    <section className="tool-output" aria-live="polite" aria-label="Coaching results">
      {!result && !turns.length && <div className="card empty-state"><span className="empty-icon" aria-hidden="true"><meta.icon size={24} /></span><p>{meta.description}. Results appear here.</p></div>}
      {mode === 'practice' && turns.map((turn, i) => <article className="card ai-review-item" key={i}><span className="eyebrow">Question {i + 1}</span><p><strong>{turn.question}</strong></p><p className="hint">Your answer</p><p>{turn.answer}</p><p className="hint">Feedback</p><p>{turn.feedback || 'No specific feedback returned.'}</p></article>)}
      {result && mode === 'review' && <div className="review-results">
        <div className="card review-overall"><span className="eyebrow">Overall</span><p>{result.followUp}</p></div>
        {result.items.map((item, i) => <article className={`card review-item priority-${item.category}`} key={i}>
          <span className={`priority-badge ${item.category}`}>{PRIORITY_LABEL[item.category] || item.category}</span>
          {item.original && <blockquote className="coach-quote">{item.original}</blockquote>}
          <p className="review-fix">{item.suggestion}</p>
          <p className="hint">{item.reason}</p>
        </article>)}
        <button className="btn-secondary" onClick={() => navigate('/builder')}>Open the editor to make changes</button>
      </div>}
      {result && mode === 'grammar' && (result.items.length ? <ReviewEdits key={version} originals={result.items.map(i => i.original)} suggestions={result.items.map(i => i.suggestion)} reasons={result.items.map(i => i.reason)} onAccept={acceptGrammar} onClose={() => setResult(null)} /> : <div className="card"><p>No concrete grammar issues found in the selected text.</p></div>)}
      {result && mode === 'role' && <>
        {result.items.length > 0 && !savedRole && <ReviewEdits key={version} originals={result.items.map(() => '')} suggestions={result.items.map(i => i.suggestion)} reasons={result.items.map(i => i.reason)} acceptLabel="Keep" onAccept={(_, __, suggestion) => {setAccepted(a => [...a, suggestion]); return true}} onClose={() => setResult(null)} />}
        <div className="card coach-save"><p className="hint">Keep the bullets you want, then add the role to your resume.</p><button className="btn-primary" disabled={!accepted.length || savedRole || busy} onClick={saveRole}>{savedRole ? 'Added to resume' : `Add role with ${accepted.length} kept bullet${accepted.length === 1 ? '' : 's'}`}</button>{savedRole && <p role="status">Role added. Open the editor to fill in dates and location.</p>}</div>
      </>}
      {result && mode === 'evidence' && <div className="card coach-table"><table><caption>Job requirements and resume evidence · AI interpretation, not a hiring score</caption><thead><tr><th>Requirement</th><th>Assessment</th><th>Evidence and explanation</th></tr></thead><tbody>{result.items.map((item, i) => <tr key={i}><td>{item.original}</td><td><span className={`evidence-badge ${item.category}`}>{item.category}</span></td><td>{item.suggestion && <blockquote className="coach-quote">{item.suggestion}</blockquote>}{item.reason}</td></tr>)}</tbody></table>{!result.items.length && <p>No requirements could be extracted. Try a more complete job description.</p>}</div>}
      {result && mode === 'consistency' && <div className="review-results">{result.items.length ? result.items.map((item, i) => <article className="card review-item" key={i}><blockquote className="coach-quote">{item.original}</blockquote><p className="review-fix">{item.suggestion}</p><p className="hint">{item.reason}</p></article>) : <div className="card"><p>No additional inconsistencies found.</p></div>}</div>}
    </section>
  </div>
}
