import React from "react"
import { Resume, SectionKey, SECTION_LABELS, TemplateId } from "../types/resume"
import "./fonts"
import "./templates.css"
import { paperSizeOf } from "../lib/fitPage"

function dateRange(start: string, end: string, current?: boolean) {
  const e = current ? "Present" : end
  if (start && e) return `${start} – ${e}`
  return start || e || ""
}

type HL = (text: string) => React.ReactNode

// Build a highlighter that wraps matched keywords in <mark>. Returns the text
// untouched when there are no terms (the common case outside the analyzer).
function makeHighlighter(terms?: string[]): HL {
  const list = (terms || []).map((t) => t.trim()).filter((t) => t.length > 1)
  if (!list.length) return (text: string) => text
  const escaped = list
    .sort((a, b) => b.length - a.length)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  const re = new RegExp(`(^|[^A-Za-z0-9+#])(${escaped.join("|")})(?=$|[^A-Za-z0-9+#])`, "gi")
  return (text: string) => {
    if (!text) return text
    const parts: React.ReactNode[] = []
    let cursor = 0
    let match: RegExpExecArray | null
    while ((match = re.exec(text))) {
      const start = match.index + match[1].length
      if (start > cursor) parts.push(<React.Fragment key={`text-${cursor}`}>{text.slice(cursor, start)}</React.Fragment>)
      parts.push(<mark className="hl" key={`mark-${start}`}>{match[2]}</mark>)
      cursor = start + match[2].length
    }
    if (cursor < text.length) parts.push(<React.Fragment key={`text-${cursor}`}>{text.slice(cursor)}</React.Fragment>)
    return parts
  }
}

// Templates whose layout differs structurally, not only stylistically.
const TWO_COLUMN_ASIDE: SectionKey[] = ["skills", "education", "certifications"]
const SIDEBAR_ASIDE: SectionKey[] = ["skills", "education", "certifications"]
const CHIP_SKILLS = new Set<TemplateId>(["bold", "sidebar"])
const SHORT_LABELS = new Set<TemplateId>(["professional", "swiss", "developer", "bold", "sidebar"])

function sectionLabel(key: SectionKey, template: TemplateId): string {
  if (SHORT_LABELS.has(template)) {
    if (key === "summary") return "Summary"
    if (key === "experience" && template !== "professional") return "Experience"
  }
  return SECTION_LABELS[key]
}

// Pick black or white text for content placed on the accent color.
export function readableInk(hex: string): string {
  const value = /^#[0-9a-f]{6}$/i.test(hex) ? parseInt(hex.slice(1), 16) : 0x2563eb
  const channel = (shift: number) => {
    const c = ((value >> shift) & 255) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const luminance = 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0)
  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.05 ? "#ffffff" : "#111827"
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return "YN"
  const first = parts[0][0] || ""
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ""
  return (first + last).toUpperCase()
}

function contactItems(r: Resume): { basics: string[]; links: string[] } {
  const c = r.contact
  if (r.settings.template === "professional") {
    return { basics: [c.headline, c.location, c.phone, c.email].filter(Boolean), links: [c.linkedin, c.github, c.website].filter(Boolean) }
  }
  return { basics: [c.email, c.phone, c.location].filter(Boolean), links: [c.website, c.linkedin, c.github].filter(Boolean) }
}

// Inline contact line. Long lines break between the basics and the links so
// separators never dangle at the end of a wrapped line.
function ContactLine({ r }: { r: Resume }) {
  const { basics, links } = contactItems(r)
  const all = [...basics, ...links]
  if (!all.length) return null
  const breakAfter = basics.length > 0 && links.length > 0 && all.join("   ").length > 84 ? basics.length - 1 : -1
  return (
    <p className="rp-contact">
      {all.map((item, i) => (
        <React.Fragment key={i}>
          <span className={i === all.length - 1 || i === breakAfter ? "rp-row-end" : undefined}>{item}</span>
          {i === breakAfter && <span className="rp-contact-break" aria-hidden="true" />}
        </React.Fragment>
      ))}
    </p>
  )
}

const CONTACT_LABELS: { key: keyof Resume["contact"]; label: string }[] = [
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "location", label: "Location" },
  { key: "website", label: "Website" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "github", label: "GitHub" },
]

function ContactList({ r }: { r: Resume }) {
  const rows = CONTACT_LABELS.filter(({ key }) => r.contact[key])
  if (!rows.length) return null
  return (
    <section className="rp-section rp-section-contact">
      <h2 className="rp-section-title">Contact</h2>
      <div className="rp-section-body">
        <dl className="rp-contact-list">
          {rows.map(({ key, label }) => (
            <div key={key}><dt>{label}</dt><dd>{r.contact[key]}</dd></div>
          ))}
        </dl>
      </div>
    </section>
  )
}

// The initials are drawn as an image rather than text so the PDF text layer
// starts with the candidate's real name ("Jordan Avery", not "JA Jordan Avery").
function MonogramBadge({ text, color }: { text: string; color: string }) {
  const [src, setSrc] = React.useState<string | null>(null)
  React.useEffect(() => {
    let cancelled = false
    async function draw() {
      try {
        await document.fonts?.load('600 120px "Playfair Display"')
      } catch {
        /* fall back to the next font in the stack */
      }
      const size = 304
      const canvas = document.createElement("canvas")
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext("2d")
      if (!ctx || cancelled) return
      ctx.fillStyle = color
      ctx.font = '600 118px "Playfair Display", Georgia, serif'
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(text, size / 2, size / 2 + 8)
      setSrc(canvas.toDataURL("image/png"))
    }
    void draw()
    return () => { cancelled = true }
  }, [text, color])
  return <span className="rp-monogram" aria-hidden="true">{src && <img src={src} alt="" />}</span>
}

function Header({ r, withContact = true }: { r: Resume; withContact?: boolean }) {
  const c = r.contact
  const template = r.settings.template
  return (
    <header className="rp-header">
      <div className="rp-identity">
        <h1 className="rp-name">{c.fullName || "Your Name"}</h1>
        {c.headline && template !== "professional" && <p className="rp-headline">{c.headline}</p>}
      </div>
      {template === "monogram" && <MonogramBadge text={initials(c.fullName)} color={/^#[0-9a-f]{6}$/i.test(r.settings.accent) ? r.settings.accent : "#2563eb"} />}
      {withContact && <ContactLine r={r} />}
    </header>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section className={`rp-section rp-section-${id}`}>
      <h2 className="rp-section-title">{title}</h2>
      <div className="rp-section-body">{children}</div>
    </section>
  )
}

function SkillItems({ items, template, hl }: { items: string[]; template: TemplateId; hl: HL }) {
  if (!CHIP_SKILLS.has(template)) {
    return <span className="rp-skill-items">{hl(items.join(template === "professional" ? " · " : ", "))}</span>
  }
  // Chips keep a real comma in the text layer so copied or parsed text stays separated.
  return (
    <span className="rp-chips">
      {items.map((item, i) => (
        <React.Fragment key={i}>
          <span className="rp-chip">{hl(item)}</span>
          {i < items.length - 1 && <span className="rp-chip-sep">, </span>}
        </React.Fragment>
      ))}
    </span>
  )
}

function renderSection(key: SectionKey, r: Resume, hl: HL) {
  const template = r.settings.template
  const professional = template === "professional"
  const title = sectionLabel(key, template)
  switch (key) {
    case "summary":
      return r.summary ? (
        <Section key={key} id={key} title={title}>
          <p className="rp-summary">{hl(r.summary)}</p>
        </Section>
      ) : null
    case "experience":
      return r.experience.length ? (
        <Section key={key} id={key} title={title}>
          {r.experience.map((e) => (
            <div className="rp-entry" key={e.id}>
              <div className="rp-entry-head">
                <span className="rp-entry-title">
                  {professional ? (e.company || e.role) : <>{e.role}{e.company ? <span className="rp-at"> · {e.company}</span> : null}</>}
                </span>
                <span className="rp-entry-date">{professional ? e.location : dateRange(e.startDate, e.endDate, e.current)}</span>
              </div>
              {professional ? <div className="rp-entry-head rp-entry-meta"><span>{e.role}</span><span>{dateRange(e.startDate, e.endDate, e.current)}</span></div> : e.location && <div className="rp-entry-meta">{e.location}</div>}
              {e.bullets.filter(Boolean).length > 0 && (
                <ul className="rp-bullets">
                  {e.bullets.filter(Boolean).map((b, i) => (
                    <li key={i}>{hl(b)}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </Section>
      ) : null
    case "education":
      return r.education.length ? (
        <Section key={key} id={key} title={title}>
          {r.education.map((e) => (
            <div className="rp-entry" key={e.id}>
              <div className="rp-entry-head">
                <span className="rp-entry-title">
                  {professional ? e.school : [e.degree, e.field].filter(Boolean).join(" ")}
                </span>
                <span className="rp-entry-date">{dateRange(e.startDate, e.endDate)}</span>
              </div>
              <div className="rp-entry-meta">
                {professional ? <>{[e.degree, e.field].filter(Boolean).join(" | ")}{e.location && <div>{e.location}</div>}</> : [e.school, e.location].filter(Boolean).join(" · ")}
              </div>
              {e.details && <p className="rp-detail">{e.details}</p>}
            </div>
          ))}
        </Section>
      ) : null
    case "skills":
      return r.skills.length ? (
        <Section key={key} id={key} title={title}>
          <div className="rp-skills">
            {r.skills.map((g) => (
              <div className="rp-skill-row" key={g.id}>
                {g.category && <span className="rp-skill-cat">{g.category}{CHIP_SKILLS.has(template) ? "" : ":"}</span>}{" "}
                <SkillItems items={g.items} template={template} hl={hl} />
              </div>
            ))}
          </div>
        </Section>
      ) : null
    case "projects":
      return r.projects.length ? (
        <Section key={key} id={key} title={title}>
          {r.projects.map((p) => (
            <div className="rp-entry" key={p.id}>
              <div className="rp-entry-head">
                <span className="rp-entry-title">{p.name}</span>
                {p.link && !professional && <span className="rp-entry-date rp-link">{p.link}</span>}
              </div>
              {p.link && professional && <div className="rp-project-link">{p.link}</div>}
              {p.description && <p className="rp-detail">{hl(p.description)}</p>}
              {p.bullets.filter(Boolean).length > 0 && (
                <ul className="rp-bullets">
                  {p.bullets.filter(Boolean).map((b, i) => (
                    <li key={i}>{hl(b)}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </Section>
      ) : null
    case "certifications":
      return r.certifications.length ? (
        <Section key={key} id={key} title={title}>
          {r.certifications.map((c) => (
            <div className="rp-cert" key={c.id}>
              <span><span className="rp-entry-title">{c.name}</span>{professional && c.issuer && <> | {c.issuer}</>}</span>
              <span className="rp-entry-meta">
                {professional ? c.date : [c.issuer, c.date].filter(Boolean).join(" · ")}
              </span>
            </div>
          ))}
        </Section>
      ) : null
    default:
      return null
  }
}

// Render free-form custom sections (Awards, Languages, etc.).
function renderCustom(r: Resume, hl: HL) {
  return (r.customSections || [])
    .filter((sec) => !sec.hidden && sec.items.length > 0)
    .map((sec) => (
      <Section key={sec.id} id="custom" title={sec.title || "Section"}>
        {sec.items.map((it) => (
          <div className="rp-entry" key={it.id}>
            <div className="rp-entry-head">
              <span className="rp-entry-title">{it.title}</span>
              {it.date && <span className="rp-entry-date">{it.date}</span>}
            </div>
            {it.subtitle && <div className="rp-entry-meta">{it.subtitle}</div>}
            {it.description && <p className="rp-detail">{hl(it.description)}</p>}
            {it.bullets.filter(Boolean).length > 0 && (
              <ul className="rp-bullets">
                {it.bullets.filter(Boolean).map((b, i) => (
                  <li key={i}>{hl(b)}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </Section>
    ))
}

export { paperSizeOf }

export function ResumePreview({
  resume,
  highlight,
  printTarget = false,
}: {
  resume: Resume
  highlight?: string[]
  /** Only the editor preview is exported, so only it carries the print id. */
  printTarget?: boolean
}) {
  const { settings } = resume
  const template = settings.template
  const order = settings.sectionOrder.filter((s) => !settings.hidden.includes(s))
  const hl = makeHighlighter(highlight)
  const density = settings.density || "cozy"
  const style = {
    ["--accent" as any]: settings.accent,
    ["--accent-ink" as any]: readableInk(settings.accent),
    ["--font-scale" as any]: String(settings.fontScale),
  } as React.CSSProperties
  const className = `resume-paper tpl-${template} density-${density} paper-${paperSizeOf(resume)}`
  const paperProps = { id: printTarget ? "resume-print-area" : undefined, className, style, "data-template": template }

  if (template === "twocolumn") {
    const aside = order.filter((k) => TWO_COLUMN_ASIDE.includes(k))
    const main = order.filter((k) => !TWO_COLUMN_ASIDE.includes(k))
    return (
      <div {...paperProps}>
        <div className="rp-sheet">
          <Header r={resume} />
          <div className="rp-two">
            <aside className="rp-aside">{aside.map((key) => renderSection(key, resume, hl))}</aside>
            <div className="rp-main">
              {main.map((key) => renderSection(key, resume, hl))}
              {renderCustom(resume, hl)}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (template === "sidebar") {
    const aside = order.filter((k) => SIDEBAR_ASIDE.includes(k))
    const main = order.filter((k) => !SIDEBAR_ASIDE.includes(k))
    return (
      <div {...paperProps}>
        <div className="rp-sheet">
          <Header r={resume} withContact={false} />
          <aside className="rp-side">
            <ContactList r={resume} />
            {aside.map((key) => renderSection(key, resume, hl))}
          </aside>
          <div className="rp-main">
            {main.map((key) => renderSection(key, resume, hl))}
            {renderCustom(resume, hl)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div {...paperProps}>
      <div className="rp-sheet">
        <Header r={resume} />
        <div className="rp-body">
          {order.map((key) => renderSection(key, resume, hl))}
          {renderCustom(resume, hl)}
        </div>
      </div>
    </div>
  )
}
