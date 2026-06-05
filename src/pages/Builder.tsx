import React, { useMemo, useRef, useState } from "react"
import { Resume, TemplateId } from "../types/resume"
import { ResumePreview } from "../templates/ResumePreview"
import { EditorForm } from "../components/EditorForm"
import { exportPdf } from "../lib/exportPdf"
import { exportDocx } from "../lib/exportDocx"
import { exportResumeJSON, exportAllJSON, importAllJSON, duplicateResume, clearAllData, loadStore, deleteResume } from "../lib/storage"
import { exportMarkdown, exportPlainText, exportJsonResume } from "../lib/exportText"
import { buildShareUrl } from "../lib/share"
import { createEmptyResume, createSampleResume } from "../data/sample"
import { importResumeFromFile } from "../lib/importResume"
import { completeness, qualityFlags } from "../lib/quality"
import { Density } from "../types/resume"
import { navigate } from "../router"

const TEMPLATES: { id: TemplateId; label: string }[] = [
  { id: "modern", label: "Modern" },
  { id: "classic", label: "Classic" },
  { id: "minimal", label: "Minimal" },
  { id: "ats", label: "ATS-Safe" },
  { id: "twocolumn", label: "Two-Column" },
  { id: "creative", label: "Creative" },
]

const DENSITIES: { id: Density; label: string }[] = [
  { id: "compact", label: "Compact" },
  { id: "cozy", label: "Cozy" },
  { id: "roomy", label: "Roomy" },
]

const ACCENTS = ["#2563eb", "#0f766e", "#7c3aed", "#be123c", "#b45309", "#111827"]

const swatchStyle = (color: string): React.CSSProperties => ({ background: color })

export function Builder({
  resume,
  setResume,
  switchResume,
  replaceResume,
  undo,
  redo,
  canUndo,
  canRedo,
}: {
  resume: Resume
  setResume: (r: Resume | ((p: Resume) => Resume)) => void
  switchResume: (id: string) => void
  replaceResume: (r: Resume) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const resumeFileRef = useRef<HTMLInputElement>(null)
  const backupFileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit")
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

  async function onImportResume(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const next = await importResumeFromFile(file)
      replaceResume(next)
    } catch (err) {
      alert(
        "Couldn't import that file. Please upload a PDF or a plain-text (.txt) resume, or use Import JSON.\n\n" +
          (err instanceof Error ? err.message : ""),
      )
    } finally {
      setImporting(false)
      e.target.value = ""
    }
  }

  async function onRestoreBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const count = await importAllJSON(file)
      const s = loadStore()
      switchResume(s.resumes[0].id)
      alert(`Restored ${count} resume${count === 1 ? "" : "s"} from your backup.`)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not restore that backup.")
    } finally {
      e.target.value = ""
    }
  }

  function onDuplicate() {
    const copy = duplicateResume(resume.id)
    if (copy) switchResume(copy.id)
  }

  async function onShare() {
    const url = buildShareUrl(resume)
    try {
      await navigator.clipboard.writeText(url)
      alert("Read-only share link copied to your clipboard! Anyone who opens it can load a copy of this resume.")
    } catch {
      prompt("Copy this read-only share link:", url)
    }
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
          <button className="btn-ghost small" onClick={onDuplicate} title="Make an editable copy of this resume">Duplicate</button>
          <button
            className="btn-ghost small"
            title="Fill the editor with a complete example you can edit"
            onClick={() => {
              if (isResumeEmpty(resume) || confirm("Load the example resume? This replaces the current resume's contents.")) {
                replaceResume({ ...createSampleResume(), id: resume.id, name: resume.name })
              }
            }}
          >
            Load example
          </button>
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
          <button
            className="btn-ghost small danger"
            title="Erase all locally stored data from this browser"
            onClick={() => {
              if (confirm("Erase ALL ResuMate data from this browser (every resume)? Export a backup first if you want to keep it. This cannot be undone.")) {
                clearAllData()
                location.reload()
              }
            }}
          >
            Clear data
          </button>
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
              style={swatchStyle(a)}
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
          <span className="toolbar-label">Density</span>
          <select
            className="select"
            value={resume.settings.density || "cozy"}
            onChange={(e) => setSettings({ density: e.target.value as Density })}
            title="Spacing density"
          >
            {DENSITIES.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </div>

        <div className="toolbar-group">
          <button className="btn-ghost small" onClick={undo} disabled={!canUndo} title="Undo (Ctrl/Cmd+Z)">↶ Undo</button>
          <button className="btn-ghost small" onClick={redo} disabled={!canRedo} title="Redo (Ctrl/Cmd+Shift+Z)">↷ Redo</button>
        </div>

        <div className="toolbar-group right">
          <button className="btn-ghost small" disabled={importing} onClick={() => resumeFileRef.current?.click()}>
            {importing ? "Reading\u2026" : "\u2b06 Import r\u00e9sum\u00e9"}
          </button>
          <input ref={resumeFileRef} type="file" accept=".pdf,.txt,.md,.text,application/pdf,text/plain" hidden onChange={onImportResume} />
          <button className="btn-ghost small" onClick={() => fileRef.current?.click()}>Import JSON</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onImport} />
          <button className="btn-ghost small" onClick={() => exportResumeJSON(resume)}>Export JSON</button>
          <button className="btn-ghost small" onClick={() => exportMarkdown(resume)} title="Export as Markdown">.md</button>
          <button className="btn-ghost small" onClick={() => exportPlainText(resume)} title="Export as plain text">.txt</button>
          <button className="btn-ghost small" onClick={() => exportJsonResume(resume)} title="Export in the JSON Resume standard">JSON Resume</button>
          <button className="btn-ghost small" onClick={onShare} title="Copy a read-only share link">🔗 Share</button>
          <button className="btn-ghost small" onClick={() => exportAllJSON()} title="Download a backup of every saved resume">Backup all</button>
          <button className="btn-ghost small" onClick={() => backupFileRef.current?.click()} title="Restore resumes from a backup file">Restore</button>
          <input ref={backupFileRef} type="file" accept="application/json,.json" hidden onChange={onRestoreBackup} />
          <button className="btn-secondary small" onClick={() => navigate("/analyze")}>✨ ATS Check</button>
          <button className="btn-secondary small" onClick={() => exportDocx(resume)}>⬇ Word</button>
          <button className="btn-primary small" onClick={() => exportPdf()}>⬇ PDF</button>
        </div>
      </div>

      <div className="mobile-tabs no-print" role="tablist" aria-label="Editor or preview">
        <button type="button" role="tab" aria-selected={mobileView === "edit"} className={`chip ${mobileView === "edit" ? "active" : ""}`} onClick={() => setMobileView("edit")}>Editor</button>
        <button type="button" role="tab" aria-selected={mobileView === "preview"} className={`chip ${mobileView === "preview" ? "active" : ""}`} onClick={() => setMobileView("preview")}>Preview</button>
      </div>
      <div className={`builder-grid show-${mobileView}`}>
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
          <p className="privacy-note no-print">🔒 Everything you enter stays in this browser. No account, no upload. Use “Backup all” to save a copy, or “Clear data” to wipe everything.</p>
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

function isResumeEmpty(r: Resume): boolean {
  return (
    !r.contact.fullName &&
    !r.summary &&
    r.experience.length === 0 &&
    r.education.length === 0 &&
    r.skills.length === 0 &&
    r.projects.length === 0 &&
    r.certifications.length === 0
  )
}
