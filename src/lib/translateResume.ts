import type { Resume, ResumeLanguage } from "../types/resume"
import { uid } from "./id"
import { languageLabel } from "./resumeLanguage"

// Only the resume's prose is sent for translation. Names, employers, schools,
// issuers (custom-entry subtitles), contact details, links, and certification
// names stay exactly as written.

export interface Segment {
  id: string
  text: string
}

const hasLetters = (value: string) => /\p{L}/u.test(value)

export function translationSegments(resume: Resume): Segment[] {
  const out: Segment[] = []
  const add = (id: string, value: string | undefined) => {
    const text = (value || "").trim()
    if (text && text.length <= 2_000) out.push({ id, text })
  }
  const addDate = (id: string, value: string) => {
    if (hasLetters(value)) add(`date:${id}`, value)
  }
  add("headline", resume.contact.headline)
  add("summary", resume.summary)
  resume.experience.forEach((item, index) => {
    add(`exp.${index}.role`, item.role)
    addDate(`exp.${index}.start`, item.startDate)
    if (!item.current) addDate(`exp.${index}.end`, item.endDate)
    item.bullets.forEach((bullet, at) => add(`exp.${index}.b.${at}`, bullet))
  })
  resume.education.forEach((item, index) => {
    add(`edu.${index}.degree`, item.degree)
    add(`edu.${index}.field`, item.field)
    add(`edu.${index}.details`, item.details)
    addDate(`edu.${index}.start`, item.startDate)
    addDate(`edu.${index}.end`, item.endDate)
  })
  resume.skills.forEach((group, index) => {
    add(`skill.${index}.category`, group.category)
    group.items.forEach((skill, at) => add(`skill.${index}.i.${at}`, skill))
  })
  resume.projects.forEach((item, index) => {
    add(`proj.${index}.description`, item.description)
    item.bullets.forEach((bullet, at) => add(`proj.${index}.b.${at}`, bullet))
  })
  resume.certifications.forEach((item, index) => addDate(`cert.${index}.date`, item.date))
  resume.customSections.forEach((section, index) => {
    add(`custom.${index}.title`, section.title)
    section.items.forEach((item, at) => {
      add(`custom.${index}.${at}.title`, item.title)
      add(`custom.${index}.${at}.description`, item.description)
      addDate(`custom.${index}.${at}.date`, item.date)
      item.bullets.forEach((bullet, b) => add(`custom.${index}.${at}.b.${b}`, bullet))
    })
  })
  return out
}

// Build a new resume version from the translations; the original is untouched.
export function applyTranslations(resume: Resume, language: ResumeLanguage, translations: Segment[]): Resume {
  const map = new Map(translations.map((item) => [item.id, item.text]))
  const pick = (id: string, fallback: string) => map.get(id) ?? map.get(`date:${id}`) ?? fallback
  const copy: Resume = structuredClone(resume)
  copy.id = uid("resume")
  copy.updatedAt = Date.now()
  const base = resume.name.replace(/\s*\((English|Español|Français)\)$/u, "")
  copy.name = `${base} (${languageLabel(language)})`
  copy.settings = { ...copy.settings, language: language === "en" ? undefined : language }
  copy.contact.headline = pick("headline", copy.contact.headline)
  copy.summary = pick("summary", copy.summary)
  copy.experience = copy.experience.map((item, index) => ({
    ...item,
    id: uid("exp"),
    role: pick(`exp.${index}.role`, item.role),
    startDate: pick(`exp.${index}.start`, item.startDate),
    endDate: pick(`exp.${index}.end`, item.endDate),
    bullets: item.bullets.map((bullet, at) => pick(`exp.${index}.b.${at}`, bullet)),
  }))
  copy.education = copy.education.map((item, index) => ({
    ...item,
    id: uid("edu"),
    degree: pick(`edu.${index}.degree`, item.degree),
    field: pick(`edu.${index}.field`, item.field),
    details: pick(`edu.${index}.details`, item.details),
    startDate: pick(`edu.${index}.start`, item.startDate),
    endDate: pick(`edu.${index}.end`, item.endDate),
  }))
  copy.skills = copy.skills.map((group, index) => ({
    ...group,
    id: uid("sk"),
    category: pick(`skill.${index}.category`, group.category),
    items: group.items.map((skill, at) => pick(`skill.${index}.i.${at}`, skill)),
  }))
  copy.projects = copy.projects.map((item, index) => ({
    ...item,
    id: uid("proj"),
    description: pick(`proj.${index}.description`, item.description),
    bullets: item.bullets.map((bullet, at) => pick(`proj.${index}.b.${at}`, bullet)),
  }))
  copy.certifications = copy.certifications.map((item, index) => ({ ...item, id: uid("cert"), date: pick(`cert.${index}.date`, item.date) }))
  copy.customSections = copy.customSections.map((section, index) => ({
    ...section,
    id: uid("custom"),
    title: pick(`custom.${index}.title`, section.title),
    items: section.items.map((item, at) => ({
      ...item,
      id: uid("entry"),
      title: pick(`custom.${index}.${at}.title`, item.title),
      description: pick(`custom.${index}.${at}.description`, item.description),
      date: pick(`custom.${index}.${at}.date`, item.date),
      bullets: item.bullets.map((bullet, b) => pick(`custom.${index}.${at}.b.${b}`, bullet)),
    })),
  }))
  return copy
}
