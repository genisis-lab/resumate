import React, { useState } from "react"
import { Resume } from "../types/resume"
import { AtsResult, analyzeWithAI, analyzeLocally } from "../lib/ats"
import { aiTailorResume, aiProofread, TailorResult } from "../lib/ai"
import { listJDs, saveJD, deleteJD, SavedJD } from "../lib/jdLibrary"
import { ResumePreview } from "../templates/ResumePreview"
import { navigate } from "../router"
import { importResumeFromFile } from "../lib/importResume"

function ScoreGauge({ score }: { score: number }) {
  const tone = score >= 80 ? "good" : score >= 60 ? "ok" : "bad"
  const deg = Math.round((score / 100) * 360)
  const gaugeStyle = {
    background: `conic-gradient(var(--gauge) ${deg}deg, var(--track) ${deg}deg)`,
  } as React.CSSProperties
  return (
    <div className={`gauge tone-${tone}`}>
      <div className="gauge-ring" style={gaugeStyle}>
        <div className="gauge-center">
          <span className="gauge-score">{score}</span>
          <span className="gauge-max">/ 100</span>
        </div>
      </div>
      <span className="gauge-label">ATS Match Score</span>
    </div>
  )
}

export function Analyze({
  resume,
  setResume,
}: {
  resume: Resume
  setResume: (r: Resume | ((p: Resume) => Resume)) => void
}) {
  const [jd, setJd] = useState(() => {
    try {
      return sessionStorage.getItem("resumate.jd") || ""
    } catch {
      return ""
    }
  })
  const [result, setResult] = useState<AtsResult | null>(null)
  const [targetRole, setTargetRole] = useState("")
  const [uploadedResume, setUploadedResume] = useState<Resume | null>(null)
  const [uploadedName, setUploadedName] = useState("")
  const [importing, setImporting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [tailoring, setTailoring] = useState(false)
  const [tailored, setTailored] = useState<TailorResult | null>(null)
  const [tailorErr, setTailorErr] = useState("")
  const [proofing, setProofing] = useState(false)
  const [issues, setIssues] = useState<string[] | null>(null)
  const [proofErr, setProofErr] = useState("")
  const [jds, setJds] = useState<SavedJD[]>(() => listJDs())
  const analysisResume = uploadedResume || resume

  async function onResumeFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError("Choose a PDF or text resume no larger than 5 MB.")
      return
    }
    if (file.type && file.type !== "application/pdf" && file.type !== "text/plain" && !file.name.toLowerCase().endsWith(".txt")) {
      setError("Choose a text-based PDF or .txt resume.")
      return
    }
    setError("")
    setImporting(true)
    try {
      const parsed = await importResumeFromFile(file)
      setUploadedResume(parsed)
      setUploadedName(file.name)
      setResult(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That resume could not be read.")
    } finally {
      setImporting(false)
    }
  }

  function onJd(v: string) {
    setJd(v)
    try {
      sessionStorage.setItem("resumate.jd", v)
    } catch {
      /* ignore storage errors */
    }
  }

  function onSaveJd() {
    if (!jd.trim()) {
      setError("Paste a job description first.")
      return
    }
    saveJD(jd)
    setJds(listJDs())
  }

  function onLoadJd(id: string) {
    if (!id) return
    const found = jds.find((j) => j.id === id)
    if (found) onJd(found.text)
  }

  function onDeleteJd(id: string) {
    deleteJD(id)
    setJds(listJDs())
  }

  async function run(useAi: boolean) {
    if (jd.trim().length < 80) {
      setError("Paste at least 80 characters from the job description for a useful comparison.")
      return
    }
    setError("")
    setLoading(true)
    try {
      const res = useAi
        ? await analyzeWithAI(analysisResume, jd, targetRole)
        : analyzeLocally(analysisResume, jd, targetRole)
      setResult(res)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }

  async function tailor() {
    if (!jd.trim()) {
      setTailorErr("Paste a job description first.")
      return
    }
    setTailorErr("")
    setTailoring(true)
    setTailored(null)
    try {
      setTailored(await aiTailorResume(resume, jd))
    } catch (e) {
      setTailorErr(e instanceof Error ? e.message : "Couldn't tailor your resume.")
    } finally {
      setTailoring(false)
    }
  }

  function applyTailored() {
    if (tailored?.summary) setResume((r) => ({ ...r, summary: tailored.summary }))
    setTailored(null)
  }

  async function proofread() {
    setProofErr("")
    setProofing(true)
    setIssues(null)
    try {
      setIssues(await aiProofread(resume))
    } catch (e) {
      setProofErr(e instanceof Error ? e.message : "Couldn't proofread your resume.")
    } finally {
      setProofing(false)
    }
  }

  return (
    <div className="analyze">
      <div className="analyze-head">
        <button className="btn-ghost small" onClick={() => navigate("/builder")}>← Back to editor</button>
        <h1>Job-specific resume check</h1>
        <p className="muted">Compare a resume with a real job description using a transparent, deterministic baseline. The score is guidance, not an employer's private ATS result.</p>
      </div>

      <div className="analyze-grid">
        <div className="jd-pane">
          <div className="analysis-source" aria-label="Resume used for this check">
            <div>
              <strong>{uploadedResume ? uploadedName : "Current editor resume"}</strong>
              <span>{uploadedResume ? "Parsed locally for this analysis only" : "Uses the resume open in your editor"}</span>
            </div>
            <div className="analysis-source-actions">
              <label className="btn-ghost small file-action">
                {importing ? "Reading…" : "Use PDF or TXT"}
                <input type="file" accept="application/pdf,text/plain,.txt" onChange={onResumeFile} disabled={importing} aria-label="Choose a PDF or text resume for analysis" />
              </label>
              {uploadedResume && <button className="btn-ghost small" onClick={() => { setUploadedResume(null); setUploadedName(""); setResult(null) }}>Use editor resume</button>}
            </div>
          </div>
          <label className="analysis-role">
            <span>Target role <em>optional</em></span>
            <input className="input" value={targetRole} onChange={(event) => setTargetRole(event.target.value.slice(0, 160))} placeholder="e.g. Senior Product Designer" />
          </label>
          <div className="jd-library">
            <select className="select" defaultValue="" onChange={(e) => { onLoadJd(e.target.value); e.target.value = "" }} title="Load a saved job description">
              <option value="">Saved jobs…</option>
              {jds.map((j) => (
                <option key={j.id} value={j.id}>{j.title}</option>
              ))}
            </select>
            <button className="btn-ghost small" onClick={onSaveJd} title="Save this job description for later">Save JD</button>
          </div>
          {jds.length > 0 && (
            <div className="jd-chips">
              {jds.map((j) => (
                <span key={j.id} className="jd-chip">
                  <button className="jd-chip-load" onClick={() => onLoadJd(j.id)} title={j.title}>{j.title}</button>
                  <button className="jd-chip-x" onClick={() => onDeleteJd(j.id)} aria-label="Delete saved job">×</button>
                </span>
              ))}
            </div>
          )}
          <textarea
            className="jd-input"
            placeholder="Paste the full job description here…"
            value={jd}
            onChange={(e) => onJd(e.target.value)}
            aria-label="Job description"
          />
          <div className="jd-actions">
            <button className="btn-primary" disabled={loading} onClick={() => run(false)}>
              {loading ? "Checking\u2026" : "Run local job match"}
            </button>
            <button className="btn-ghost" disabled={loading} onClick={() => run(true)} title="Requires a configured AI provider">
              Optional AI review
            </button>
          </div>
          <div className="jd-actions">
            <button className="btn-secondary" disabled={tailoring} onClick={tailor} title="Use AI to tailor your resume for this job">
              {tailoring ? "Tailoring\u2026" : "\u2728 Tailor my resume"}
            </button>
            <button className="btn-secondary" disabled={proofing} onClick={proofread} title="Grammar & tone proofread">
              {proofing ? "Checking\u2026" : "\u2728 Proofread"}
            </button>
            <button className="btn-ghost" onClick={() => navigate("/cover")} title="Draft a cover letter for this job">✍️ Cover letter</button>
          </div>
          {tailorErr && <p className="error">{tailorErr}</p>}
          {tailored && (
            <div className="tailored-box">
              <strong>Suggested summary</strong>
              <p>{tailored.summary}</p>
              {tailored.missingKeywords.length > 0 && (
                <p className="muted small">Consider adding: {tailored.missingKeywords.join(", ")}</p>
              )}
              {tailored.suggestions.length > 0 && (
                <ul className="tailor-suggestions">
                  {tailored.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              )}
              <div className="jd-actions">
                <button className="btn-primary small" onClick={applyTailored}>Apply summary</button>
                <button className="btn-ghost small" onClick={() => setTailored(null)}>Dismiss</button>
              </div>
            </div>
          )}
          {proofErr && <p className="error">{proofErr}</p>}
          {issues && (
            <div className="tailored-box">
              <strong>Proofread results</strong>
              {issues.length === 0 ? (
                <p className="muted">No issues found — your writing looks clean! ✅</p>
              ) : (
                <ul className="tailor-suggestions">
                  {issues.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              )}
              <div className="jd-actions">
                <button className="btn-ghost small" onClick={() => setIssues(null)}>Dismiss</button>
              </div>
            </div>
          )}
          {error && <p className="error">{error}</p>}
          <p className="hint-text">The local job match and uploaded file stay in this browser. Optional AI actions send only the selected resume and job-description text through ResuMate's validated server boundary and require a configured provider; they do not silently replace the local result.</p>
        </div>

        <div className="result-pane">
          {!result && !loading && (
            <div className="empty-state">
              <div className="empty-emoji" aria-hidden="true">📊</div>
              <p>Your local match score, requirement signals, and suggestions will appear here.</p>
            </div>
          )}
          {result && (
            <div className="result">
              <div className="result-top">
                <ScoreGauge score={result.score} />
                <div className="result-summary">
                  <span className={`badge ${result.source}`}>{result.source === "ai" ? "Optional AI review" : "Deterministic local check"}</span>
                  <p>{result.summary}</p>
                </div>
              </div>

              {result.sections && result.sections.length > 0 && (
                <div className="section-breakdown">
                  <h3>Score breakdown</h3>
                  {result.sections.map((s, i) => {
                    const pct = s.max ? Math.round((s.score / s.max) * 100) : 0
                    const tone = pct >= 80 ? "good" : pct >= 50 ? "ok" : "bad"
                    const barStyle = { width: `${pct}%` } as React.CSSProperties
                    return (
                      <div className="breakdown-row" key={i}>
                        <div className="breakdown-head">
                          <span className="breakdown-label">{s.label}</span>
                          <span className="breakdown-score">{s.score}/{s.max}</span>
                        </div>
                        <div className="breakdown-track">
                          <div className={`breakdown-fill tone-${tone}`} style={barStyle} />
                        </div>
                        {s.note && <span className="breakdown-note">{s.note}</span>}
                      </div>
                    )
                  })}
                </div>
              )}

              {result.jobSignals && result.jobSignals.length > 0 && (
                <div className="job-signals">
                  <h3>Job-description signals</h3>
                  <p>Required and preferred wording is prioritized; add a term only when it reflects your real experience.</p>
                  <div className="signal-list">
                    {result.jobSignals.map((signal) => (
                      <span key={`${signal.priority}:${signal.term}`} className={`job-signal ${signal.matched ? "matched" : "missing"}`}>
                        <span>{signal.term}</span><small>{signal.priority}{signal.matched ? " · found" : " · review"}</small>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="keywords">
                <div className="kw-col">
                  <h3>Matched ({result.matchedKeywords.length})</h3>
                  <div className="kw-chips">
                    {result.matchedKeywords.map((k, i) => (
                      <span key={i} className="kw matched">{k}</span>
                    ))}
                    {!result.matchedKeywords.length && <span className="muted">None yet</span>}
                  </div>
                </div>
                <div className="kw-col">
                  <h3>Missing ({result.missingKeywords.length})</h3>
                  <div className="kw-chips">
                    {result.missingKeywords.map((k, i) => (
                      <span key={i} className="kw missing">{k}</span>
                    ))}
                    {!result.missingKeywords.length && <span className="muted">Great — no gaps!</span>}
                  </div>
                </div>
              </div>

              <div className="suggestions">
                <h3>Suggestions</h3>
                {result.suggestions.map((s, i) => (
                  <div key={i} className={`suggestion sev-${s.severity}`}>
                    <span className="sug-section">{s.section}</span>
                    <span className="sug-text">{s.text}</span>
                  </div>
                ))}
                {!result.suggestions.length && <p className="muted">No major issues found.</p>}
              </div>
            </div>
          )}
        </div>
      </div>

      {result && (
        <section className="hl-preview-wrap">
          <div className="hl-preview-head">
            <h2>Resume preview <span className="muted">— matched keywords highlighted</span></h2>
            <button className="btn-ghost small" onClick={() => navigate("/cover")}>✍️ Generate cover letter</button>
          </div>
          <div className="hl-preview">
            <ResumePreview resume={analysisResume} highlight={result.matchedKeywords} />
          </div>
        </section>
      )}
    </div>
  )
}
