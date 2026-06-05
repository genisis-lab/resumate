import { Resume, SectionKey, SECTION_LABELS } from "../types/resume"

function dateRange(start: string, end: string, current?: boolean) {
  const e = current ? "Present" : end
  if (start && e) return `${start} \u2013 ${e}`
  return start || e || ""
}

function Contact({ r }: { r: Resume }) {
  const c = r.contact
  const links = [
    c.email,
    c.phone,
    c.location,
    c.website,
    c.linkedin,
    c.github,
  ].filter(Boolean)
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

function renderSection(key: SectionKey, r: Resume) {
  switch (key) {
    case "summary":
      return r.summary ? (
        <Section key={key} title={SECTION_LABELS[key]}>
          <p className="rp-summary">{r.summary}</p>
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
                    <li key={i}>{b}</li>
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
                <span className="rp-skill-items">{g.items.join(", ")}</span>
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
              {p.description && <p className="rp-detail">{p.description}</p>}
              {p.bullets.filter(Boolean).length > 0 && (
                <ul className="rp-bullets">
                  {p.bullets.filter(Boolean).map((b, i) => (
                    <li key={i}>{b}</li>
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

export function ResumePreview({ resume }: { resume: Resume }) {
  const { settings } = resume
  const order = settings.sectionOrder.filter((s) => !settings.hidden.includes(s))
  const style = {
    ["--accent" as any]: settings.accent,
    ["--font-scale" as any]: String(settings.fontScale),
  } as React.CSSProperties
  return (
    <div
      id="resume-print-area"
      className={`resume-paper tpl-${settings.template}`}
      style={style}
    >
      <Contact r={resume} />
      <div className="rp-body">{order.map((key) => renderSection(key, resume))}</div>
    </div>
  )
}
