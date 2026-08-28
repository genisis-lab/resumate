import React, { useEffect, useMemo, useRef, useState } from "react"
import { Resume, TemplateId } from "../types/resume"
import { ResumePreview } from "../templates/ResumePreview"
import { EditorForm } from "../components/EditorForm"
import { ShareModal } from "../components/ShareModal"
import { exportPdf } from "../lib/exportPdf"
import { exportDocx } from "../lib/exportDocx"
import { exportResumeJSON, exportAllJSON, importAllJSON, duplicateResume, clearAllData, loadStore, deleteResume, normalizeResume } from "../lib/storage"
import { exportMarkdown, exportPlainText, exportJsonResume } from "../lib/exportText"
import { createEmptyResume, createSampleResume } from "../data/sample"
import { importResumeFromFile } from "../lib/importResume"
import { completeness, qualityFlags } from "../lib/quality"
import { measurePageCount, nextFrame } from "../lib/fitPage"
import { findProofIssues, autoFixSpelling } from "../lib/proofread"
import { fromJsonResume } from "../lib/jsonResume"
import { Density } from "../types/resume"
import { navigate } from "../router"
import { BottomSheet } from "../components/BottomSheet"

const TEMPLATES: { id: TemplateId; label: string }[] = [
  { id: "modern", label: "Modern" },
  { id: "classic", label: "Classic" },
  { id: "minimal", label: "Minimal" },
  { id: "ats", label: "ATS-Safe" },
  { id: "twocolumn", label: "Two-Column" },
  { id: "creative", label: "Creative" },
  { id: "executive", label: "Executive" },
  { id: "compact", label: "Compact" },
  { id: "technical", label: "Technical" },
]

const DENSITIES: { id: Density; label: string }[] = [
  { id: "compact", label: "Compact" },
  { id: "cozy", label: "Cozy" },
  { id: "roomy", label: "Roomy" },
]

const ACCENTS = ["#2563eb", "#0f766e", "#7c3aed", "#be123c", "#b45309", "#111827"]
const ACCENT_NAMES: Record<string, string> = {
  "#2563eb": "blue",
  "#0f766e": "teal",
  "#7c3aed": "violet",
  "#be123c": "rose",
  "#b45309": "amber",
  "#111827": "ink",
}

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
  const [showProof, setShowProof] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [mobileSheet, setMobileSheet] = useState<"tools" | "export" | null>(null)
  const [pageCount, setPageCount] = useState(1)
  const [fitting, setFitting] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)
  const store = loadStore()
  const comp = useMemo(() => completeness(resume), [resume])
  const flags = useMemo(() => qualityFlags(resume), [resume])
  const proofIssues = useMemo(() => (showProof ? findProofIssues(resume) : []), [showProof, resume])

  const setSettings = (patch: Partial<Resume["settings"]>) =>
    setResume((r) => ({ ...r, settings: { ...r.settings, ...patch } }))

  function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as any
        let next: Resume
        if (data && data.contact && data.settings) {
          // Native ResuMate export.
          next = normalizeResume({ ...data, id: createEmptyResume().id })
        } else if (data && (data.basics || data.work || data.$schema)) {
          // JSON Resume open standard.
          next = fromJsonResume(data)
        } else {
          throw new Error("unrecognized")
        }
        replaceResume(next)
      } catch {
        alert("That file could not be read. Import a ResuMate JSON export or a JSON Resume file.")
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

  function onNewResume() {
    replaceResume(createEmptyResume("Untitled"))
    setMobileSheet(null)
  }

  function onLoadExample() {
    if (isResumeEmpty(resume) || confirm("Load the example resume? This replaces the current resume's contents.")) {
      replaceResume({ ...createSampleResume(), id: resume.id, name: resume.name })
      setMobileSheet(null)
    }
  }

  function onDeleteResume() {
    if (!confirm("Delete this resume? This cannot be undone.")) return
    deleteResume(resume.id)
    const nextStore = loadStore()
    switchResume(nextStore.resumes[0].id)
    setMobileSheet(null)
  }

  function onClearData() {
    if (!confirm("Erase ALL ResuMate data from this browser (every resume)? Export a backup first if you want to keep it. This cannot be undone.")) return
    clearAllData()
    location.reload()
  }

  function openFilePicker(ref: React.RefObject<HTMLInputElement>) {
    setMobileSheet(null)
    ref.current?.click()
  }

  function runMobileExport(action: () => void) {
    setMobileSheet(null)
    window.setTimeout(action, 0)
  }

  // Measure how many printed pages the preview spans.
  useEffect(() => {
    const el = previewRef.current
    if (!el) return
    const measure = () => setPageCount(measurePageCount(el))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [resume])

  // Shrink font + tighten density until the resume fits on a single page.
  async function fitToOnePage() {
    setFitting(true)
    try {
      setSettings({ density: "compact" })
      let scale = resume.settings.fontScale
      for (let i = 0; i < 8; i++) {
        await nextFrame()
        const el = previewRef.current
        if (!el) break
        if (measurePageCount(el) <= 1) break
        scale = Math.max(0.8, Number((scale - 0.05).toFixed(2)))
        setSettings({ fontScale: scale })
        if (scale <= 0.8) break
      }
    } finally {
      setFitting(false)
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
          <button className="btn-ghost small" onClick={onNewResume}>+ New</button>
          <button className="btn-ghost small" onClick={onDuplicate} title="Make an editable copy of this resume">Duplicate</button>
          <button
            className="btn-ghost small"
            title="Fill the editor with a complete example you can edit"
            onClick={onLoadExample}
          >
            Load example
          </button>
          {store.resumes.length > 1 && (
            <button
              className="btn-ghost small danger"
              onClick={onDeleteResume}
            >
              Delete
            </button>
          )}
          <button
            className="btn-ghost small danger"
            title="Erase all locally stored data from this browser"
            onClick={onClearData}
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
              aria-label={`Accent color ${ACCENT_NAMES[a] || a}`}
            />
          ))}
          <span className="toolbar-label">Size</span>
          <input
            type="range"
            min={0.8}
            max={1.15}
            step={0.05}
            value={resume.settings.fontScale}
            onChange={(e) => setSettings({ fontScale: Number(e.target.value) })}
            aria-label="Font size"
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

        <div className="toolbar-group">
          <span className={`page-badge ${pageCount > 1 ? "over" : ""}`} title="Estimated printed length">{pageCount} page{pageCount === 1 ? "" : "s"}</span>
          <button className="btn-ghost small" onClick={fitToOnePage} disabled={fitting} title="Shrink text and spacing to fit one page">{fitting ? "Fitting\u2026" : "Fit to 1 page"}</button>
          <button className={`btn-ghost small ${showProof ? "active" : ""}`} onClick={() => setShowProof((s) => !s)} title="Check spelling and common writing issues">Proofread</button>
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
          <button className="btn-ghost small" onClick={() => setShowShare(true)} title="Share a read-only link or QR code">🔗 Share</button>
          <button className="btn-ghost small" onClick={() => exportAllJSON()} title="Download a backup of every saved resume">Backup all</button>
          <button className="btn-ghost small" onClick={() => backupFileRef.current?.click()} title="Restore resumes from a backup file">Restore</button>
          <input ref={backupFileRef} type="file" accept="application/json,.json" hidden onChange={onRestoreBackup} />
          <button className="btn-secondary small" onClick={() => navigate("/analyze")}>✨ ATS Check</button>
          <button className="btn-secondary small" onClick={() => exportDocx(resume)}>⬇ Word</button>
          <button className="btn-primary small" onClick={() => exportPdf()}>⬇ PDF</button>
        </div>
      </div>

      <div className="mobile-workspace-bar no-print">
        <label className="mobile-resume-select">
          <span>Resume</span>
          <select className="select" value={resume.id} onChange={(event) => switchResume(event.target.value)}>
            {store.resumes.map((item) => (
              <option key={item.id} value={item.id}>{item.contact.fullName || item.name}</option>
            ))}
          </select>
        </label>
        <button className="btn-secondary mobile-tools-button" type="button" aria-haspopup="dialog" onClick={() => setMobileSheet("tools")}>Resume tools</button>
      </div>

      <div className="mobile-tabs no-print" role="tablist" aria-label="Editor or preview">
        <button type="button" role="tab" aria-selected={mobileView === "edit"} aria-controls="builder-editor" className={`chip ${mobileView === "edit" ? "active" : ""}`} onClick={() => setMobileView("edit")}>Editor</button>
        <button type="button" role="tab" aria-selected={mobileView === "preview"} aria-controls="builder-preview" className={`chip ${mobileView === "preview" ? "active" : ""}`} onClick={() => setMobileView("preview")}>Preview</button>
      </div>
      <div className="mobile-action-dock no-print" aria-label="Mobile quick actions">
        <button className="btn-secondary small" onClick={() => navigate("/analyze")}>✨ ATS Check</button>
        <button className="btn-primary small" type="button" aria-haspopup="dialog" onClick={() => setMobileSheet("export")}>Export</button>
      </div>
      <div className={`builder-grid show-${mobileView}`}>
        <div id="builder-editor" className="editor-pane no-print" role="tabpanel" aria-label="Resume editor">
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
          {showProof && (
            <div className="proof-panel">
              <div className="proof-head">
                <strong>Proofreader</strong>
                <div className="proof-actions">
                  <button className="btn-ghost tiny" onClick={() => setResume((r) => autoFixSpelling(r))} title="Auto-fix common misspellings">Fix spelling</button>
                  <button className="btn-ghost tiny" onClick={() => setShowProof(false)} aria-label="Close proofreader">✕</button>
                </div>
              </div>
              {proofIssues.length === 0 ? (
                <p className="proof-clean">No issues found. Looking sharp! ✨</p>
              ) : (
                <ul className="proof-list">
                  {proofIssues.map((it, i) => (
                    <li key={i}>{it}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <EditorForm resume={resume} setResume={setResume} />
          <p className="privacy-note no-print">🔒 Offline editing and checks stay in this browser. AI features send selected text to the configured provider. Use “Backup all” to save a copy, or “Clear data” to wipe everything.</p>
        </div>
        <div id="builder-preview" className="preview-pane" role="tabpanel" aria-label="Resume preview">
          <div className="preview-scroll" ref={previewRef}>
            <ResumePreview resume={resume} />
          </div>
        </div>
      </div>
      {showShare && <ShareModal resume={resume} onClose={() => setShowShare(false)} />}
      <BottomSheet open={mobileSheet === "export"} title="Export resume" onClose={() => setMobileSheet(null)}>
        <p className="sheet-intro">Choose the file you need. Your resume stays in this browser.</p>
        <div className="export-primary-grid">
          <button className="export-choice primary" type="button" onClick={() => runMobileExport(exportPdf)}>
            <strong>PDF</strong><span>Print-ready and ATS-friendly</span>
          </button>
          <button className="export-choice" type="button" onClick={() => runMobileExport(() => exportDocx(resume))}>
            <strong>Word</strong><span>Editable .docx file</span>
          </button>
        </div>
        <section className="sheet-section" aria-labelledby="other-formats-title">
          <h3 id="other-formats-title">Other formats</h3>
          <div className="sheet-action-grid">
            <button className="btn-ghost" type="button" onClick={() => runMobileExport(() => exportMarkdown(resume))}>Markdown</button>
            <button className="btn-ghost" type="button" onClick={() => runMobileExport(() => exportPlainText(resume))}>Plain text</button>
            <button className="btn-ghost" type="button" onClick={() => runMobileExport(() => exportResumeJSON(resume))}>ResuMate JSON</button>
            <button className="btn-ghost" type="button" onClick={() => runMobileExport(() => exportJsonResume(resume))}>JSON Resume</button>
          </div>
        </section>
        <button className="btn-ghost sheet-full-button" type="button" onClick={() => runMobileExport(exportAllJSON)}>Back up all resumes</button>
      </BottomSheet>

      <BottomSheet open={mobileSheet === "tools"} title="Resume tools" onClose={() => setMobileSheet(null)}>
        <section className="sheet-section" aria-labelledby="resume-tools-title">
          <h3 id="resume-tools-title">Resume</h3>
          <div className="sheet-action-grid">
            <button className="btn-ghost" type="button" onClick={onNewResume}>New resume</button>
            <button className="btn-ghost" type="button" onClick={() => { onDuplicate(); setMobileSheet(null) }}>Duplicate</button>
            <button className="btn-ghost" type="button" onClick={onLoadExample}>Load example</button>
            {store.resumes.length > 1 && <button className="btn-ghost danger" type="button" onClick={onDeleteResume}>Delete resume</button>}
          </div>
        </section>

        <section className="sheet-section" aria-labelledby="design-tools-title">
          <h3 id="design-tools-title">Design</h3>
          <div className="mobile-template-grid">
            {TEMPLATES.map((template) => (
              <button key={template.id} type="button" className={`chip ${resume.settings.template === template.id ? "active" : ""}`} onClick={() => setSettings({ template: template.id })}>{template.label}</button>
            ))}
          </div>
          <div className="mobile-setting-row">
            <span className="toolbar-label">Accent</span>
            <div className="mobile-swatches">
              {ACCENTS.map((accent) => (
                <button key={accent} type="button" className={`swatch ${resume.settings.accent === accent ? "active" : ""}`} style={swatchStyle(accent)} onClick={() => setSettings({ accent })} aria-label={`Accent color ${ACCENT_NAMES[accent] || accent}`} />
              ))}
            </div>
          </div>
          <label className="mobile-setting-row setting-with-control">
            <span className="toolbar-label">Text size</span>
            <input type="range" min={0.8} max={1.15} step={0.05} value={resume.settings.fontScale} onChange={(event) => setSettings({ fontScale: Number(event.target.value) })} />
          </label>
          <label className="mobile-setting-row setting-with-control">
            <span className="toolbar-label">Spacing</span>
            <select className="select" value={resume.settings.density || "cozy"} onChange={(event) => setSettings({ density: event.target.value as Density })}>
              {DENSITIES.map((density) => <option key={density.id} value={density.id}>{density.label}</option>)}
            </select>
          </label>
        </section>

        <section className="sheet-section" aria-labelledby="editing-tools-title">
          <div className="sheet-section-heading">
            <h3 id="editing-tools-title">Editing</h3>
            <span className={`page-badge ${pageCount > 1 ? "over" : ""}`}>{pageCount} page{pageCount === 1 ? "" : "s"}</span>
          </div>
          <div className="sheet-action-grid">
            <button className="btn-ghost" type="button" onClick={undo} disabled={!canUndo}>↶ Undo</button>
            <button className="btn-ghost" type="button" onClick={redo} disabled={!canRedo}>↷ Redo</button>
            <button className="btn-ghost" type="button" onClick={fitToOnePage} disabled={fitting}>{fitting ? "Fitting…" : "Fit to 1 page"}</button>
            <button className={`btn-ghost ${showProof ? "active" : ""}`} type="button" onClick={() => { setShowProof((current) => !current); setMobileSheet(null) }}>Proofread</button>
          </div>
        </section>

        <section className="sheet-section" aria-labelledby="import-tools-title">
          <h3 id="import-tools-title">Import and share</h3>
          <div className="sheet-action-grid">
            <button className="btn-ghost" type="button" disabled={importing} onClick={() => openFilePicker(resumeFileRef)}>{importing ? "Reading…" : "Import resume"}</button>
            <button className="btn-ghost" type="button" onClick={() => openFilePicker(fileRef)}>Import JSON</button>
            <button className="btn-ghost" type="button" onClick={() => { setMobileSheet(null); setShowShare(true) }}>Share resume</button>
            <button className="btn-ghost" type="button" onClick={() => runMobileExport(exportAllJSON)}>Back up all</button>
            <button className="btn-ghost" type="button" onClick={() => openFilePicker(backupFileRef)}>Restore backup</button>
            <button className="btn-ghost danger" type="button" onClick={onClearData}>Clear browser data</button>
          </div>
        </section>
      </BottomSheet>
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
