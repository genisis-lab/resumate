import { useEffect } from "react"
import { navigate } from "../router"

const PLANS = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    description: "Build one strong resume and see where it needs work.",
    features: [
      "1 active resume and ATS-safe template",
      "3 PDF exports, plus plain-text export",
      "3 basic local ATS scans each month",
      "Top keywords and 3 improvement tips",
      "1 saved job and 1 share link",
    ],
    action: "Start free",
    onClick: () => navigate("/builder"),
  },
  {
    name: "Career Sprint",
    price: "$15",
    cadence: "30 days · no renewal",
    description: "A focused toolkit for an active application cycle.",
    features: [
      "5 job-specific resume versions",
      "10 Live ATS Parse Tests",
      "40 AI writing and tailoring actions",
      "All templates and unlimited PDF/Word exports",
      "Application kits, interview prep, and cloud backup",
    ],
    action: "Get launch notice",
    href: "mailto:support@builtwai.com?subject=ResuMate%20Career%20Sprint%20launch",
    featured: true,
  },
  {
    name: "Pro",
    price: "$24",
    cadence: "per month",
    description: "The complete workspace for a longer or multi-role search.",
    features: [
      "Unlimited resumes, jobs, and applications",
      "25 Live ATS Parse Tests each month",
      "150 AI actions each month",
      "1-year version history and 5-device sync",
      "Priority support and 25 active share links",
    ],
    action: "Get launch notice",
    href: "mailto:support@builtwai.com?subject=ResuMate%20Pro%20launch",
  },
]

const COMPARISON = [
  { feature: "Active resumes", free: "1", sprint: "5 versions", pro: "Unlimited" },
  { feature: "Templates", free: "1 ATS-safe", sprint: "All", pro: "All" },
  { feature: "PDF exports", free: "3 lifetime", sprint: "Unlimited", pro: "Unlimited" },
  { feature: "Word exports", free: "—", sprint: "Unlimited", pro: "Unlimited" },
  { feature: "Local ATS scans", free: "3 / month", sprint: "Unlimited", pro: "Unlimited" },
  { feature: "Live ATS Parse Tests", free: "—", sprint: "10", pro: "25 / month" },
  { feature: "AI actions", free: "—", sprint: "40", pro: "150 / month" },
  { feature: "Cloud backup", free: "—", sprint: "30 days", pro: "Included" },
  { feature: "Version history", free: "Current", sprint: "30 days", pro: "1 year" },
  { feature: "Tracked applications", free: "5", sprint: "50", pro: "Unlimited" },
]

const FAQS = [
  {
    question: "Is ResuMate still free?",
    answer: "Yes. The free plan will continue to include the core editor, one resume, a basic local ATS check, and limited exports. Paid plans are not live yet.",
  },
  {
    question: "What is a Live ATS Parse Test?",
    answer: "It tests the PDF or Word file you plan to submit with an online recruiting-style parser, then shows what contact details, roles, dates, skills, and sections it could actually read. It is not a promise of how every employer's private ATS will rank you.",
  },
  {
    question: "Does Career Sprint renew automatically?",
    answer: "No. Career Sprint is a one-time 30-day pass. It ends without another charge.",
  },
  {
    question: "Can I cancel Pro anytime?",
    answer: "Yes. Cancellation stops the next renewal, and access normally continues through the current paid period.",
  },
  {
    question: "What counts as an AI action?",
    answer: "A focused request such as a match report, bullet rewrite, tailored summary, or proofreading pass generally uses one action. Larger outputs such as a cover letter, interview pack, full tailoring pass, or application kit may use more. The exact cost will be shown before you run it.",
  },
  {
    question: "What happens when I reach a limit?",
    answer: "ResuMate will show the remaining allowance before a paid action. You can wait for a monthly reset, move to a higher plan, or purchase a clearly priced add-on when available. We will not charge an overage automatically.",
  },
  {
    question: "What is the refund policy?",
    answer: "When payments launch, first purchases will have a 14-day refund window and subscription renewals a 7-day window, subject to stronger rights under local law.",
  },
  {
    question: "Is my resume used to train AI models?",
    answer: "ResuMate sends only the text needed for an online AI request you initiate. Provider data handling will be disclosed before launch; ordinary editing and local ATS checks remain in your browser.",
  },
]

export function Pricing() {
  useEffect(() => {
    const script = document.createElement("script")
    script.id = "pricing-faq-schema"
    script.type = "application/ld+json"
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    })
    document.head.appendChild(script)
    return () => script.remove()
  }, [])

  return (
    <div className="pricing-page">
      <header className="pricing-hero">
        <a className="btn-ghost small pricing-back" href="/">← Back home</a>
        <span className="pricing-status">Planned launch pricing</span>
        <h1>Pay for the search,<br />not another forever subscription.</h1>
        <p>
          Start free. Choose a 30-day Career Sprint when applications get serious, or use Pro for a
          longer job search with more live parsing, tailoring, and history.
        </p>
        <a className="pricing-jump" href="#compare">Compare every limit ↓</a>
      </header>

      <section className="pricing-grid" aria-label="ResuMate plans">
        {PLANS.map((plan) => (
          <article className={`pricing-card${plan.featured ? " featured" : ""}`} key={plan.name}>
            {plan.featured && <span className="pricing-fit">Best for an active search</span>}
            <h2>{plan.name}</h2>
            <div className="price-line">
              <strong>{plan.price}</strong>
              <span>{plan.cadence}</span>
            </div>
            <p className="plan-description">{plan.description}</p>
            <ul>
              {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
            {plan.href ? (
              <a className={plan.featured ? "btn-primary pricing-action" : "btn-ghost pricing-action"} href={plan.href}>{plan.action}</a>
            ) : (
              <button className="btn-ghost pricing-action" type="button" onClick={plan.onClick}>{plan.action}</button>
            )}
          </article>
        ))}
      </section>

      <p className="pricing-honesty">
        Paid accounts and billing are not live yet. These are planned launch prices and limits, shown
        early so there are no surprise paywalls later.
      </p>

      <section className="pricing-section" id="compare">
        <div className="pricing-section-head">
          <span>Plan details</span>
          <h2>Know exactly what changes.</h2>
        </div>
        <div className="comparison" role="table" aria-label="Plan comparison">
          <div className="comparison-row comparison-head" role="row">
            <span role="columnheader">Feature</span>
            <span role="columnheader">Free</span>
            <span role="columnheader">Sprint</span>
            <span role="columnheader">Pro</span>
          </div>
          {COMPARISON.map((row) => (
            <div className="comparison-row" role="row" key={row.feature}>
              <strong role="rowheader">{row.feature}</strong>
              <span role="cell" data-label="Free">{row.free}</span>
              <span role="cell" data-label="Sprint">{row.sprint}</span>
              <span role="cell" data-label="Pro">{row.pro}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="ats-lab">
        <div>
          <span className="pricing-status">Premium centerpiece</span>
          <h2>See what recruiting software can actually read.</h2>
          <p>
            A Live ATS Parse Test sends the exact file you plan to apply with to an online
            recruiting-style parser. ResuMate then checks whether it recognized your name, roles,
            dates, skills, sections, and text order—and shows the extracted recruiter view.
          </p>
        </div>
        <div className="parse-receipt" aria-label="Example ATS parse result">
          <div><span>Contact details</span><strong className="parse-good">Read correctly</strong></div>
          <div><span>Employment history</span><strong className="parse-good">4 of 4 roles</strong></div>
          <div><span>Skills section</span><strong className="parse-warn">Wrong position</strong></div>
          <div><span>Document order</span><strong className="parse-warn">1 issue found</strong></div>
          <p>Example result · never presented as an employer's private score</p>
        </div>
      </section>

      <section className="pricing-section">
        <div className="pricing-section-head">
          <span>Questions, answered</span>
          <h2>No fine-print scavenger hunt.</h2>
        </div>
        <div className="pricing-faq">
          {FAQS.map((faq) => (
            <details key={faq.question}>
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="pricing-final">
        <h2>Build the resume first.<br />Upgrade when the search demands it.</h2>
        <button className="btn-primary large" type="button" onClick={() => navigate("/builder")}>Start free →</button>
        <p>Editing stays in your browser. No card required.</p>
      </section>

      <footer className="landing-footer">
        <nav className="footer-links" aria-label="Legal">
          <a className="footer-link" href="/privacy">Privacy</a>
          <a className="footer-link" href="/tos">Terms</a>
          <a className="footer-link" href="/refund">Refunds</a>
        </nav>
      </footer>
    </div>
  )
}
