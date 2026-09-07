import type { Resume } from '../types/resume'

export function coachSource(resume: Resume): string {
  // Include dates and current-role status, omitted by the legacy ATS text helper.
  return JSON.stringify({ contact: { headline: resume.contact.headline }, summary: resume.summary, experience: resume.experience.map(({id, ...entry}) => entry), education: resume.education.map(({id, ...entry}) => entry), skills: resume.skills.map(({id, ...entry}) => entry), projects: resume.projects.map(({id, ...entry}) => entry), certifications: resume.certifications.map(({id, ...entry}) => entry) }, null, 2)
}
export interface WritingField { key: string; label: string; text: string; current?: boolean }
export function writingFields(r: Resume): WritingField[] {
  return [
    { key: 'summary', label: 'Summary', text: r.summary },
    ...r.experience.flatMap(e => e.bullets.map((text, i) => ({key: `experience:${e.id}:${i}`, label: `${e.role || 'Role'} at ${e.company || 'company'} · Bullet ${i + 1}`, text, current: e.current}))),
    ...r.projects.flatMap(p => [{key: `project:${p.id}:description`, label: `${p.name || 'Project'} · Description`, text: p.description}, ...p.bullets.map((text, i) => ({key: `project:${p.id}:${i}`, label: `${p.name || 'Project'} · Bullet ${i + 1}`, text}))]),
  ].filter(f => f.text.trim())
}
export function replaceWritingField(r: Resume, key: string, expected: string, next: string): Resume {
  if (writingFields(r).find(f => f.key === key)?.text !== expected) return r
  if (key === 'summary') return {...r, summary: next}
  const [kind, id, index] = key.split(':')
  if (kind === 'experience') return {...r, experience: r.experience.map(e => e.id === id ? {...e, bullets: e.bullets.map((b, i) => i === Number(index) ? next : b)} : e)}
  return {...r, projects: r.projects.map(p => p.id === id ? index === 'description' ? {...p, description: next} : {...p, bullets: p.bullets.map((b, i) => i === Number(index) ? next : b)} : p)}
}
export function consistencyIssues(r: Resume): string[] {
  const issues: string[] = []
  const seen = new Map<string, string>()
  for (const e of r.experience) {
    const label = `${e.role || 'Untitled role'} at ${e.company || 'company'}`
    const start = Date.parse(e.startDate), end = Date.parse(e.endDate)
    if (Number.isFinite(start) && Number.isFinite(end) && start > end) issues.push(`${label}: start date is later than end date.`)
    if (e.current && e.endDate.trim()) issues.push(`${label}: marked current but also has an end date. Check which is intended.`)
    for (const bullet of e.bullets) {
      const normalized = bullet.trim().toLowerCase().replace(/[.!]$/, '')
      if (!normalized) continue
      if (seen.has(normalized)) issues.push(`${label}: a bullet repeats text in ${seen.get(normalized)}. Check whether both entries need it.`)
      seen.set(normalized, label)
    }
  }
  return issues
}
