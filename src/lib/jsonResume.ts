// Import a JSON Resume (https://jsonresume.org/schema) document into our Resume.
import { Resume } from "../types/resume"
import { createEmptyResume } from "../data/sample"
import { uid } from "./id"

function toBullets(highlights?: any, summary?: string): string[] {
  const out: string[] = []
  if (summary) out.push(summary)
  if (Array.isArray(highlights)) out.push(...highlights.filter(Boolean))
  return out.length ? out : [""]
}

export function fromJsonResume(obj: any): Resume {
  const base = createEmptyResume()
  const basics = obj.basics || {}
  const profiles: any[] = basics.profiles || []
  const findUrl = (network: string) =>
    profiles.find((p) => (p.network || "").toLowerCase() === network)?.url || ""

  base.contact = {
    ...base.contact,
    fullName: basics.name || "",
    headline: basics.label || "",
    email: basics.email || "",
    phone: basics.phone || "",
    location: [basics.location?.city, basics.location?.region].filter(Boolean).join(", "),
    website: basics.url || basics.website || "",
    linkedin: findUrl("linkedin"),
    github: findUrl("github"),
  }
  base.summary = basics.summary || ""

  base.experience = (obj.work || []).map((w: any) => ({
    id: uid("exp"),
    company: w.name || w.company || "",
    role: w.position || "",
    location: w.location || "",
    startDate: w.startDate || "",
    endDate: w.endDate || "",
    current: !w.endDate,
    bullets: toBullets(w.highlights, w.summary),
  }))

  base.education = (obj.education || []).map((e: any) => ({
    id: uid("edu"),
    school: e.institution || "",
    degree: e.studyType || "",
    field: e.area || "",
    location: "",
    startDate: e.startDate || "",
    endDate: e.endDate || "",
    details: e.score ? `GPA: ${e.score}` : "",
  }))

  base.skills = (obj.skills || []).map((s: any) => ({
    id: uid("sk"),
    category: s.name || "",
    items: Array.isArray(s.keywords) ? s.keywords : [],
  }))

  base.projects = (obj.projects || []).map((p: any) => ({
    id: uid("prj"),
    name: p.name || "",
    link: p.url || "",
    description: p.description || "",
    bullets: toBullets(p.highlights),
  }))

  const certs = [...(obj.certificates || []), ...(obj.awards || [])]
  base.certifications = certs.map((c: any) => ({
    id: uid("cert"),
    name: c.name || c.title || "",
    issuer: c.issuer || c.awarder || "",
    date: c.date || "",
  }))

  return base
}
