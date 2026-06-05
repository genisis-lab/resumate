import { useState } from "react"
import { Resume } from "../types/resume"
import { aiCoverLetter } from "../lib/ai"
import { navigate } from "../router"
import { triggerDownload, sanitize } from "../lib/storage"

const TONES = ["professional", "enthusiastic", "concise", "warm"]

export function CoverLetter({ resume }: { resume: Resume }) {
  const [jd, setJd] = useState(() => {
    try {
      return sessionStorage.getItem("resumate.jd") || ""
    } catch {
      return ""
    }
  })
  const [tone, setTone] = useState("professional")
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)

  function onJd(v: string) {
    setJd(v)
    try {
      sessionStorage.setItem("resumate.jd", v)
    } catch {
      /* ignore storage errors */
    }
  }

  async function generate() {
    if (!jd.trim()) {
      setError("Paste the job description first.")
      return
    }
    setError("")
    setLoading(true)
    try {
      const out = await aiCoverLetter(resume, jd, tone)
      setText(out)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't generate a cover letter.")
    } finally {
      setLoading(false)
    }
  }

  function copy() {
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => setError("Couldn't copy to clipboard."),
    )
  }

  function download() {
    const blob = new Blob([text], { type: "text/plain" })
    triggerDownload(blob, `${sanitize(resume.contact.fullName || resume.name)}_cover_letter.txt`)
  }

  return (
    <div className="analyze">
      <div className="analyze-head">
        <button className="btn-ghost small" onClick={() => navigate("/builder")}>← Back to editor</button>
        <h1>Cover Letter Generator</h1>
        <p className="muted">Paste the job description and we'll draft a tailored cover letter grounded in your resume. Always review and personalize before sending.</p>
      </div>

      <div className="analyze-grid">
        <div className="jd-pane">
          <textarea
            className="jd-input"
            placeholder="Paste the full job description here…"
            value={jd}
            onChange={(e) => onJd(e.target.value)}
          />
          <div className="jd-actions">
            <label className="tone-select">
              Tone
              <select className="select" value={tone} onChange={(e) => setTone(e.target.value)} aria-label="Cover letter tone">
                {TONES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <button className="btn-primary" disabled={loading} onClick={generate}>
              {loading ? "Writing…" : "✨ Generate"}
            </button>
          </div>
          {error && <p className="error">{error}</p>}
          <p className="hint-text">Cover letters use the same secure serverless function as the ATS check. If no AI key is configured on this deployment, this feature is unavailable — the ATS check still works offline.</p>
        </div>

        <div className="result-pane">
          {!text && !loading && (
            <div className="empty-state">
              <div className="empty-emoji" aria-hidden="true">✉️</div>
              <p>Your tailored cover letter will appear here, ready to edit, copy, or download.</p>
            </div>
          )}
          {text && (
            <div className="cover-result">
              <div className="cover-actions">
                <button className="btn-ghost small" onClick={copy}>{copied ? "Copied ✓" : "Copy"}</button>
                <button className="btn-ghost small" onClick={download}>Download .txt</button>
              </div>
              <textarea
                className="cover-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                aria-label="Generated cover letter"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
