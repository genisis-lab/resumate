import type { ReactNode } from "react"

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/tos", label: "Terms" },
  { href: "/refund", label: "Refunds" },
]

export function LegalPage({
  title,
  description,
  summary,
  children,
}: {
  title: string
  description: string
  summary: ReactNode
  children: ReactNode
}) {
  return (
    <article className="page narrow legal-page">
      <a className="btn-ghost small legal-back" href="/">← Back home</a>
      <header className="legal-header">
        <p className="legal-kicker">ResuMate policies</p>
        <h1>{title}</h1>
        <p className="page-sub">{description}</p>
        <p className="legal-date">Effective and last updated August 27, 2026</p>
      </header>

      <aside className="legal-summary" aria-label="Policy summary">
        <strong>The short version</strong>
        <div>{summary}</div>
      </aside>

      <div className="legal-content">{children}</div>

      <nav className="legal-nav" aria-label="Legal policies">
        {LEGAL_LINKS.map((link) => (
          <a key={link.href} href={link.href}>{link.label}</a>
        ))}
      </nav>
    </article>
  )
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card legal-section">
      <h2 className="card-title">{title}</h2>
      {children}
    </section>
  )
}
