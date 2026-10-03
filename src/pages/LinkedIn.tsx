import { useState } from "react"
import { toast } from "sonner"
import { ArrowLeft, Check, ContactRound, Copy, Sparkles } from "lucide-react"
import type { Resume } from "../types/resume"
import type { PlanId } from "../lib/billing"
import { aiLinkedIn, type LinkedInProfile } from "../lib/ai"
import { AiActionBudget } from "../components/AiActionBudget"
import { navigate } from "../router"

const LIMITS = { headline: 220, about: 2_600 }

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="btn-ghost small"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1500)
        }, () => toast.error("Couldn't copy. Select the text and copy it manually."))
      }}
      aria-label={`Copy ${label}`}
    >
      {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
      {copied ? "Copied" : "Copy"}
    </button>
  )
}

// LinkedIn profile optimizer: headline, About section, top skills, and
// featured highlights, all drafted from the resume and editable before copying.
export function LinkedIn({ resume, plan }: { resume: Resume; plan: PlanId }) {
  const [targetRole, setTargetRole] = useState(resume.contact.headline)
  const [profile, setProfile] = useState<LinkedInProfile | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [version, setVersion] = useState(0)
  const hasContent = Boolean(resume.summary.trim() || resume.experience.some((e) => e.bullets.some((b) => b.trim())))

  async function generate() {
    if (!hasContent) {
      setError("Add a summary or experience bullets in the editor first.")
      return
    }
    setError("")
    setBusy(true)
    try {
      setProfile(await aiLinkedIn(resume, targetRole))
      setVersion((value) => value + 1)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't draft your profile.")
    } finally {
      setBusy(false)
    }
  }

  const update = (patch: Partial<LinkedInProfile>) => setProfile((current) => (current ? { ...current, ...patch } : current))

  return (
    <div className="tool-page">
      <header className="page-header">
        <button className="btn-ghost small back-link" onClick={() => navigate("/builder")}><ArrowLeft size={15} aria-hidden="true" /> Back to editor</button>
        <h1>LinkedIn optimizer</h1>
        <p className="page-sub">Turn your resume into a searchable headline, a first-person About section, and top skills. Every line is drafted only from your resume and stays editable before you copy it.</p>
      </header>

      <div className="tool-grid">
        <section className="card tool-input" aria-labelledby="linkedin-input-title">
          <h2 className="card-title" id="linkedin-input-title">Position your profile</h2>
          <label className="field">
            <span className="field-label">Target role <span className="field-hint">optional</span></span>
            <input className="field-input" value={targetRole} maxLength={160} onChange={(event) => setTargetRole(event.target.value)} placeholder="e.g. Design Systems Lead" />
          </label>
          <AiActionBudget plan={plan} refreshKey={version} />
          <button className="btn-primary" disabled={busy} onClick={() => void generate()}>
            <Sparkles size={16} aria-hidden="true" /> {busy ? "Drafting…" : profile ? "Draft again" : "Draft my profile"}
          </button>
          {error && <p className="error-text" role="alert">{error}</p>}
          <p className="hint">Sends your resume text through ResuMate's AI proxy. Review every claim before posting it publicly.</p>
        </section>

        <section className="card tool-output" aria-live="polite" aria-labelledby="linkedin-output-title">
          <h2 className="sr-only" id="linkedin-output-title">Drafted profile</h2>
          {!profile ? (
            <div className="empty-state">
              <span className="empty-icon" aria-hidden="true"><ContactRound size={26} /></span>
              <p>Your headline, About section, and top skills will appear here.</p>
            </div>
          ) : (
            <div className="profile-draft">
              <div className="draft-block">
                <div className="draft-head"><strong>Headline</strong><span className={`char-count${profile.headline.length > LIMITS.headline ? " over" : ""}`}>{profile.headline.length}/{LIMITS.headline}</span><CopyButton value={profile.headline} label="headline" /></div>
                <textarea className="field-input" rows={2} value={profile.headline} onChange={(event) => update({ headline: event.target.value })} aria-label="Headline" />
              </div>
              <div className="draft-block">
                <div className="draft-head"><strong>About</strong><span className={`char-count${profile.about.length > LIMITS.about ? " over" : ""}`}>{profile.about.length}/{LIMITS.about}</span><CopyButton value={profile.about} label="About section" /></div>
                <textarea className="field-input" rows={10} value={profile.about} onChange={(event) => update({ about: event.target.value })} aria-label="About section" />
              </div>
              {profile.skills.length > 0 && (
                <div className="draft-block">
                  <div className="draft-head"><strong>Top skills</strong><span className="char-count">Add these in LinkedIn's Skills section</span><CopyButton value={profile.skills.join(", ")} label="skills" /></div>
                  <div className="kw-chips">{profile.skills.map((skill) => <span className="kw matched" key={skill}>{skill}</span>)}</div>
                </div>
              )}
              {profile.highlights.length > 0 && (
                <div className="draft-block">
                  <div className="draft-head"><strong>Featured highlights</strong><CopyButton value={profile.highlights.map((item) => `• ${item}`).join("\n")} label="highlights" /></div>
                  <ul className="bullet-list">{profile.highlights.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
