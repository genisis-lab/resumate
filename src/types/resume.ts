// Core resume data model — single source of truth for the whole app.

export type TemplateId =
  | "modern"
  | "classic"
  | "minimal"
  | "ats"
  | "twocolumn"
  | "creative"

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

export type Density = "compact" | "cozy" | "roomy"

export interface ResumeSettings {
  template: TemplateId
  accent: string
  fontScale: number // 0.9 - 1.15
  // Optional vertical spacing preset. Undefined behaves like "cozy".
  density?: Density
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
