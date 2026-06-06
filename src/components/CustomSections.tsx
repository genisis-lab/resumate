import { Resume, CustomSection, CustomEntry } from "../types/resume"
import { uid } from "../lib/id"
import { Collapsible, TextField, TextArea, BulletEditor } from "./fields"

type SetResume = (r: Resume | ((prev: Resume) => Resume)) => void

function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir
  if (j < 0 || j >= arr.length) return arr
  const next = [...arr]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

// Editor for free-form sections (Awards, Languages, Volunteering, etc.).
// Reordering uses arrow buttons so it never interferes with text selection.
export function CustomSectionsEditor({
  resume,
  setResume,
}: {
  resume: Resume
  setResume: SetResume
}) {
  const sections = resume.customSections || []
  const update = (updater: (s: CustomSection[]) => CustomSection[]) =>
    setResume((r) => ({ ...r, customSections: updater(r.customSections || []) }))

  const addSection = () =>
    update((s) => [...s, { id: uid("cs"), title: "New Section", items: [] }])

  const patchSection = (id: string, patch: Partial<CustomSection>) =>
    update((s) => s.map((sec) => (sec.id === id ? { ...sec, ...patch } : sec)))

  const addEntry = (id: string) =>
    update((s) =>
      s.map((sec) =>
        sec.id === id
          ? {
              ...sec,
              items: [
                ...sec.items,
                { id: uid("ci"), title: "", subtitle: "", date: "", description: "", bullets: [] },
              ],
            }
          : sec,
      ),
    )

  const patchEntry = (sid: string, eid: string, patch: Partial<CustomEntry>) =>
    update((s) =>
      s.map((sec) =>
        sec.id === sid
          ? { ...sec, items: sec.items.map((it) => (it.id === eid ? { ...it, ...patch } : it)) }
          : sec,
      ),
    )

  const removeEntry = (sid: string, eid: string) =>
    update((s) =>
      s.map((sec) => (sec.id === sid ? { ...sec, items: sec.items.filter((it) => it.id !== eid) } : sec)),
    )

  const moveEntry = (sid: string, ii: number, dir: -1 | 1) =>
    update((s) => s.map((sec) => (sec.id === sid ? { ...sec, items: move(sec.items, ii, dir) } : sec)))

  return (
    <div className="editor-section">
      <div className="editor-section-head">
        <h3 className="editor-section-title">Custom Sections</h3>
        <button className="btn-ghost small" onClick={addSection}>+ Add section</button>
      </div>
      <p className="hint">
        Add anything extra — Awards, Languages, Volunteering, Publications, and more. These render after the built-in sections.
      </p>
      {sections.length === 0 && <p className="hint">No custom sections yet.</p>}
      {sections.map((sec, si) => (
        <div className="cs-block" key={sec.id}>
          <div className="cs-block-head">
            <input
              className="field-input cs-title"
              value={sec.title}
              placeholder="Section title (e.g. Languages)"
              onChange={(e) => patchSection(sec.id, { title: e.target.value })}
              aria-label="Section title"
            />
            <div className="cs-block-actions">
              <button type="button" title="Move up" aria-label="Move section up" onClick={() => update((s) => move(s, si, -1))}>↑</button>
              <button type="button" title="Move down" aria-label="Move section down" onClick={() => update((s) => move(s, si, 1))}>↓</button>
              <label className="checkbox tiny" title="Show or hide this section">
                <input
                  type="checkbox"
                  checked={!sec.hidden}
                  onChange={(e) => patchSection(sec.id, { hidden: !e.target.checked })}
                />
                Show
              </label>
              <button type="button" className="danger" title="Remove section" aria-label="Remove section" onClick={() => update((s) => s.filter((x) => x.id !== sec.id))}>✕</button>
            </div>
          </div>
          {sec.items.map((it, ii) => (
            <Collapsible
              key={it.id}
              title={it.title || "New entry"}
              subtitle={it.subtitle}
              onRemove={() => removeEntry(sec.id, it.id)}
              onMoveUp={() => moveEntry(sec.id, ii, -1)}
              onMoveDown={() => moveEntry(sec.id, ii, 1)}
            >
              <div className="grid-2">
                <TextField label="Title" value={it.title} onChange={(v) => patchEntry(sec.id, it.id, { title: v })} placeholder="Award / language / role" />
                <TextField label="Subtitle" value={it.subtitle} onChange={(v) => patchEntry(sec.id, it.id, { subtitle: v })} placeholder="Issuer / level / org" />
                <TextField label="Date" value={it.date} onChange={(v) => patchEntry(sec.id, it.id, { date: v })} placeholder="2024" />
              </div>
              <TextArea label="Description (optional)" rows={2} value={it.description} onChange={(v) => patchEntry(sec.id, it.id, { description: v })} />
              <BulletEditor bullets={it.bullets} onChange={(b) => patchEntry(sec.id, it.id, { bullets: b })} />
            </Collapsible>
          ))}
          <button className="btn-ghost small" onClick={() => addEntry(sec.id)}>+ Add entry</button>
        </div>
      ))}
    </div>
  )
}
