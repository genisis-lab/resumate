import { useEffect, useState } from "react"
import { BILLING_STATE, beginUpgrade, type PlanId } from "../lib/billing"
import { navigate } from "../router"

const PLANS = [
  {
    id: "free" as PlanId,
    name: "Free",
    price: "$0",
    cadence: "forever",
    description: "Build one strong resume and see where it needs work.",
    features: ["1 active resume", "3 ATS-safe templates", "3 PDF or Word exports each month", "5 local ATS checks each month", "Browser storage and manual backup"],
    action: "Create free account",
    onClick: () => navigate("/signup"),
  },
  {
    id: "sprint" as PlanId,
    name: "Career Sprint",
    price: "$15",
    cadence: "30 days · no renewal",
    description: "A focused toolkit for an active application cycle.",
    features: [
      "5 job-specific resume versions",
      "Expanded local ATS checks",
      "40 hosted AI actions during the 30-day pass",
      "All templates and unlimited PDF/Word exports",
      "Interview tools and 30-day cloud sync when available",
    ],
    action: "Get launch notice",
    href: "mailto:support@builtwai.com?subject=ResuMate%20Career%20Sprint%20launch",
    featured: true,
  },
  {
    id: "pro" as PlanId,
    name: "Pro",
    price: "$24",
    cadence: "per month",
    description: "The complete workspace for a longer or multi-role search.",
    features: [
      "Unlimited resumes, jobs, and applications",
      "Hosted parser testing when available",
      "150 hosted AI actions each month",
      "Version history and multi-device sync when available",
      "Priority support and 25 active share links",
    ],
    action: "Get launch notice",
    href: "mailto:support@builtwai.com?subject=ResuMate%20Pro%20launch",
  },
]

const COMPARISON = [
  { feature: "Active resumes", free: "1", sprint: "5 versions", pro: "Unlimited" },
  { feature: "Templates", free: "3 ATS-safe", sprint: "All 9", pro: "All 9" },
  { feature: "PDF or Word exports", free: "3 / month", sprint: "Unlimited", pro: "Unlimited" },
  { feature: "Local ATS checks", free: "5 / month", sprint: "Expanded", pro: "Expanded" },
  { feature: "Hosted AI actions", free: "—", sprint: "40 at launch", pro: "150 / month at launch" },
  { feature: "Cloud sync", free: "—", sprint: "30 days planned", pro: "Planned" },
  { feature: "Version history", free: "Current", sprint: "30 days planned", pro: "1 year planned" },
]

const FAQS = [
  {
    question: "Is ResuMate still free?",
    answer: "Yes. The planned free tier includes one resume, three ATS-safe templates, five local ATS checks each month, and three PDF or Word exports each month. During this billing preview, current editor capabilities remain available.",
  },
  {
    question: "Is hosted ATS parsing live?",
    answer: "No. ResuMate currently offers an on-device structure and keyword check. Hosted file parsing is a planned paid feature and will not be described as available until production testing is complete.",
  },
  {
    question: "Does Career Sprint renew automatically?",
    answer: "The intended offer is a one-time 30-day pass with no renewal. Checkout is not active yet, so no purchase or charge can occur today.",
  },
  {
    question: "Can I cancel Pro anytime?",
    answer: "That is the intended policy. Pro is not for sale yet; final renewal and cancellation terms will be shown before any checkout is activated.",
  },
  {
    question: "What counts as an AI action?",
    answer: "One hosted request uses one action at launch, whether it is a match report, bullet rewrite, tailored summary, proofreading pass, cover letter, or interview pack. ResuMate will disclose any future change before you run a request.",
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
  const [checkoutPlan, setCheckoutPlan] = useState<PlanId | null>(null)
  const [checkoutError, setCheckoutError] = useState("")
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

  async function upgrade(plan: "sprint" | "pro") {
    setCheckoutError("")
    setCheckoutPlan(plan)
    try {
      await beginUpgrade(plan)
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Checkout is temporarily unavailable.")
      setCheckoutPlan(null)
    }
  }

  return (
    <div className="pricing-page">
      <header className="pricing-hero">
        <a className="btn-ghost small pricing-back" href="/">← Back home</a>
        <span className="pricing-status">Planned launch pricing</span>
        <h1>Pay for the search,<br />not another forever subscription.</h1>
        <p>
          Create a free account today. Career Sprint and Pro show the intended software limits so
          you can evaluate the upgrade path before checkout is activated.
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
            {plan.id !== "free" && BILLING_STATE.checkoutEnabled ? (
              <button className={plan.featured ? "btn-primary pricing-action" : "btn-ghost pricing-action"} disabled={checkoutPlan !== null} type="button" onClick={() => void upgrade(plan.id === "sprint" ? "sprint" : "pro")}>
                {checkoutPlan === plan.id ? "Opening secure checkout…" : plan.id === "sprint" ? "Start Career Sprint" : "Upgrade to Pro"}
              </button>
            ) : plan.href ? (
              <a className={plan.featured ? "btn-primary pricing-action" : "btn-ghost pricing-action"} href={plan.href}>{plan.action}</a>
            ) : (
              <button className="btn-ghost pricing-action" type="button" onClick={plan.onClick}>{plan.action}</button>
            )}
          </article>
        ))}
      </section>

      {checkoutError && <p className="pricing-honesty error" role="alert">{checkoutError}</p>}

      <p className="pricing-honesty">
        Paid accounts and checkout are not live. These are target launch prices and limits, not an
        offer to purchase. Current editor access is unchanged during this preview.
      </p>

      <section className="pricing-section" id="compare">
        <div className="pricing-section-head">
          <span>Planned plan details</span>
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
          <span className="pricing-status">Upcoming capability</span>
          <h2>Test the exported file, not only the editor text.</h2>
          <p>
            Hosted file parsing is in development. When it is production ready, it will test the
            exact PDF or Word file you plan to submit and show the extracted text order. The local
            keyword and structure check is the only ATS analysis promised today.
          </p>
        </div>
        <div className="parse-receipt" aria-label="Example ATS parse result">
          <div><span>Contact details</span><strong className="parse-good">Read correctly</strong></div>
          <div><span>Employment history</span><strong className="parse-good">4 of 4 roles</strong></div>
          <div><span>Skills section</span><strong className="parse-warn">Wrong position</strong></div>
          <div><span>Document order</span><strong className="parse-warn">1 issue found</strong></div>
          <p>Illustrative future output · not a live result or an employer score</p>
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
        <button className="btn-primary large" type="button" onClick={() => navigate("/signup")}>Create a free account</button>
        <p>No card required. Checkout is not active.</p>
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
