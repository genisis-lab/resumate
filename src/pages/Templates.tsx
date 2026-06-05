import { Resume, TemplateId } from "../types/resume"
import { ResumePreview } from "../templates/ResumePreview"
import { createSampleResume } from "../data/sample"
import { navigate } from "../router"

const TEMPLATES: { id: TemplateId; label: string; desc: string }[] = [
  { id: "modern", label: "Modern", desc: "Polished with a subtle accent color. Great all-rounder." },
  { id: "classic", label: "Classic", desc: "Traditional serif headings for corporate roles." },
  { id: "minimal", label: "Minimal", desc: "Lots of whitespace, lightweight and clean." },
  { id: "ats", label: "ATS-Safe", desc: "Single column, standard headings, maximum parseability." },
]

export function Templates({
  resume,
  setResume,
}: {
  resume: Resume
  setResume: (r: Resume | ((p: Resume) => Resume)) => void
}) {
  const demo = createSampleResume()
  function choose(id: TemplateId) {
    setResume((r) => ({ ...r, settings: { ...r.settings, template: id } }))
    navigate("/builder")
  }
  return (
    <div className="templates-page">
      <div className="analyze-head">
        <button className="btn-ghost small" onClick={() => navigate("/builder")}>← Back to editor</button>
        <h1>Templates</h1>
        <p className="muted">Pick a starting point. You can switch any time without losing your content.</p>
      </div>
      <div className="template-gallery">
        {TEMPLATES.map((t) => {
          const preview = { ...demo, settings: { ...demo.settings, template: t.id, accent: resume.settings.accent } }
          return (
            <div className={`template-card ${resume.settings.template === t.id ? "active" : ""}`} key={t.id}>
              <div className="template-thumb">
                <div className="thumb-scale">
                  <ResumePreview resume={preview} />
                </div>
              </div>
              <div className="template-info">
                <h3>{t.label}{resume.settings.template === t.id && <span className="current-tag">Current</span>}</h3>
                <p>{t.desc}</p>
                <button className="btn-primary small" onClick={() => choose(t.id)}>Use this template</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
