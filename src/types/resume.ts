// Core resume data model — single source of truth for the whole app.

export type TemplateId =
  | "modern"
  | "classic"
  | "minimal"
  | "ats"
  | "twocolumn"
  | "creative"
  | "executive"
  | "compact"
  | "technical"
  | "professional"
  | "sidebar"
  | "elegant"
  | "timeline"
  | "swiss"
  | "bold"
  | "developer"
  | "monogram"

export type SectionKey =
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certifications"

export interface Contact {
  fullName: string
  headline: string
  email: string
  phone: string
  location: string
  website: string
  linkedin: string
  github: string
}

export interface ExperienceItem {
  id: string
  company: string
  role: string
  location: string
  startDate: string
  endDate: string
  current: boolean
  bullets: string[]
}

export interface EducationItem {
  id: string
  school: string
  degree: string
  field: string
  location: string
  startDate: string
  endDate: string
  details: string
}

export interface ProjectItem {
  id: string
  name: string
  link: string
  description: string
  bullets: string[]
}

export interface CertificationItem {
  id: string
  name: string
  issuer: string
  date: string
}

export interface SkillGroup {
  id: string
  category: string
  items: string[]
}

export interface CustomEntry {
  id: string
  title: string
  subtitle: string
  date: string
  description: string
  bullets: string[]
}

export interface CustomSection {
  id: string
  title: string
  hidden?: boolean
  items: CustomEntry[]
}

export type Density = "compact" | "cozy" | "roomy"
export type ResumeLanguage = "en" | "es" | "fr"
export type PaperSize = "letter" | "a4"

export interface ResumeSettings {
  template: TemplateId
  accent: string
  fontScale: number // 0.8 - 1.15
  // Optional vertical spacing preset. Undefined behaves like "cozy".
  density?: Density
  // Optional page size for preview and PDF export. Undefined behaves like "letter".
  paperSize?: PaperSize
  // Language of the fixed headings and labels. Undefined behaves like "en".
  language?: ResumeLanguage
  sectionOrder: SectionKey[]
  hidden: SectionKey[]
}

export interface Resume {
  id: string
  name: string // internal label for this saved resume
  updatedAt: number
  contact: Contact
  summary: string
  experience: ExperienceItem[]
  education: EducationItem[]
  skills: SkillGroup[]
  projects: ProjectItem[]
  certifications: CertificationItem[]
  customSections: CustomSection[]
  settings: ResumeSettings
}

export const SECTION_LABELS: Record<SectionKey, string> = {
  summary: "Professional Summary",
  experience: "Work Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
}
