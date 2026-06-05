import { useState } from "react"
import { Resume } from "../types/resume"
import { aiInterviewQuestions, aiRecruiterEmail, InterviewQuestion } from "../lib/ai"
import { triggerDownload, sanitize } from "../lib/storage"

const JD_KEY = "resumate.jd"

// Interview prep: generates likely interview questions (with tailored answer
// tips) and an optional recruiter outreach email, based on the resume + a
// pasted job description. Requires an AI key (site key or BYOK in Settings).
export function Interview({ resume }: { resume: Resume }) {
  const [jd, setJd] = useState<string>(() => sessionStorage.getItem(JD_KEY) || "")
  const [questions, setQuestions] = useState<InterviewQuestion[]>([])
  const [email, setEmail] = useState("")
  const [loadingQ, setLoadingQ] = useState(false)
  const [loadingE, setLoadingE] = useState(false)
  const [error, setError] = useState("")

  function persistJd(v: string) {
    setJd(v)
    sessionStorage.setItem(JD_KEY, v)
  }

  async function genQuestions() {
    if (!jd.trim()) {
      setError("Paste the job description first.")
      return
    }
    setError("")
    setLoadingQ(true)
    try {
      setQuestions(await aiInterviewQuestions(resume, jd))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
    } finally {
      setLoadingQ(false)
    }
  }

  async function genEmail() {
    if (!jd.trim()) {
      setError("Paste the job description first.")
      return
    }
    setError("")
    setLoadingE(true)
    try {
      setEmail(await aiRecruiterEmail(resume, jd))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
    } finally {
      setLoadingE(false)
    }
  }

  return (
    <div className="page narrow">
      <h1>Interview prep</h1>
      <p className="page-sub">
        Paste the job description and get likely interview questions tailored to your resume, plus a
        ready-to-send recruiter outreach email.
      </p>

      <label className="field">
        <span className="field-label">Job description</span>
        <textarea
          className="input textarea"
          rows={8}
          value={jd}
          onChange={(e) => persistJd(e.target.value)}
          placeholder="Paste the job posting here\u2026"
        />
      </label>

      <div className="row gap">
        <button className="btn-primary" disabled={loadingQ} onClick={genQuestions}>
          {loadingQ ? "Thinking\u2026" : "\u2728 Generate questions"}
        </button>
        <button className="btn-secondary" disabled={loadingE} onClick={genEmail}>
          {loadingE ? "Writing\u2026" : "\u2728 Draft recruiter email"}
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {questions.length > 0 && (
        <div className="card">
          <h2 className="card-title">Likely questions</h2>
          <ol className="interview-list">
            {questions.map((q, i) => (
              <li key={i}>
                <div className="iq-q">{q.question}</div>
                {q.tip && <div className="iq-tip">💡 {q.tip}</div>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {email && (
        <div className="card">
          <div className="row between">
            <h2 className="card-title">Recruiter outreach email</h2>
            <button
              className="btn-ghost small"
              onClick={() =>
                triggerDownload(
                  new Blob([email], { type: "text/plain" }),
                  `${sanitize(resume.contact.fullName || "outreach")}_email.txt`,
                )
              }
            >
              Download
            </button>
          </div>
          <pre className="letter-output">{email}</pre>
        </div>
      )}
    </div>
  )
}
