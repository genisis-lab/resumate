import type { Resume, ResumeLanguage, SectionKey } from "../types/resume"

// Fixed words the templates print around the user's own text. Everything the
// user typed stays as written; AI translation creates a translated copy.

export interface ResumeStrings {
  sections: Record<SectionKey, string>
  shortSummary: string
  shortExperience: string
  present: string
  contact: string
  section: string
  contactLabels: { email: string; phone: string; location: string; website: string; linkedin: string; github: string }
}

export const RESUME_LANGUAGES: { id: ResumeLanguage; label: string; english: string }[] = [
  { id: "en", label: "English", english: "English" },
  { id: "es", label: "Español", english: "Spanish" },
  { id: "fr", label: "Français", english: "French" },
]

const STRINGS: Record<ResumeLanguage, ResumeStrings> = {
  en: {
    sections: { summary: "Professional Summary", experience: "Work Experience", education: "Education", skills: "Skills", projects: "Projects", certifications: "Certifications" },
    shortSummary: "Summary",
    shortExperience: "Experience",
    present: "Present",
    contact: "Contact",
    section: "Section",
    contactLabels: { email: "Email", phone: "Phone", location: "Location", website: "Website", linkedin: "LinkedIn", github: "GitHub" },
  },
  es: {
    sections: { summary: "Perfil profesional", experience: "Experiencia laboral", education: "Formación académica", skills: "Habilidades", projects: "Proyectos", certifications: "Certificaciones" },
    shortSummary: "Perfil",
    shortExperience: "Experiencia",
    present: "Actualidad",
    contact: "Contacto",
    section: "Sección",
    contactLabels: { email: "Correo", phone: "Teléfono", location: "Ubicación", website: "Sitio web", linkedin: "LinkedIn", github: "GitHub" },
  },
  fr: {
    sections: { summary: "Profil professionnel", experience: "Expérience professionnelle", education: "Formation", skills: "Compétences", projects: "Projets", certifications: "Certifications" },
    shortSummary: "Profil",
    shortExperience: "Expérience",
    present: "Aujourd’hui",
    contact: "Contact",
    section: "Section",
    contactLabels: { email: "E-mail", phone: "Téléphone", location: "Localisation", website: "Site web", linkedin: "LinkedIn", github: "GitHub" },
  },
}

export function isResumeLanguage(value: unknown): value is ResumeLanguage {
  return value === "en" || value === "es" || value === "fr"
}

export function languageOf(resume: Pick<Resume, "settings">): ResumeLanguage {
  return isResumeLanguage(resume.settings.language) ? resume.settings.language : "en"
}

export function resumeStrings(resume: Pick<Resume, "settings">): ResumeStrings {
  return STRINGS[languageOf(resume)]
}

export function languageLabel(language: ResumeLanguage): string {
  return RESUME_LANGUAGES.find((item) => item.id === language)?.label || "English"
}

export function dateRangeText(start: string, end: string, current: boolean | undefined, strings: ResumeStrings): string {
  const finish = current ? strings.present : end
  if (start && finish) return `${start} – ${finish}`
  return start || finish || ""
}
