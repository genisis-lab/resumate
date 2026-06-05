import { Resume, SectionKey, SECTION_LABELS } from "../types/resume"
import { uid } from "../lib/id"
import {
  BulletEditor,
  Collapsible,
  TextArea,
  TextField,
} from "./fields"

type Setter = (updater: (r: Resume) => Resume) => void

export function EditorForm({
  resume,
  setResume,
}: {
  resume: Resume
  setResume: (r: Resume | ((prev: Resume) => Resume)) => void
}) {
  const update: Setter = (updater) => setResume((prev) => updater(prev))

  function moveArr<T>(arr: T[], i: number, dir: -1 | 1): T[] {
    const j = i + dir
    if (j < 0 || j >= arr.length) return arr
    const next = [...arr]
    ;[next[i], next[j]] = [next[j], next[i]]
    return next
  }

  const c = resume.contact

  return (
    <div className="editor">
      {/* Contact */}
      <div className="editor-section">
        <h3 className="editor-section-title">Contact</h3>
        <div className="grid-2">
          <TextField label="Full name" value={c.fullName} onChange={(v) => update((r) => ({ ...r, contact: { ...r.contact, fullName: v } }))} placeholder="Jordan Avery" />
          <TextField label="Headline / target role" value={c.headline} onChange={(v) => update((r) => ({ ...r, contact: { ...r.contact, headline: v } }))} placeholder="Senior Product Designer" />
          <TextField label="Email" type="email" value={c.email} onChange={(v) => update((r) => ({ ...r, contact: { ...r.contact, email: v } }))} placeholder="you@email.com" />
          <TextField label="Phone" value={c.phone} onChange={(v) => update((r) => ({ ...r, contact: { ...r.contact, phone: v } }))} placeholder="(123) 555-0100" />
          <TextField label="Location" value={c.location} onChange={(v) => update((r) => ({ ...r, contact: { ...r.contact, location: v } }))} placeholder="City, State" />
          <TextField label="Website / portfolio" value={c.website} onChange={(v) => update((r) => ({ ...r, contact: { ...r.contact, website: v } }))} placeholder="yoursite.com" />
          <TextField label="LinkedIn" value={c.linkedin} onChange={(v) => update((r) => ({ ...r, contact: { ...r.contact, linkedin: v } }))} placeholder="linkedin.com/in/you" />
          <TextField label="GitHub" value={c.github} onChange={(v) => update((r) => ({ ...r, contact: { ...r.contact, github: v } }))} placeholder="github.com/you" />
        </div>
      </div>

      {/* Summary */}
      <div className="editor-section">
        <h3 className="editor-section-title">{SECTION_LABELS.summary}</h3>
        <TextArea
          label="Summary"
          hint="2–3 sentences, tailored to the role"
          rows={4}
          value={resume.summary}
          onChange={(v) => update((r) => ({ ...r, summary: v }))}
          placeholder="Results-driven [role] with X years…"
        />
      </div>

      {/* Experience */}
      <div className="editor-section">
        <div className="editor-section-head">
          <h3 className="editor-section-title">{SECTION_LABELS.experience}</h3>
          <button className="btn-ghost small" onClick={() => update((r) => ({ ...r, experience: [...r.experience, { id: uid("exp"), company: "", role: "", location: "", startDate: "", endDate: "", current: false, bullets: [""] }] }))}>+ Add role</button>
        </div>
        {resume.experience.map((e, i) => (
          <Collapsible
            key={e.id}
            title={e.role || "New role"}
            subtitle={e.company}
            onRemove={() => update((r) => ({ ...r, experience: r.experience.filter((x) => x.id !== e.id) }))}
            onMoveUp={() => update((r) => ({ ...r, experience: moveArr(r.experience, i, -1) }))}
            onMoveDown={() => update((r) => ({ ...r, experience: moveArr(r.experience, i, 1) }))}
          >
            <div className="grid-2">
              <TextField label="Role / title" value={e.role} onChange={(v) => patchExp(update, e.id, { role: v })} />
              <TextField label="Company" value={e.company} onChange={(v) => patchExp(update, e.id, { company: v })} />
              <TextField label="Location" value={e.location} onChange={(v) => patchExp(update, e.id, { location: v })} />
              <div className="grid-2 tight">
                <TextField label="Start" value={e.startDate} onChange={(v) => patchExp(update, e.id, { startDate: v })} placeholder="Jan 2021" />
                <TextField label="End" value={e.endDate} onChange={(v) => patchExp(update, e.id, { endDate: v })} placeholder="2023" />
              </div>
            </div>
            <label className="checkbox">
              <input type="checkbox" checked={e.current} onChange={(ev) => patchExp(update, e.id, { current: ev.target.checked })} />
              I currently work here
            </label>
            <BulletEditor bullets={e.bullets} onChange={(b) => patchExp(update, e.id, { bullets: b })} />
          </Collapsible>
        ))}
      </div>

      {/* Education */}
      <div className="editor-section">
        <div className="editor-section-head">
          <h3 className="editor-section-title">{SECTION_LABELS.education}</h3>
          <button className="btn-ghost small" onClick={() => update((r) => ({ ...r, education: [...r.education, { id: uid("edu"), school: "", degree: "", field: "", location: "", startDate: "", endDate: "", details: "" }] }))}>+ Add education</button>
        </div>
        {resume.education.map((e, i) => (
          <Collapsible
            key={e.id}
            title={[e.degree, e.field].filter(Boolean).join(" ") || "New entry"}
            subtitle={e.school}
            onRemove={() => update((r) => ({ ...r, education: r.education.filter((x) => x.id !== e.id) }))}
            onMoveUp={() => update((r) => ({ ...r, education: moveArr(r.education, i, -1) }))}
            onMoveDown={() => update((r) => ({ ...r, education: moveArr(r.education, i, 1) }))}
          >
            <div className="grid-2">
              <TextField label="Degree" value={e.degree} onChange={(v) => patchEdu(update, e.id, { degree: v })} placeholder="B.S." />
              <TextField label="Field of study" value={e.field} onChange={(v) => patchEdu(update, e.id, { field: v })} placeholder="Computer Science" />
              <TextField label="School" value={e.school} onChange={(v) => patchEdu(update, e.id, { school: v })} />
              <TextField label="Location" value={e.location} onChange={(v) => patchEdu(update, e.id, { location: v })} />
              <TextField label="Start" value={e.startDate} onChange={(v) => patchEdu(update, e.id, { startDate: v })} />
              <TextField label="End" value={e.endDate} onChange={(v) => patchEdu(update, e.id, { endDate: v })} />
            </div>
            <TextArea label="Details (optional)" rows={2} value={e.details} onChange={(v) => patchEdu(update, e.id, { details: v })} placeholder="GPA, honors, relevant coursework…" />
          </Collapsible>
        ))}
      </div>

      {/* Skills */}
      <div className="editor-section">
        <div className="editor-section-head">
          <h3 className="editor-section-title">{SECTION_LABELS.skills}</h3>
          <button className="btn-ghost small" onClick={() => update((r) => ({ ...r, skills: [...r.skills, { id: uid("sk"), category: "", items: [] }] }))}>+ Add group</button>
        </div>
        {resume.skills.map((g, i) => (
          <Collapsible
            key={g.id}
            title={g.category || "Skill group"}
            subtitle={`${g.items.length} skills`}
            onRemove={() => update((r) => ({ ...r, skills: r.skills.filter((x) => x.id !== g.id) }))}
            onMoveUp={() => update((r) => ({ ...r, skills: moveArr(r.skills, i, -1) }))}
            onMoveDown={() => update((r) => ({ ...r, skills: moveArr(r.skills, i, 1) }))}
          >
            <TextField label="Category" value={g.category} onChange={(v) => patchSkill(update, g.id, { category: v })} placeholder="Languages, Tools, etc." />
            <TextArea label="Skills" hint="comma-separated" rows={2} value={g.items.join(", ")} onChange={(v) => patchSkill(update, g.id, { items: v.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="React, TypeScript, Figma…" />
          </Collapsible>
        ))}
      </div>

      {/* Projects */}
      <div className="editor-section">
        <div className="editor-section-head">
          <h3 className="editor-section-title">{SECTION_LABELS.projects}</h3>
          <button className="btn-ghost small" onClick={() => update((r) => ({ ...r, projects: [...r.projects, { id: uid("prj"), name: "", link: "", description: "", bullets: [] }] }))}>+ Add project</button>
        </div>
        {resume.projects.map((p, i) => (
          <Collapsible
            key={p.id}
            title={p.name || "New project"}
            onRemove={() => update((r) => ({ ...r, projects: r.projects.filter((x) => x.id !== p.id) }))}
            onMoveUp={() => update((r) => ({ ...r, projects: moveArr(r.projects, i, -1) }))}
            onMoveDown={() => update((r) => ({ ...r, projects: moveArr(r.projects, i, 1) }))}
          >
            <div className="grid-2">
              <TextField label="Name" value={p.name} onChange={(v) => patchProj(update, p.id, { name: v })} />
              <TextField label="Link" value={p.link} onChange={(v) => patchProj(update, p.id, { link: v })} placeholder="github.com/…" />
            </div>
            <TextArea label="Description" rows={2} value={p.description} onChange={(v) => patchProj(update, p.id, { description: v })} />
            <BulletEditor bullets={p.bullets} onChange={(b) => patchProj(update, p.id, { bullets: b })} />
          </Collapsible>
        ))}
      </div>

      {/* Certifications */}
      <div className="editor-section">
        <div className="editor-section-head">
          <h3 className="editor-section-title">{SECTION_LABELS.certifications}</h3>
          <button className="btn-ghost small" onClick={() => update((r) => ({ ...r, certifications: [...r.certifications, { id: uid("cert"), name: "", issuer: "", date: "" }] }))}>+ Add certification</button>
        </div>
        {resume.certifications.map((cert, i) => (
          <Collapsible
            key={cert.id}
            title={cert.name || "New certification"}
            subtitle={cert.issuer}
            onRemove={() => update((r) => ({ ...r, certifications: r.certifications.filter((x) => x.id !== cert.id) }))}
            onMoveUp={() => update((r) => ({ ...r, certifications: moveArr(r.certifications, i, -1) }))}
            onMoveDown={() => update((r) => ({ ...r, certifications: moveArr(r.certifications, i, 1) }))}
          >
            <div className="grid-2">
              <TextField label="Name" value={cert.name} onChange={(v) => patchCert(update, cert.id, { name: v })} />
              <TextField label="Issuer" value={cert.issuer} onChange={(v) => patchCert(update, cert.id, { issuer: v })} />
              <TextField label="Date" value={cert.date} onChange={(v) => patchCert(update, cert.id, { date: v })} />
            </div>
          </Collapsible>
        ))}
      </div>

      {/* Section visibility */}
      <div className="editor-section">
        <h3 className="editor-section-title">Sections shown</h3>
        <div className="toggle-list">
          {(Object.keys(SECTION_LABELS) as SectionKey[]).map((key) => (
            <label className="checkbox" key={key}>
              <input
                type="checkbox"
                checked={!resume.settings.hidden.includes(key)}
                onChange={(ev) =>
                  update((r) => ({
                    ...r,
                    settings: {
                      ...r.settings,
                      hidden: ev.target.checked
                        ? r.settings.hidden.filter((s) => s !== key)
                        : [...r.settings.hidden, key],
                    },
                  }))
                }
              />
              {SECTION_LABELS[key]}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---- patch helpers ----
function patchExp(update: Setter, id: string, patch: Partial<Resume["experience"][number]>) {
  update((r) => ({ ...r, experience: r.experience.map((e) => (e.id === id ? { ...e, ...patch } : e)) }))
}
function patchEdu(update: Setter, id: string, patch: Partial<Resume["education"][number]>) {
  update((r) => ({ ...r, education: r.education.map((e) => (e.id === id ? { ...e, ...patch } : e)) }))
}
function patchSkill(update: Setter, id: string, patch: Partial<Resume["skills"][number]>) {
  update((r) => ({ ...r, skills: r.skills.map((e) => (e.id === id ? { ...e, ...patch } : e)) }))
}
function patchProj(update: Setter, id: string, patch: Partial<Resume["projects"][number]>) {
  update((r) => ({ ...r, projects: r.projects.map((e) => (e.id === id ? { ...e, ...patch } : e)) }))
}
function patchCert(update: Setter, id: string, patch: Partial<Resume["certifications"][number]>) {
  update((r) => ({ ...r, certifications: r.certifications.map((e) => (e.id === id ? { ...e, ...patch } : e)) }))
}
