import { navigate } from "../router"

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  { title: "Product", links: [
    { label: "Resume builder", href: "/builder" },
    { label: "ATS checker", href: "/analyze" },
    { label: "Templates", href: "/templates" },
    { label: "Pricing", href: "/pricing" },
  ] },
  { title: "AI tools", links: [
    { label: "AI resume coach", href: "/coach" },
    { label: "Cover letter writer", href: "/cover" },
    { label: "Interview prep", href: "/interview" },
    { label: "LinkedIn optimizer", href: "/linkedin" },
  ] },
  { title: "Company", links: [
    { label: "Support", href: "mailto:support@builtwai.com" },
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/tos" },
    { label: "Refunds", href: "/refund" },
  ] },
]

function go(event: React.MouseEvent<HTMLAnchorElement>, href: string) {
  if (!href.startsWith("/") || event.metaKey || event.ctrlKey || event.shiftKey) return
  event.preventDefault()
  navigate(href)
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-top">
        <div className="site-footer-brand">
          <strong>ResuMate</strong>
          <p>The private resume builder that tailors your resume to every job and checks it before you apply.</p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <span>{column.title}</span>
            {column.links.map((link) => <a key={link.label} href={link.href} onClick={(event) => go(event, link.href)}>{link.label}</a>)}
          </nav>
        ))}
      </div>
      <div className="site-footer-bottom">
        <span>© {new Date().getFullYear()} ResuMate by Built WAI.</span>
        <span><a href="/tos" onClick={(event) => go(event, "/tos")}>Terms</a><a href="/privacy" onClick={(event) => go(event, "/privacy")}>Privacy</a></span>
      </div>
    </footer>
  )
}
