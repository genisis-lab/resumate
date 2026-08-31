import { useState } from "react"
import type { Resume } from "../types/resume"
import { deleteApplication, listApplications, saveApplication, updateApplicationStage, type ApplicationStage, type JobApplication } from "../lib/applications"
import { navigate } from "../router"

const STAGES: Array<{ id: ApplicationStage; label: string }> = [
  { id: "saved", label: "Saved" },
  { id: "applied", label: "Applied" },
  { id: "interview", label: "Interview" },
  { id: "offer", label: "Offer" },
  { id: "closed", label: "Closed" },
]

const EMPTY = { company: "", role: "", stage: "saved" as ApplicationStage, jobDescription: "", coverLetter: "", interviewNotes: "", notes: "" }

export function Applications({ resume }: { resume: Resume }) {
  const [items, setItems] = useState<JobApplication[]>(() => listApplications())
  const [editingId, setEditingId] = useState("")
  const [draft, setDraft] = useState(EMPTY)
  const [error, setError] = useState("")

  function refresh() { setItems(listApplications()) }
  function edit(item: JobApplication) {
    setEditingId(item.id)
    setDraft({ company: item.company, role: item.role, stage: item.stage, jobDescription: item.jobDescription, coverLetter: item.coverLetter, interviewNotes: item.interviewNotes, notes: item.notes })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  function submit(event: React.FormEvent) {
    event.preventDefault()
    setError("")
    try {
      saveApplication({ ...draft, id: editingId || undefined, resumeId: resume.id, resumeName: resume.name })
      setEditingId("")
      setDraft(EMPTY)
      refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this application.")
    }
  }
  function openTool(item: JobApplication, path: "/analyze" | "/cover" | "/interview") {
    try { sessionStorage.setItem("resumate.jd", item.jobDescription) } catch { /* ignore unavailable storage */ }
    navigate(path)
  }

  return (
    <div className="applications-page">
      <header className="applications-head">
        <span className="eyebrow">Private application tracker</span>
        <h1>Keep every application connected.</h1>
        <p>Link a role, job description, resume version, cover-letter draft, and interview notes. Everything here stays in this browser.</p>
      </header>
      <form className="application-form" onSubmit={submit}>
        <div className="application-form-head"><div><span className="account-label">{editingId ? "Edit application" : "New application"}</span><h2>{editingId ? "Update the opportunity" : "Add a role to your board"}</h2></div><span className="application-resume">Resume: {resume.name}</span></div>
        <div className="application-fields two">
          <label className="field"><span className="field-label">Company</span><input className="field-input" required maxLength={160} value={draft.company} onChange={(event) => setDraft((current) => ({ ...current, company: event.target.value }))} /></label>
          <label className="field"><span className="field-label">Role</span><input className="field-input" required maxLength={160} value={draft.role} onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value }))} /></label>
        </div>
        <label className="field"><span className="field-label">Status</span><select className="select" value={draft.stage} onChange={(event) => setDraft((current) => ({ ...current, stage: event.target.value as ApplicationStage }))}>{STAGES.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select></label>
        <label className="field"><span className="field-label">Job description</span><textarea className="input textarea" rows={6} maxLength={24_000} value={draft.jobDescription} onChange={(event) => setDraft((current) => ({ ...current, jobDescription: event.target.value }))} placeholder="Paste the role requirements for ATS checks, cover letters, and interview prep." /></label>
        <div className="application-fields two">
          <label className="field"><span className="field-label">Cover-letter draft</span><textarea className="input textarea" rows={5} maxLength={24_000} value={draft.coverLetter} onChange={(event) => setDraft((current) => ({ ...current, coverLetter: event.target.value }))} /></label>
          <label className="field"><span className="field-label">Interview notes</span><textarea className="input textarea" rows={5} maxLength={12_000} value={draft.interviewNotes} onChange={(event) => setDraft((current) => ({ ...current, interviewNotes: event.target.value }))} /></label>
        </div>
        <label className="field"><span className="field-label">Notes</span><textarea className="input textarea" rows={3} maxLength={12_000} value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="application-form-actions"><button className="btn-primary" type="submit">{editingId ? "Save changes" : "Add application"}</button>{editingId && <button className="btn-ghost" type="button" onClick={() => { setEditingId(""); setDraft(EMPTY) }}>Cancel</button>}</div>
      </form>

      <section className="application-board" aria-labelledby="application-board-title">
        <div className="application-board-head"><h2 id="application-board-title">Your applications</h2><span>{items.length} saved locally</span></div>
        {items.length === 0 ? <div className="application-empty"><h3>No applications yet</h3><p>Add the next role above, then reuse its job description across ResuMate.</p></div> : (
          <div className="application-list">
            {items.map((item) => <article className="application-card" key={item.id}>
              <div className="application-card-head"><div><span>{item.company}</span><h3>{item.role}</h3></div><select className="select" aria-label={`Status for ${item.role} at ${item.company}`} value={item.stage} onChange={(event) => { updateApplicationStage(item.id, event.target.value as ApplicationStage); refresh() }}>{STAGES.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select></div>
              <p>Using <strong>{item.resumeName || "current resume"}</strong>{item.jobDescription ? " · job description saved" : " · add a job description for smart tools"}</p>
              <div className="application-tools"><button className="btn-ghost small" disabled={!item.jobDescription} onClick={() => openTool(item, "/analyze")}>ATS check</button><button className="btn-ghost small" disabled={!item.jobDescription} onClick={() => openTool(item, "/cover")}>Cover letter</button><button className="btn-ghost small" disabled={!item.jobDescription} onClick={() => openTool(item, "/interview")}>Interview prep</button></div>
              <div className="application-card-actions"><button className="text-button" onClick={() => edit(item)}>Edit details</button><button className="text-button danger" onClick={() => { if (confirm(`Delete ${item.role} at ${item.company}?`)) { deleteApplication(item.id); refresh() } }}>Delete</button></div>
            </article>)}
          </div>
        )}
      </section>
    </div>
  )
}
