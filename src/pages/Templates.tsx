import { useMemo, useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { ArrowLeft, Check, Lock, X } from "lucide-react"
import { Resume, TemplateId } from "../types/resume"
import { ResumePreview } from "../templates/ResumePreview"
import { PaperFrame } from "../components/PaperFrame"
import { createSampleResume } from "../data/sample"
import { navigate } from "../router"
import type { PlanId } from "../lib/billing"
import { canUseTemplate } from "../lib/usage"
import { TEMPLATES, TemplateTag, templateMeta } from "../templates/registry"
import { openUpgrade, trackEvent } from "../lib/analytics"

type Filter = "all" | "free" | "premium" | TemplateTag

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "free", label: "Free" },
  { id: "premium", label: "Premium" },
  { id: "ATS-friendly", label: "ATS-friendly" },
  { id: "Two-column", label: "Two-column" },
  { id: "Serif", label: "Serif" },
  { id: "Creative", label: "Creative" },
  { id: "Technical", label: "Technical" },
]

function hasOwnContent(r: Resume): boolean {
  return Boolean(r.contact.fullName.trim() && (r.experience.length || r.summary.trim()))
}

export function Templates({
  resume,
  setResume,
  plan,
}: {
  resume: Resume
  setResume: (r: Resume | ((p: Resume) => Resume)) => void
  plan: PlanId
}) {
  const sample = useMemo(() => createSampleResume(), [])
  const ownContent = hasOwnContent(resume)
  const [useMine, setUseMine] = useState(ownContent)
  const [filter, setFilter] = useState<Filter>("all")
  const [previewId, setPreviewId] = useState<TemplateId | null>(null)
  const base = useMine && ownContent ? resume : { ...sample, settings: { ...sample.settings, accent: resume.settings.accent } }
  const visible = TEMPLATES.filter((t) => filter === "all" || (filter === "free" ? t.tier === "free" : filter === "premium" ? t.tier === "premium" : t.tags.includes(filter)))

  function withTemplate(id: TemplateId): Resume {
    return { ...base, settings: { ...base.settings, template: id } }
  }

  function choose(id: TemplateId) {
    if (!canUseTemplate(plan, id)) trackEvent("template_previewed", { template: id, plan })
    setResume((r) => ({ ...r, settings: { ...r.settings, template: id } }))
    navigate("/builder")
  }

  const preview = previewId ? templateMeta(previewId) : null

  return (
    <div className="templates-page">
      <header className="page-header">
        <button className="btn-ghost small back-link" onClick={() => navigate("/builder")}><ArrowLeft size={15} aria-hidden="true" /> Back to editor</button>
        <h1>Templates</h1>
        <p className="page-sub">Switch any time without losing content. Free plans can preview every Premium template on their own resume before upgrading to download it.</p>
      </header>

      <div className="template-toolbar">
        <div className="filter-chips" role="group" aria-label="Filter templates">
          {FILTERS.map((item) => (
            <button key={item.id} type="button" className={`chip ${filter === item.id ? "active" : ""}`} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}</button>
          ))}
        </div>
        {ownContent && (
          <div className="segmented" role="radiogroup" aria-label="Preview content">
            <button type="button" role="radio" aria-checked={useMine} onClick={() => setUseMine(true)}>My resume</button>
            <button type="button" role="radio" aria-checked={!useMine} onClick={() => setUseMine(false)}>Sample</button>
          </div>
        )}
      </div>

      <div className="template-gallery">
        {visible.map((t) => {
          const available = canUseTemplate(plan, t.id)
          const current = resume.settings.template === t.id
          return (
            <article className={`template-card${current ? " active" : ""}`} key={t.id}>
              <button type="button" className="template-thumb" onClick={() => setPreviewId(t.id)} aria-label={`Preview the ${t.label} template`}>
                <PaperFrame size="letter">
                  <ResumePreview resume={withTemplate(t.id)} />
                </PaperFrame>
                <span className="template-badges">
                  {t.isNew && <span className="template-badge new">New</span>}
                  {t.tier === "premium" && <span className="template-badge premium">{available ? "Premium" : <><Lock size={11} aria-hidden="true" /> Premium</>}</span>}
                </span>
              </button>
              <div className="template-info">
                <div className="template-title-row">
                  <h3>{t.label}</h3>
                  {current && <span className="current-tag"><Check size={12} aria-hidden="true" /> Current</span>}
                </div>
                <p>{t.description}</p>
                <div className="template-tags">{t.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                <div className="template-actions">
                  <button className="btn-primary small" onClick={() => choose(t.id)}>{current ? "Open in editor" : available ? "Use template" : "Try it free"}</button>
                  {!available && <button className="btn-ghost small" onClick={() => openUpgrade("template_gallery", { template: t.id, plan })}>Unlock</button>}
                </div>
              </div>
            </article>
          )
        })}
      </div>

      <Dialog.Root open={Boolean(preview)} onOpenChange={(open) => { if (!open) setPreviewId(null) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content template-preview-dialog">
            {preview && (
              <>
                <div className="template-preview-head">
                  <div>
                    <Dialog.Title className="dialog-title">{preview.label}</Dialog.Title>
                    <Dialog.Description className="dialog-description">{preview.description}</Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <button className="icon-btn" aria-label="Close preview"><X size={18} aria-hidden="true" /></button>
                  </Dialog.Close>
                </div>
                <div className="template-preview-body">
                  <PaperFrame size="letter">
                    <ResumePreview resume={withTemplate(preview.id)} />
                  </PaperFrame>
                </div>
                <div className="dialog-actions">
                  {!canUseTemplate(plan, preview.id) && <button className="btn-ghost" onClick={() => openUpgrade("template_gallery", { template: preview.id, plan })}>See plans</button>}
                  <button className="btn-primary" onClick={() => choose(preview.id)}>{canUseTemplate(plan, preview.id) ? "Use this template" : "Try it on my resume"}</button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
