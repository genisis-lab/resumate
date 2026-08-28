import { Resume, TemplateId } from "../types/resume"
import { ResumePreview } from "../templates/ResumePreview"
import { createSampleResume } from "../data/sample"
import { navigate } from "../router"

const TEMPLATES: { id: TemplateId; label: string; desc: string }[] = [
  { id: "modern", label: "Modern", desc: "Polished with a subtle accent color. Great all-rounder." },
  { id: "classic", label: "Classic", desc: "Traditional serif headings for corporate roles." },
  { id: "minimal", label: "Minimal", desc: "Lots of whitespace, lightweight and clean." },
  { id: "ats", label: "ATS-Safe", desc: "Single column, standard headings, maximum parseability." },
  { id: "twocolumn", label: "Two-Column", desc: "Skills & education in a sidebar, experience in the main column." },
  { id: "creative", label: "Creative", desc: "Bold accent header and section underlines for design-forward roles." },
  { id: "executive", label: "Executive", desc: "Confident hierarchy and conservative rules for senior leadership roles." },
  { id: "compact", label: "Compact", desc: "Dense single-column structure for experienced candidates with more to fit." },
  { id: "technical", label: "Technical", desc: "Clear skills, projects, and experience hierarchy for engineering and data roles." },
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
