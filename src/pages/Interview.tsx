import { navigate } from "../router"
import { useState } from "react"
import { ArrowLeft, Download, MessageCircleQuestion, Sparkles } from "lucide-react"
import { Resume } from "../types/resume"
import { aiInterviewQuestions, aiRecruiterEmail, type EmailKind, type InterviewQuestion } from "../lib/ai"
import { triggerDownload, sanitize } from "../lib/storage"
import type { PlanId } from "../lib/billing"
import { AiActionBudget } from "../components/AiActionBudget"
import { readSavedJob, writeSavedJob } from "../lib/jobContext"

const EMAIL_KINDS: { id: EmailKind; label: string; hint: string }[] = [
  { id: "outreach", label: "Recruiter outreach", hint: "Introduce yourself before or while applying." },
  { id: "follow_up", label: "Application follow-up", hint: "A polite check-in about a week after applying." },
  { id: "thank_you", label: "Interview thank-you", hint: "Send within a day. Add who you met and what you discussed." },
  { id: "networking", label: "Networking request", hint: "Ask for a short informational conversation." },
]

// Interview prep: likely questions with answer directions grounded in the
// resume, plus outreach, follow-up, thank-you, and networking emails.
export function Interview({ resume, plan }: { resume: Resume; plan: PlanId }) {
  const [jd, setJd] = useState<string>(readSavedJob)
  const [questions, setQuestions] = useState<InterviewQuestion[]>([])
  const [emailKind, setEmailKind] = useState<EmailKind>("outreach")
  const [details, setDetails] = useState("")
  const [email, setEmail] = useState("")
  const [loadingQ, setLoadingQ] = useState(false)
  const [loadingE, setLoadingE] = useState(false)
  const [error, setError] = useState("")
  const [aiActionVersion, setAiActionVersion] = useState(0)
  const kind = EMAIL_KINDS.find((item) => item.id === emailKind)!

  function persistJd(v: string) {
    setJd(v)
    writeSavedJob(v)
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
      setAiActionVersion((value) => value + 1)
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
      setEmail(await aiRecruiterEmail(resume, jd, "professional", emailKind, details))
      setAiActionVersion((value) => value + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
    } finally {
      setLoadingE(false)
    }
  }

  return (
    <div className="tool-page">
      <header className="page-header">
        <button className="btn-ghost small back-link" onClick={() => navigate("/builder")}><ArrowLeft size={15} aria-hidden="true" /> Back to editor</button>
        <h1>Interview prep</h1>
        <p className="page-sub">Get likely questions tailored to your resume and the role, then draft the emails around the interview. Want live practice with feedback? <button className="inline-button" onClick={() => navigate("/coach?mode=practice")}>Open interview practice</button></p>
      </header>

      <section className="card">
        <label className="field">
          <span className="field-label">Job description</span>
          <textarea className="input textarea" rows={7} value={jd} onChange={(e) => persistJd(e.target.value)} placeholder="Paste the job posting here…" />
        </label>
        <AiActionBudget plan={plan} refreshKey={aiActionVersion} />
        <div className="row gap">
          <button className="btn-primary" disabled={loadingQ} onClick={() => void genQuestions()}>
            <Sparkles size={16} aria-hidden="true" /> {loadingQ ? "Thinking…" : questions.length ? "Regenerate questions" : "Generate questions"}
          </button>
        </div>
        {error && <p className="error-text" role="alert">{error}</p>}
        <p className="hint">AI features send the selected resume and job description through ResuMate's serverless proxy to the configured provider.</p>
      </section>

      {questions.length > 0 && (
        <section className="card" aria-labelledby="questions-title">
          <h2 className="card-title" id="questions-title">Likely questions</h2>
          <ol className="interview-list">
            {questions.map((q, i) => (
              <li key={i}>
                <div className="iq-q">{q.question}</div>
                {q.tip && <label className="iq-tip"><span>Answer direction · edit to match your real experience</span><textarea className="input textarea" rows={3} value={q.tip} onChange={(event) => setQuestions((current) => current.map((item, index) => index === i ? { ...item, tip: event.target.value } : item))} /></label>}
              </li>
            ))}
          </ol>
          <button className="btn-secondary small" onClick={() => navigate("/coach?mode=practice")}><MessageCircleQuestion size={15} aria-hidden="true" /> Practice answering</button>
        </section>
      )}

      <section className="card" aria-labelledby="email-title">
        <h2 className="card-title" id="email-title">Emails</h2>
        <div className="email-kinds" role="radiogroup" aria-label="Email type">
          {EMAIL_KINDS.map((item) => (
            <button key={item.id} type="button" role="radio" aria-checked={emailKind === item.id} className={`chip ${emailKind === item.id ? "active" : ""}`} onClick={() => { setEmailKind(item.id); setEmail("") }}>{item.label}</button>
          ))}
        </div>
        <p className="hint">{kind.hint}</p>
        {(emailKind === "thank_you" || emailKind === "networking") && (
          <label className="field">
            <span className="field-label">Details <span className="field-hint">optional</span></span>
            <textarea className="input textarea" rows={3} maxLength={2000} value={details} onChange={(event) => setDetails(event.target.value)} placeholder={emailKind === "thank_you" ? "Who you met and what you discussed, e.g. Sam Lee, design systems roadmap, onboarding metrics" : "Who you're writing to and why them, e.g. Priya leads the platform design team"} />
          </label>
        )}
        <button className="btn-secondary" disabled={loadingE} onClick={() => void genEmail()}>
          <Sparkles size={16} aria-hidden="true" /> {loadingE ? "Writing…" : `Draft ${kind.label.toLowerCase()}`}
        </button>
        {email && (
          <div className="email-draft">
            <div className="row between">
              <strong>{kind.label}</strong>
              <button className="btn-ghost small" onClick={() => triggerDownload(new Blob([email], { type: "text/plain" }), `${sanitize(resume.contact.fullName || "resume")}_${emailKind}_email.txt`)}>
                <Download size={15} aria-hidden="true" /> Download
              </button>
            </div>
            <textarea className="cover-text recruiter-email-draft" value={email} onChange={(event) => setEmail(event.target.value)} aria-label={`Editable ${kind.label.toLowerCase()}`} />
            <p className="hint-text">Review names, claims, and tone before sending. This draft is never sent automatically.</p>
          </div>
        )}
      </section>
    </div>
  )
}
