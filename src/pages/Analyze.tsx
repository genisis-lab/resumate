import React, { useState } from "react"
import { Resume } from "../types/resume"
import { AtsResult, analyzeResume, analyzeLocally } from "../lib/ats"
import { aiTailorSummary } from "../lib/ai"
import { ResumePreview } from "../templates/ResumePreview"
import { navigate } from "../router"

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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [tailoring, setTailoring] = useState(false)
  const [tailored, setTailored] = useState<string | null>(null)
  const [tailorErr, setTailorErr] = useState("")

  function onJd(v: string) {
    setJd(v)
    try {
      sessionStorage.setItem("resumate.jd", v)
    } catch {
      /* ignore storage errors */
    }
  }

  async function run(useAi: boolean) {
    if (!jd.trim()) {
      setError("Paste a job description first.")
      return
    }
    setError("")
    setLoading(true)
    try {
      const res = useAi ? await analyzeResume(resume, jd) : analyzeLocally(resume, jd)
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
      const s = await aiTailorSummary(resume, jd)
      setTailored(s)
    } catch (e) {
      setTailorErr(e instanceof Error ? e.message : "Couldn't tailor your summary.")
    } finally {
      setTailoring(false)
    }
  }

  function applyTailored() {
    if (tailored) setResume((r) => ({ ...r, summary: tailored }))
    setTailored(null)
  }

  return (
    <div className="analyze">
      <div className="analyze-head">
        <button className="btn-ghost small" onClick={() => navigate("/builder")}>← Back to editor</button>
        <h1>ATS Score &amp; Optimization</h1>
        <p className="muted">Paste the job description you're targeting. We'll score your resume against it and suggest concrete improvements.</p>
      </div>

      <div className="analyze-grid">
        <div className="jd-pane">
          <textarea
            className="jd-input"
            placeholder="Paste the full job description here…"
            value={jd}
            onChange={(e) => onJd(e.target.value)}
            aria-label="Job description"
          />
          <div className="jd-actions">
            <button className="btn-primary" disabled={loading} onClick={() => run(true)}>
              {loading ? "Analyzing…" : "✨ Analyze with AI"}
            </button>
            <button className="btn-ghost" disabled={loading} onClick={() => run(false)} title="Instant offline scoring">
              Quick offline check
            </button>
          </div>
          <div className="jd-actions">
            <button className="btn-secondary" disabled={tailoring} onClick={tailor} title="Use AI to rewrite your summary for this job">
              {tailoring ? "Tailoring…" : "✨ Tailor my summary"}
            </button>
            <button className="btn-ghost" onClick={() => navigate("/cover")} title="Draft a cover letter for this job">✍️ Cover letter</button>
          </div>
          {tailorErr && <p className="error">{tailorErr}</p>}
          {tailored && (
            <div className="tailored-box">
              <strong>Suggested summary</strong>
              <p>{tailored}</p>
              <div className="jd-actions">
                <button className="btn-primary small" onClick={applyTailored}>Apply to resume</button>
                <button className="btn-ghost small" onClick={() => setTailored(null)}>Dismiss</button>
              </div>
            </div>
          )}
          {error && <p className="error">{error}</p>}
          <p className="hint-text">AI analysis runs through a secure serverless function. If no AI key is configured (or you're offline), ResuMate automatically falls back to an instant on-device keyword + structure analysis — your data never leaves the browser.</p>
        </div>

        <div className="result-pane">
          {!result && !loading && (
            <div className="empty-state">
              <div className="empty-emoji" aria-hidden="true">📊</div>
              <p>Your ATS score and tailored suggestions will appear here.</p>
            </div>
          )}
          {result && (
            <div className="result">
              <div className="result-top">
                <ScoreGauge score={result.score} />
                <div className="result-summary">
                  <span className={`badge ${result.source}`}>{result.source === "ai" ? "AI analysis" : "Offline analysis"}</span>
                  <p>{result.summary}</p>
                </div>
              </div>

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
            <ResumePreview resume={resume} highlight={result.matchedKeywords} />
          </div>
        </section>
      )}
    </div>
  )
}
