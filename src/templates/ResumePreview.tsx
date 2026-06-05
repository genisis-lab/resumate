import React from "react"
import { Resume, SectionKey, SECTION_LABELS } from "../types/resume"

function dateRange(start: string, end: string, current?: boolean) {
  const e = current ? "Present" : end
  if (start && e) return `${start} \u2013 ${e}`
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
  const re = new RegExp(`(${escaped.join("|")})`, "gi")
  return (text: string) => {
    if (!text) return text
    const parts = text.split(re)
    return parts.map((part, i) =>
      i % 2 === 1 ? (
        <mark className="hl" key={i}>{part}</mark>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      ),
    )
  }
}

function Contact({ r }: { r: Resume }) {
  const c = r.contact
  const links = [c.email, c.phone, c.location, c.website, c.linkedin, c.github].filter(Boolean)
  return (
    <header className="rp-header">
      <h1 className="rp-name">{c.fullName || "Your Name"}</h1>
      {c.headline && <p className="rp-headline">{c.headline}</p>}
      {links.length > 0 && (
        <p className="rp-contact">
          {links.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </p>
      )}
    </header>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rp-section">
      <h2 className="rp-section-title">{title}</h2>
      {children}
    </section>
  )
}

function renderSection(key: SectionKey, r: Resume, hl: HL) {
  switch (key) {
    case "summary":
      return r.summary ? (
        <Section key={key} title={SECTION_LABELS[key]}>
          <p className="rp-summary">{hl(r.summary)}</p>
        </Section>
      ) : null
    case "experience":
      return r.experience.length ? (
        <Section key={key} title={SECTION_LABELS[key]}>
          {r.experience.map((e) => (
            <div className="rp-entry" key={e.id}>
              <div className="rp-entry-head">
                <span className="rp-entry-title">
                  {e.role}
                  {e.company ? <span className="rp-at"> · {e.company}</span> : null}
                </span>
                <span className="rp-entry-date">{dateRange(e.startDate, e.endDate, e.current)}</span>
              </div>
              {e.location && <div className="rp-entry-meta">{e.location}</div>}
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
        <Section key={key} title={SECTION_LABELS[key]}>
          {r.education.map((e) => (
            <div className="rp-entry" key={e.id}>
              <div className="rp-entry-head">
                <span className="rp-entry-title">
                  {[e.degree, e.field].filter(Boolean).join(" ")}
                </span>
                <span className="rp-entry-date">{dateRange(e.startDate, e.endDate)}</span>
              </div>
              <div className="rp-entry-meta">
                {[e.school, e.location].filter(Boolean).join(" · ")}
              </div>
              {e.details && <p className="rp-detail">{e.details}</p>}
            </div>
          ))}
        </Section>
      ) : null
    case "skills":
      return r.skills.length ? (
        <Section key={key} title={SECTION_LABELS[key]}>
          <div className="rp-skills">
            {r.skills.map((g) => (
              <div className="rp-skill-row" key={g.id}>
                {g.category && <span className="rp-skill-cat">{g.category}:</span>}{" "}
                <span className="rp-skill-items">{hl(g.items.join(", "))}</span>
              </div>
            ))}
          </div>
        </Section>
      ) : null
    case "projects":
      return r.projects.length ? (
        <Section key={key} title={SECTION_LABELS[key]}>
          {r.projects.map((p) => (
            <div className="rp-entry" key={p.id}>
              <div className="rp-entry-head">
                <span className="rp-entry-title">{p.name}</span>
                {p.link && <span className="rp-entry-date">{p.link}</span>}
              </div>
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
        <Section key={key} title={SECTION_LABELS[key]}>
          {r.certifications.map((c) => (
            <div className="rp-cert" key={c.id}>
              <span className="rp-entry-title">{c.name}</span>
              <span className="rp-entry-meta">
                {[c.issuer, c.date].filter(Boolean).join(" · ")}
              </span>
            </div>
          ))}
        </Section>
      ) : null
    default:
      return null
  }
}

// Sections that live in the narrow sidebar for the two-column template.
const SIDEBAR_KEYS: SectionKey[] = ["skills", "education", "certifications"]

export function ResumePreview({
  resume,
  highlight,
}: {
  resume: Resume
  highlight?: string[]
}) {
  const { settings } = resume
  const order = settings.sectionOrder.filter((s) => !settings.hidden.includes(s))
  const hl = makeHighlighter(highlight)
  const density = settings.density || "cozy"
  const style = {
    ["--accent" as any]: settings.accent,
    ["--font-scale" as any]: String(settings.fontScale),
  } as React.CSSProperties
  const className = `resume-paper tpl-${settings.template} density-${density}`

  if (settings.template === "twocolumn") {
    const aside = order.filter((k) => SIDEBAR_KEYS.includes(k))
    const main = order.filter((k) => !SIDEBAR_KEYS.includes(k))
    return (
      <div id="resume-print-area" className={className} style={style}>
        <Contact r={resume} />
        <div className="rp-two">
          <aside className="rp-aside">{aside.map((key) => renderSection(key, resume, hl))}</aside>
          <div className="rp-main">{main.map((key) => renderSection(key, resume, hl))}</div>
        </div>
      </div>
    )
  }

  return (
    <div id="resume-print-area" className={className} style={style}>
      <Contact r={resume} />
      <div className="rp-body">{order.map((key) => renderSection(key, resume, hl))}</div>
    </div>
  )
}
