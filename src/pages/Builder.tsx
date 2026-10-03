import React, { useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  ChevronDown, Copy, Download, Eraser, FileDown, FileJson, FilePlus2, FileText, FileType, FileUp, FolderInput,
  Image as ImageIcon, LayoutTemplate, Lock, Palette, PencilLine, Redo2, Save, ScanSearch, Share2, Sparkles,
  SpellCheck, Trash2, Undo2, Wand2, ArchiveRestore, BookOpen, ChevronRight,
} from "lucide-react"
import { Density, PaperSize, Resume, TemplateId } from "../types/resume"
import { ResumePreview, paperSizeOf } from "../templates/ResumePreview"
import { EditorForm } from "../components/EditorForm"
import { ShareModal } from "../components/ShareModal"
import { PaperFrame } from "../components/PaperFrame"
import { exportResumeJSON, exportAllJSON, importAllJSON, duplicateResume, clearAllData, loadStore, deleteResume, normalizeResume, resumeLabel } from "../lib/storage"
import { exportMarkdown, exportPlainText, exportJsonResume } from "../lib/exportText"
import { exportResumePdf, exportResumeWord } from "../lib/exportFlow"
import { createEmptyResume, createSampleResume } from "../data/sample"
import { importResumeFromFile } from "../lib/importResume"
import { completeness, qualityFlags } from "../lib/quality"
import { nextFrame, PAGE_SIZES, type PageMetrics } from "../lib/fitPage"
import { findProofIssues, autoFixSpelling } from "../lib/proofread"
import { fromJsonResume } from "../lib/jsonResume"
import { navigate } from "../router"
import { BottomSheet } from "../components/BottomSheet"
import type { PlanId } from "../lib/billing"
import { canUseTemplate, usageSnapshot, FREE_PLAN_LIMITS } from "../lib/usage"
import { TEMPLATES, templateMeta } from "../templates/registry"
import { Menu, MenuContent, MenuItem, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger, Popover, PopoverContent, PopoverTrigger } from "../components/ui/menu"
import { confirmDialog, promptDialog } from "../components/ui/dialogs"
import { openUpgrade, trackEvent, upgradePromptViewed } from "../lib/analytics"

const DENSITIES: { id: Density; label: string }[] = [
  { id: "compact", label: "Compact" },
  { id: "cozy", label: "Cozy" },
  { id: "roomy", label: "Roomy" },
]

const ACCENTS: { color: string; name: string }[] = [
  { color: "#2563eb", name: "Blue" },
  { color: "#1e3a5f", name: "Navy" },
  { color: "#0f766e", name: "Teal" },
  { color: "#047857", name: "Emerald" },
  { color: "#7c3aed", name: "Violet" },
  { color: "#be123c", name: "Rose" },
  { color: "#b45309", name: "Amber" },
  { color: "#111827", name: "Ink" },
]

type SetResume = (r: Resume | ((p: Resume) => Resume)) => void

function DesignControls({ resume, setSettings, fitting, onFit, pages }: {
  resume: Resume
  setSettings: (patch: Partial<Resume["settings"]>) => void
  fitting: boolean
  onFit: () => void
  pages: number
}) {
  const accent = resume.settings.accent
  const custom = !ACCENTS.some((item) => item.color === accent)
  return (
    <div className="design-controls">
      <div className="design-row">
        <span className="design-label">Accent color</span>
        <div className="swatches" role="radiogroup" aria-label="Accent color">
          {ACCENTS.map((item) => (
            <button
              key={item.color}
              type="button"
              role="radio"
              aria-checked={accent === item.color}
              className={`swatch ${accent === item.color ? "active" : ""}`}
              style={{ background: item.color }}
              onClick={() => setSettings({ accent: item.color })}
              aria-label={item.name}
              title={item.name}
            />
          ))}
          <label className={`swatch swatch-custom ${custom ? "active" : ""}`} title="Custom color" style={custom ? { background: accent } : undefined}>
            <input type="color" value={accent} onChange={(event) => setSettings({ accent: event.target.value })} aria-label="Custom accent color" />
            {!custom && <Palette size={13} aria-hidden="true" />}
          </label>
        </div>
      </div>
      <label className="design-row">
        <span className="design-label">Text size <output>{Math.round(resume.settings.fontScale * 100)}%</output></span>
        <input type="range" min={0.8} max={1.15} step={0.05} value={resume.settings.fontScale} onChange={(event) => setSettings({ fontScale: Number(event.target.value) })} />
      </label>
      <div className="design-row">
        <span className="design-label">Spacing</span>
        <div className="segmented" role="radiogroup" aria-label="Spacing">
          {DENSITIES.map((density) => (
            <button key={density.id} type="button" role="radio" aria-checked={(resume.settings.density || "cozy") === density.id} onClick={() => setSettings({ density: density.id })}>{density.label}</button>
          ))}
        </div>
      </div>
      <div className="design-row">
        <span className="design-label">Paper size</span>
        <div className="segmented" role="radiogroup" aria-label="Paper size">
          {(Object.keys(PAGE_SIZES) as PaperSize[]).map((size) => (
            <button key={size} type="button" role="radio" aria-checked={paperSizeOf(resume) === size} onClick={() => setSettings({ paperSize: size === "a4" ? "a4" : undefined })}>{PAGE_SIZES[size].label}</button>
          ))}
        </div>
      </div>
      <button type="button" className="btn-ghost design-fit" onClick={onFit} disabled={fitting || pages <= 1}>
        <Wand2 size={16} aria-hidden="true" />
        {fitting ? "Fitting…" : pages > 1 ? `Fit to one page (now ${pages})` : "Fits on one page"}
      </button>
    </div>
  )
}

function TemplateItems({ plan }: { plan: PlanId }) {
  return (
    <>
      <MenuLabel>Free</MenuLabel>
      {TEMPLATES.filter((t) => t.tier === "free").map((t) => (
        <MenuRadioItem key={t.id} value={t.id}>{t.label}</MenuRadioItem>
      ))}
      <MenuSeparator />
      <MenuLabel>Premium</MenuLabel>
      {TEMPLATES.filter((t) => t.tier === "premium").map((t) => (
        <MenuRadioItem key={t.id} value={t.id} hint={canUseTemplate(plan, t.id) ? (t.isNew ? <span className="menu-badge">New</span> : undefined) : <Lock size={13} aria-label="Premium" />}>
          {t.label}
        </MenuRadioItem>
      ))}
    </>
  )
}

export function Builder({
  resume,
  setResume,
  switchResume,
  replaceResume,
  undo,
  redo,
  canUndo,
  canRedo,
  plan,
  planReady = true,
}: {
  resume: Resume
  setResume: SetResume
  switchResume: (id: string) => void
  replaceResume: (r: Resume) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  plan: PlanId
  planReady?: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const resumeFileRef = useRef<HTMLInputElement>(null)
  const backupFileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit")
  const [showProof, setShowProof] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [mobileSheet, setMobileSheet] = useState<"tools" | "export" | null>(null)
  const [metrics, setMetrics] = useState<PageMetrics>({ pages: 1, breaks: [] })
  const metricsRef = useRef(metrics)
  metricsRef.current = metrics
  const [fitting, setFitting] = useState(false)
  const [, refreshUsage] = useState(0)
  const store = loadStore()
  const comp = useMemo(() => completeness(resume), [resume])
  const flags = useMemo(() => qualityFlags(resume), [resume])
  const proofIssues = useMemo(() => (showProof ? findProofIssues(resume) : []), [showProof, resume])
  const exportUsage = usageSnapshot(plan, "documentExports")
  const template = templateMeta(resume.settings.template)
  const templateLocked = planReady && !canUseTemplate(plan, resume.settings.template)
  const pages = metrics.pages

  const setSettings = (patch: Partial<Resume["settings"]>) =>
    setResume((r) => ({ ...r, settings: { ...r.settings, ...patch } }))

  function chooseTemplate(id: TemplateId) {
    setSettings({ template: id })
    if (!canUseTemplate(plan, id)) {
      trackEvent("template_previewed", { template: id, plan })
      toast.info(`${templateMeta(id).label} is a Premium template`, {
        description: "Preview it free on your resume. Upgrade to download it as a PDF.",
        action: { label: "See plans", onClick: () => openUpgrade("builder_template", { template: id, plan }) },
      })
    }
  }

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
          next = normalizeResume({ ...data, id: plan === "free" ? resume.id : createEmptyResume().id })
        } else if (data && (data.basics || data.work || data.$schema)) {
          // JSON Resume open standard.
          next = fromJsonResume(data)
        } else {
          throw new Error("unrecognized")
        }
        replaceResume(plan === "free" ? { ...next, id: resume.id, name: resume.name } : next)
        toast.success("Resume imported")
      } catch {
        toast.error("That file could not be read.", { description: "Import a ResuMate JSON export or a JSON Resume file." })
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
      replaceResume(plan === "free" ? { ...next, id: resume.id, name: resume.name } : next)
      toast.success("Resume imported", { description: "Review each section — automatic parsing can miss details." })
    } catch (err) {
      toast.error("Couldn't import that file.", {
        description: `Upload a text-based PDF or a .txt resume, or use Import JSON. ${err instanceof Error ? err.message : ""}`.trim(),
      })
    } finally {
      setImporting(false)
      e.target.value = ""
    }
  }

  async function onRestoreBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const count = await importAllJSON(file, plan === "free" ? { replaceSingleId: resume.id } : undefined)
      const s = loadStore()
      switchResume(plan === "free" ? resume.id : s.resumes[0].id)
      toast.success(`Restored ${count} resume${count === 1 ? "" : "s"} from your backup.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not restore that backup.")
    } finally {
      e.target.value = ""
    }
  }

  function upgradeToast(message: string) {
    upgradePromptViewed("builder_banner", { plan })
    toast.info(message, { action: { label: "See plans", onClick: () => openUpgrade("builder_banner", { plan }) } })
  }

  function onDuplicate() {
    if (plan === "free") {
      upgradeToast("The Free plan supports 1 active resume. Upgrade to create job-specific versions.")
      return
    }
    const copy = duplicateResume(resume.id)
    if (copy) {
      switchResume(copy.id)
      toast.success(`Created “${resumeLabel(copy)}”`)
    }
  }

  function onNewResume() {
    setMobileSheet(null)
    if (plan === "free") {
      upgradeToast("The Free plan supports 1 active resume. Upgrade to create another resume.")
      return
    }
    replaceResume(createEmptyResume("Untitled resume"))
  }

  async function onRename() {
    setMobileSheet(null)
    const name = await promptDialog({
      title: "Rename this resume",
      description: "Use a label that tells versions apart, such as the target company or role.",
      input: { label: "Resume name", defaultValue: resume.name, maxLength: 80, placeholder: "Product Designer — Acme" },
      confirmLabel: "Save name",
    })
    if (name) setResume((r) => ({ ...r, name }))
  }

  async function onLoadExample() {
    setMobileSheet(null)
    if (!isResumeEmpty(resume) && !(await confirmDialog({ title: "Load the example resume?", description: "This replaces the current resume's contents. Undo is reset after loading.", confirmLabel: "Load example", tone: "danger" }))) return
    replaceResume({ ...createSampleResume(), id: resume.id, name: resume.name })
  }

  async function onDeleteResume() {
    setMobileSheet(null)
    if (!(await confirmDialog({ title: `Delete “${resumeLabel(resume)}”?`, description: "This removes the resume from this browser and cannot be undone.", confirmLabel: "Delete resume", tone: "danger" }))) return
    deleteResume(resume.id)
    const nextStore = loadStore()
    switchResume(nextStore.resumes[0].id)
    toast.success("Resume deleted")
  }

  async function onClearData() {
    setMobileSheet(null)
    if (!(await confirmDialog({ title: "Erase all ResuMate data from this browser?", description: "Every resume, saved job, and application will be removed. Download a backup first if you want to keep anything. This cannot be undone.", confirmLabel: "Erase everything", tone: "danger" }))) return
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

  function runPdfExport() {
    void exportResumePdf(resume, plan).finally(() => refreshUsage((value) => value + 1))
  }

  function runWordExport() {
    exportResumeWord(resume, plan)
    refreshUsage((value) => value + 1)
  }

  // Shrink font + tighten density until the resume fits on a single page.
  async function fitToOnePage() {
    setFitting(true)
    try {
      setSettings({ density: "compact" })
      let scale = resume.settings.fontScale
      for (let i = 0; i < 8; i++) {
        await nextFrame()
        await nextFrame()
        if (metricsRef.current.pages <= 1) break
        scale = Math.max(0.8, Number((scale - 0.05).toFixed(2)))
        setSettings({ fontScale: scale })
        if (scale <= 0.8) break
      }
      await nextFrame()
      await nextFrame()
      if (metricsRef.current.pages > 1) toast.info("Still more than one page at the smallest size.", { description: "Trim older roles or long bullets to fit one page." })
      else toast.success("Your resume now fits on one page")
    } finally {
      setFitting(false)
    }
  }

  const exportHint = plan === "free" ? `${exportUsage.remaining} of ${FREE_PLAN_LIMITS.documentExports} free exports left this month` : undefined

  return (
    <div className="builder">
      <div className="builder-bar no-print" role="toolbar" aria-label="Resume tools">
        <div className="bar-group">
          <Menu>
            <MenuTrigger asChild>
              <button className="bar-button resume-switcher" type="button" title="Switch, create, or manage resumes">
                <FileText size={16} aria-hidden="true" />
                <span className="resume-switcher-name">{resumeLabel(resume)}</span>
                <ChevronDown size={14} aria-hidden="true" />
              </button>
            </MenuTrigger>
            <MenuContent className="menu-wide">
              <MenuLabel>Your resumes</MenuLabel>
              <MenuRadioGroup value={resume.id} onValueChange={switchResume}>
                {store.resumes.map((item) => (
                  <MenuRadioItem key={item.id} value={item.id} hint={item.contact.fullName && item.contact.fullName !== item.name ? item.contact.fullName : undefined}>
                    {resumeLabel(item)}
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
              <MenuSeparator />
              <MenuItem icon={<FilePlus2 size={15} />} onSelect={onNewResume} hint={plan === "free" ? <Lock size={13} /> : undefined}>New resume</MenuItem>
              <MenuItem icon={<Copy size={15} />} onSelect={onDuplicate} hint={plan === "free" ? <Lock size={13} /> : undefined}>Duplicate as new version</MenuItem>
              <MenuItem icon={<PencilLine size={15} />} onSelect={() => void onRename()}>Rename…</MenuItem>
              <MenuItem icon={<BookOpen size={15} />} onSelect={() => void onLoadExample()}>Load example content</MenuItem>
              <MenuSeparator />
              <MenuItem icon={<FileUp size={15} />} disabled={importing} onSelect={() => resumeFileRef.current?.click()}>{importing ? "Reading…" : "Import PDF or text résumé"}</MenuItem>
              <MenuItem icon={<FolderInput size={15} />} onSelect={() => fileRef.current?.click()}>Import JSON</MenuItem>
              <MenuItem icon={<Save size={15} />} onSelect={() => exportAllJSON()}>Back up all resumes</MenuItem>
              <MenuItem icon={<ArchiveRestore size={15} />} onSelect={() => backupFileRef.current?.click()}>Restore a backup</MenuItem>
              <MenuSeparator />
              {store.resumes.length > 1 && <MenuItem icon={<Trash2 size={15} />} tone="danger" onSelect={() => void onDeleteResume()}>Delete this resume</MenuItem>}
              <MenuItem icon={<Eraser size={15} />} tone="danger" onSelect={() => void onClearData()}>Erase all browser data</MenuItem>
            </MenuContent>
          </Menu>
        </div>

        <div className="bar-group">
          <Menu>
            <MenuTrigger asChild>
              <button className="bar-button" type="button" title="Choose a template">
                <LayoutTemplate size={16} aria-hidden="true" />
                <span className="bar-label">{template.label}</span>
                {templateLocked && <Lock size={13} aria-label="Premium" />}
                <ChevronDown size={14} aria-hidden="true" />
              </button>
            </MenuTrigger>
            <MenuContent className="menu-scroll">
              <MenuRadioGroup value={resume.settings.template} onValueChange={(value) => chooseTemplate(value as TemplateId)}>
                <TemplateItems plan={plan} />
              </MenuRadioGroup>
              <MenuSeparator />
              <MenuItem icon={<ImageIcon size={15} />} onSelect={() => navigate("/templates")}>Browse the template gallery</MenuItem>
            </MenuContent>
          </Menu>
          <Popover>
            <PopoverTrigger asChild>
              <button className="bar-button" type="button" title="Accent color, text size, spacing, and paper size">
                <span className="accent-dot" style={{ background: resume.settings.accent }} aria-hidden="true" />
                <span className="bar-label">Design</span>
                <ChevronDown size={14} aria-hidden="true" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="design-popover">
              <DesignControls resume={resume} setSettings={setSettings} fitting={fitting} onFit={() => void fitToOnePage()} pages={pages} />
            </PopoverContent>
          </Popover>
        </div>

        <div className="bar-group">
          <button className="bar-icon" type="button" onClick={undo} disabled={!canUndo} title="Undo (Ctrl/Cmd+Z)" aria-label="Undo"><Undo2 size={17} /></button>
          <button className="bar-icon" type="button" onClick={redo} disabled={!canRedo} title="Redo (Ctrl/Cmd+Shift+Z)" aria-label="Redo"><Redo2 size={17} /></button>
        </div>

        <div className="bar-group">
          <button
            type="button"
            className={`page-badge ${pages > 1 ? "over" : ""}`}
            onClick={() => pages > 1 && void fitToOnePage()}
            disabled={fitting || pages <= 1}
            title={pages > 1 ? "Shrink text and spacing to fit one page" : "Estimated printed length"}
          >
            {fitting ? "Fitting…" : `${pages} page${pages === 1 ? "" : "s"}`}
            {pages > 1 && !fitting && <span className="page-badge-action">· Fit</span>}
          </button>
          <button className={`bar-button ${showProof ? "active" : ""}`} type="button" aria-pressed={showProof} onClick={() => setShowProof((s) => !s)} title="Check spelling and common writing issues">
            <SpellCheck size={16} aria-hidden="true" /><span className="bar-label">Proofread</span>
          </button>
        </div>

        <div className="bar-group bar-end">
          <button className="bar-button" type="button" onClick={() => navigate("/analyze")} title="Compare this resume with a job description">
            <ScanSearch size={16} aria-hidden="true" /><span className="bar-label">ATS check</span>
          </button>
          <button className="bar-icon" type="button" onClick={() => setShowShare(true)} title="Share a read-only link or QR code" aria-label="Share"><Share2 size={17} /></button>
          <Menu>
            <MenuTrigger asChild>
              <button className="bar-button" type="button" title="More export formats">
                <FileDown size={16} aria-hidden="true" /><span className="bar-label">Export</span><ChevronDown size={14} aria-hidden="true" />
              </button>
            </MenuTrigger>
            <MenuContent align="end" className="menu-wide">
              {exportHint && <MenuLabel>{exportHint}</MenuLabel>}
              <MenuItem icon={<Download size={15} />} onSelect={runPdfExport} hint={templateLocked ? <Lock size={13} /> : "Ctrl+S"}>PDF · print-ready</MenuItem>
              <MenuItem icon={<FileType size={15} />} onSelect={runWordExport}>Word · editable .docx</MenuItem>
              <MenuSeparator />
              <MenuItem icon={<FileText size={15} />} onSelect={() => exportMarkdown(resume)}>Markdown (.md)</MenuItem>
              <MenuItem icon={<FileText size={15} />} onSelect={() => exportPlainText(resume)}>Plain text (.txt)</MenuItem>
              <MenuItem icon={<FileJson size={15} />} onSelect={() => exportResumeJSON(resume)}>ResuMate JSON</MenuItem>
              <MenuItem icon={<FileJson size={15} />} onSelect={() => exportJsonResume(resume)}>JSON Resume standard</MenuItem>
            </MenuContent>
          </Menu>
          <button className="btn-primary bar-primary" type="button" onClick={runPdfExport} title={exportHint || "Download a print-ready PDF"}>
            <Download size={16} aria-hidden="true" /> Download PDF
          </button>
        </div>
        <input ref={resumeFileRef} type="file" accept=".pdf,.txt,.md,.text,application/pdf,text/plain" hidden onChange={onImportResume} />
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onImport} />
        <input ref={backupFileRef} type="file" accept="application/json,.json" hidden onChange={onRestoreBackup} />
      </div>

      <div className="mobile-workspace-bar no-print">
        <label className="mobile-resume-select">
          <span>Resume</span>
          <select className="select" value={resume.id} onChange={(event) => switchResume(event.target.value)}>
            {store.resumes.map((item) => (
              <option key={item.id} value={item.id}>{resumeLabel(item)}</option>
            ))}
          </select>
        </label>
        <button className="btn-secondary mobile-tools-button" type="button" aria-haspopup="dialog" onClick={() => setMobileSheet("tools")}>Resume tools</button>
      </div>

      <div className="mobile-tabs no-print" role="tablist" aria-label="Editor or preview">
        <button type="button" role="tab" aria-selected={mobileView === "edit"} aria-controls="builder-editor" className={`chip ${mobileView === "edit" ? "active" : ""}`} onClick={() => setMobileView("edit")}>Editor</button>
        <button type="button" role="tab" aria-selected={mobileView === "preview"} aria-controls="builder-preview" className={`chip ${mobileView === "preview" ? "active" : ""}`} onClick={() => setMobileView("preview")}>Preview · {pages} pg</button>
      </div>
      <div className="mobile-action-dock no-print" aria-label="Mobile quick actions">
        <button className="btn-secondary small" onClick={() => navigate("/analyze")}><ScanSearch size={17} aria-hidden="true" /> ATS check</button>
        <button className="btn-primary small" type="button" aria-haspopup="dialog" onClick={() => setMobileSheet("export")}><Download size={17} aria-hidden="true" /> Export</button>
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
          <button type="button" className="coach-callout" onClick={() => navigate("/coach")}>
            <span className="coach-callout-icon" aria-hidden="true"><Sparkles size={18} /></span>
            <span className="coach-callout-copy">
              <strong>AI coach</strong>
              <span>Review your whole resume, draft bullets for a role, fix grammar, and check consistency.</span>
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          {showProof && (
            <div className="proof-panel" role="region" aria-label="Proofreader">
              <div className="proof-head">
                <strong>Proofreader</strong>
                <div className="proof-actions">
                  <button className="btn-ghost tiny" onClick={() => { setResume((r) => autoFixSpelling(r)); toast.success("Common misspellings fixed") }} title="Auto-fix common misspellings">Fix spelling</button>
                  <button className="btn-ghost tiny" onClick={() => setShowProof(false)} aria-label="Close proofreader">✕</button>
                </div>
              </div>
              {proofIssues.length === 0 ? (
                <p className="proof-clean">No issues found. Looking sharp!</p>
              ) : (
                <ul className="proof-list">
                  {proofIssues.map((it, i) => (
                    <li key={i}>{it}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <EditorForm resume={resume} setResume={setResume} plan={plan} />
          <p className="privacy-note no-print">Offline editing and checks stay in this browser. AI features send selected text to the configured provider. Use “Back up all resumes” in the resume menu to save a copy.</p>
        </div>
        <div id="builder-preview" className="preview-pane" role="tabpanel" aria-label="Resume preview">
          {templateLocked && (
            <div className="premium-banner no-print" role="status">
              <Lock size={16} aria-hidden="true" />
              <span><strong>{template.label}</strong> is a Premium template. Preview it free — upgrade to download it.</span>
              <button type="button" className="btn-primary small" onClick={() => openUpgrade("builder_template", { template: resume.settings.template, plan })}>See plans</button>
            </div>
          )}
          <PaperFrame size={paperSizeOf(resume)} showPageBreaks onMetrics={setMetrics} className="preview-frame">
            <ResumePreview resume={resume} printTarget />
          </PaperFrame>
        </div>
      </div>
      {showShare && <ShareModal resume={resume} onClose={() => setShowShare(false)} />}
      <BottomSheet open={mobileSheet === "export"} title="Export resume" onClose={() => setMobileSheet(null)}>
        <p className="sheet-intro">Choose the file you need. Your resume stays in this browser.{exportHint ? ` ${exportHint}.` : ""}</p>
        <div className="export-primary-grid">
          <button className="export-choice primary" type="button" onClick={() => runMobileExport(runPdfExport)}>
            <strong>PDF</strong><span>{templateLocked ? "Premium template — upgrade to download" : "Print-ready and ATS-friendly"}</span>
          </button>
          <button className="export-choice" type="button" onClick={() => runMobileExport(runWordExport)}>
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
            <button className="btn-ghost" type="button" onClick={() => void onRename()}>Rename</button>
            <button className="btn-ghost" type="button" onClick={() => void onLoadExample()}>Load example</button>
            {store.resumes.length > 1 && <button className="btn-ghost danger" type="button" onClick={() => void onDeleteResume()}>Delete resume</button>}
          </div>
        </section>

        <section className="sheet-section" aria-labelledby="design-tools-title">
          <h3 id="design-tools-title">Template</h3>
          <div className="mobile-template-grid">
            {TEMPLATES.map((item) => (
              <button key={item.id} type="button" aria-pressed={resume.settings.template === item.id} className={`chip ${resume.settings.template === item.id ? "active" : ""}${canUseTemplate(plan, item.id) ? "" : " locked"}`} onClick={() => chooseTemplate(item.id)}>
                {item.label}{!canUseTemplate(plan, item.id) && <Lock size={12} aria-label="Premium" />}
              </button>
            ))}
          </div>
        </section>
        <section className="sheet-section" aria-labelledby="design-controls-title">
          <h3 id="design-controls-title">Design</h3>
          <DesignControls resume={resume} setSettings={setSettings} fitting={fitting} onFit={() => void fitToOnePage()} pages={pages} />
        </section>

        <section className="sheet-section" aria-labelledby="editing-tools-title">
          <div className="sheet-section-heading">
            <h3 id="editing-tools-title">Editing</h3>
            <span className={`page-badge ${pages > 1 ? "over" : ""}`}>{pages} page{pages === 1 ? "" : "s"}</span>
          </div>
          <div className="sheet-action-grid">
            <button className="btn-ghost" type="button" onClick={undo} disabled={!canUndo}><Undo2 size={16} aria-hidden="true" /> Undo</button>
            <button className="btn-ghost" type="button" onClick={redo} disabled={!canRedo}><Redo2 size={16} aria-hidden="true" /> Redo</button>
            <button className={`btn-ghost ${showProof ? "active" : ""}`} type="button" onClick={() => { setShowProof((current) => !current); setMobileSheet(null) }}>Proofread</button>
            <button className="btn-ghost" type="button" onClick={() => { setMobileSheet(null); navigate("/templates") }}>Template gallery</button>
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
            <button className="btn-ghost danger" type="button" onClick={() => void onClearData()}>Erase browser data</button>
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
