import React, { useState } from "react"
import { Resume } from "../types/resume"
import { AtsResult, analyzeResume, analyzeLocally } from "../lib/ats"
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

export function Analyze({ resume }: { resume: Resume }) {
  const [jd, setJd] = useState("")
  const [result, setResult] = useState<AtsResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

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

  return (
    <div className="analyze">
      <div className="analyze-head">
        <button className="btn-ghost small" onClick={() => navigate("/builder")}>← Back to editor</button>
        <h1>ATS Score & Optimization</h1>
        <p className="muted">Paste the job description you're targeting. We'll score your resume against it and suggest concrete improvements.</p>
      </div>

      <div className="analyze-grid">
        <div className="jd-pane">
          <textarea
            className="jd-input"
            placeholder="Paste the full job description here…"
            value={jd}
            onChange={(e) => setJd(e.target.value)}
          />
          <div className="jd-actions">
            <button className="btn-primary" disabled={loading} onClick={() => run(true)}>
              {loading ? "Analyzing…" : "✨ Analyze with AI"}
            </button>
            <button className="btn-ghost" disabled={loading} onClick={() => run(false)} title="Instant offline scoring">
              Quick offline check
            </button>
          </div>
          {error && <p className="error">{error}</p>}
          <p className="hint-text">AI analysis runs through a secure serverless function. If no AI key is configured (or you're offline), ResuMate automatically falls back to an instant on-device keyword + structure analysis — your data never leaves the browser.</p>
        </div>

        <div className="result-pane">
          {!result && !loading && (
            <div className="empty-state">
              <div className="empty-emoji">📊</div>
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
    </div>
  )
}
