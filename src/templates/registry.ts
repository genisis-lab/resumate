// Single source of truth for resume templates. The Builder, template gallery,
// plan gating, Word export, and pricing copy all read from this list so a new
// template only needs to be registered once.
import type { TemplateId } from "../types/resume"

export type TemplateTier = "free" | "premium"
export type TemplateTag = "ATS-friendly" | "Two-column" | "Serif" | "Modern" | "Creative" | "Technical" | "Executive" | "Compact"

export interface TemplateMeta {
  id: TemplateId
  label: string
  description: string
  tier: TemplateTier
  tags: TemplateTag[]
  isNew?: boolean
  /** Fonts requested in Word exports. Word substitutes an installed font when one is missing. */
  docx: { body: string; heading: string }
}

const SANS = { body: "Calibri", heading: "Calibri" }
const SERIF = { body: "Georgia", heading: "Georgia" }

export const TEMPLATES: readonly TemplateMeta[] = [
  { id: "modern", label: "Modern", description: "Polished with a subtle accent color. A dependable all-rounder.", tier: "free", tags: ["ATS-friendly", "Modern"], docx: SANS },
  { id: "classic", label: "Classic", description: "Traditional serif headings for corporate and public-sector roles.", tier: "free", tags: ["ATS-friendly", "Serif"], docx: SERIF },
  { id: "ats", label: "ATS-Safe", description: "Single column, standard headings, and maximum parseability.", tier: "free", tags: ["ATS-friendly", "Serif"], docx: { body: "Times New Roman", heading: "Times New Roman" } },
  { id: "sidebar", label: "Horizon", description: "A full-height accent sidebar for contact details, skills, and education beside your experience.", tier: "premium", tags: ["Two-column", "Modern", "Creative"], isNew: true, docx: SANS },
  { id: "elegant", label: "Elegant", description: "Garamond body, spaced capitals, and centered rules for consulting, law, and hospitality.", tier: "premium", tags: ["Serif", "Executive"], isNew: true, docx: { body: "Garamond", heading: "Garamond" } },
  { id: "timeline", label: "Timeline", description: "Experience on a clean vertical timeline that makes career progression easy to follow.", tier: "premium", tags: ["Modern", "ATS-friendly"], isNew: true, docx: SANS },
  { id: "swiss", label: "Swiss Grid", description: "Section labels in a left column and content on a strict typographic grid.", tier: "premium", tags: ["Modern", "ATS-friendly"], isNew: true, docx: { body: "Arial", heading: "Arial" } },
  { id: "bold", label: "Bold", description: "Oversized name, accent section labels, and skill chips for design and marketing roles.", tier: "premium", tags: ["Creative", "Modern"], isNew: true, docx: SANS },
  { id: "developer", label: "Developer", description: "Monospace accents, compact skills, and link-friendly projects for engineers.", tier: "premium", tags: ["Technical", "Modern"], isNew: true, docx: { body: "Calibri", heading: "Consolas" } },
  { id: "monogram", label: "Monogram", description: "An initials badge and tinted header band for a memorable, personal first impression.", tier: "premium", tags: ["Creative", "Modern"], isNew: true, docx: SANS },
  { id: "professional", label: "Professional Serif", description: "Serif headings, a clean sans-serif body, and company-first experience for detailed resumes.", tier: "premium", tags: ["Serif", "ATS-friendly"], docx: { body: "Arial", heading: "Georgia" } },
  { id: "minimal", label: "Minimal", description: "Generous whitespace with lightweight, quiet headings.", tier: "premium", tags: ["Modern", "ATS-friendly"], docx: SANS },
  { id: "twocolumn", label: "Two-Column", description: "Skills and education in a sidebar, experience in the main column.", tier: "premium", tags: ["Two-column", "Modern"], docx: SANS },
  { id: "creative", label: "Creative", description: "A bold accent header band and section underlines for design-forward roles.", tier: "premium", tags: ["Creative"], docx: SANS },
  { id: "executive", label: "Executive", description: "Confident hierarchy and conservative rules for senior leadership roles.", tier: "premium", tags: ["Executive", "Serif"], docx: SERIF },
  { id: "compact", label: "Compact", description: "A dense single column for experienced candidates with more to fit.", tier: "premium", tags: ["Compact", "ATS-friendly"], docx: SANS },
  { id: "technical", label: "Technical", description: "Clear skills, projects, and experience hierarchy for engineering and data roles.", tier: "premium", tags: ["Technical", "ATS-friendly"], docx: SANS },
]

const BY_ID = new Map(TEMPLATES.map((template) => [template.id, template]))

export const TEMPLATE_IDS = TEMPLATES.map((template) => template.id)
export const FREE_TEMPLATE_IDS = TEMPLATES.filter((template) => template.tier === "free").map((template) => template.id)
export const PREMIUM_TEMPLATE_COUNT = TEMPLATES.length - FREE_TEMPLATE_IDS.length

export function isTemplateId(value: unknown): value is TemplateId {
  return typeof value === "string" && BY_ID.has(value as TemplateId)
}

export function templateMeta(id: TemplateId): TemplateMeta {
  return BY_ID.get(id) || TEMPLATES[0]
}
