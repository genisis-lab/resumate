import React, { useMemo, useRef } from "react"
import { Resume, TemplateId } from "../types/resume"
import { ResumePreview } from "../templates/ResumePreview"
import { EditorForm } from "../components/EditorForm"
import { exportPdf } from "../lib/exportPdf"
import { exportDocx } from "../lib/exportDocx"
import { exportResumeJSON, loadStore, deleteResume } from "../lib/storage"
import { createEmptyResume } from "../data/sample"
import { completeness, qualityFlags } from "../lib/quality"
import { navigate } from "../router"

const TEMPLATES: { id: TemplateId; label: string }[] = [
  { id: "modern", label: "Modern" },
  { id: "classic", label: "Classic" },
  { id: "minimal", label: "Minimal" },
  { id: "ats", label: "ATS-Safe" },
]

const ACCENTS = ["#2563eb", "#0f766e", "#7c3aed", "#be123c", "#b45309", "#111827"]

export function Builder({
  resume,
  setResume,
  switchResume,
  replaceResume,
}: {
  resume: Resume
  setResume: (r: Resume | ((p: Resume) => Resume)) => void
  switchResume: (id: string) => void
  replaceResume: (r: Resume) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const store = loadStore()
  const comp = useMemo(() => completeness(resume), [resume])
  const flags = useMemo(() => qualityFlags(resume), [resume])

  const setSettings = (patch: Partial<Resume["settings"]>) =>
    setResume((r) => ({ ...r, settings: { ...r.settings, ...patch } }))

  function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as Resume
        const next: Resume = { ...createEmptyResume(), ...data, id: createEmptyResume().id }
        replaceResume(next)
      } catch {
        alert("That file could not be read as a ResuMate JSON resume.")
      }
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  return (
    <div className="builder">
      <div className="toolbar no-print">
        <div className="toolbar-group">
          <select
            className="select"
            value={resume.id}
            onChange={(e) => switchResume(e.target.value)}
            title="Switch resume"
          >
            {store.resumes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.contact.fullName || r.name}
              </option>
            ))}
          </select>
          <button className="btn-ghost small" onClick={() => replaceResume(createEmptyResume("Untitled"))}>+ New</button>
          {store.resumes.length > 1 && (
            <button
              className="btn-ghost small danger"
              onClick={() => {
                if (confirm("Delete this resume? This cannot be undone.")) {
                  deleteResume(resume.id)
                  const s = loadStore()
                  switchResume(s.resumes[0].id)
                }
              }}
            >
              Delete
            </button>
          )}
        </div>

        <div className="toolbar-group">
          <span className="toolbar-label">Template</span>
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              className={`chip ${resume.settings.template === t.id ? "active" : ""}`}
              onClick={() => setSettings({ template: t.id })}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="toolbar-group">
          <span className="toolbar-label">Accent</span>
          {ACCENTS.map((a) => (
            <button
              key={a}
              className={`swatch ${resume.settings.accent === a ? "active" : ""}`}
              style={ { background: a } }
              onClick={() => setSettings({ accent: a })}
              title={a}
            />
          ))}
          <span className="toolbar-label">Size</span>
          <input
            type="range"
            min={0.9}
            max={1.15}
            step={0.05}
            value={resume.settings.fontScale}
            onChange={(e) => setSettings({ fontScale: Number(e.target.value) })}
          />
        </div>

        <div className="toolbar-group right">
          <button className="btn-ghost small" onClick={() => fileRef.current?.click()}>Import JSON</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onImport} />
          <button className="btn-ghost small" onClick={() => exportResumeJSON(resume)}>Export JSON</button>
          <button className="btn-secondary small" onClick={() => navigate("/analyze")}>✨ ATS Check</button>
          <button className="btn-secondary small" onClick={() => exportDocx(resume)}>⬇ Word</button>
          <button className="btn-primary small" onClick={() => exportPdf()}>⬇ PDF</button>
        </div>
      </div>

      <div className="builder-grid">
        <div className="editor-pane no-print">
          <div className="completeness">
            <div className="completeness-row">
              <strong>Resume completeness</strong>
              <span>{comp.percent}%</span>
            </div>
            <div className="meter"><div className="meter-fill" style={{ width: `${comp.percent}%` }} /></div>
            <div className="comp-items">
              {comp.items.map((it) => (
                <span key={it.key} className={`comp-chip ${it.done ? "done" : ""}`}>
                  {it.done ? "✓" : "○"} {it.label}
                </span>
              ))}
            </div>
            {flags.length > 0 && (
              <ul className="quality-flags">
                {flags.map((f, i) => (
                  <li key={i} className={f.severity}>{f.text}</li>
                ))}
              </ul>
            )}
          </div>
          <EditorForm resume={resume} setResume={setResume} />
        </div>
        <div className="preview-pane">
          <div className="preview-scroll">
            <ResumePreview resume={resume} />
          </div>
        </div>
      </div>
    </div>
  )
}
