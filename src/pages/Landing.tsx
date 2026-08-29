import { useEffect, useRef, useState } from "react"

const FAQS = [
  {
    question: "Is ResuMate a resume writing service?",
    answer: "No. ResuMate is self serve software. You enter and control your own details, choose a template, review automated checks, and export the file yourself.",
  },
  {
    question: "Does the ATS check guarantee interviews?",
    answer: "No. The local check reviews structure and keyword alignment against a job description. It cannot predict an employer's private system or hiring decision.",
  },
  {
    question: "Which AI features are available?",
    answer: "Local job matching is available on the free plan. Career Sprint and Pro include hosted AI actions for tailored summaries, bullet rewrites, cover letters, interview questions, and other guided writing tools.",
  },
  {
    question: "Where are my resumes stored?",
    answer: "Ordinary editing and saves stay in this browser. Creating an account does not upload an existing browser resume. Cloud sync is not presented as active until it is ready.",
  },
  {
    question: "Can I export without paying or signing in?",
    answer: "Yes. You can start in the editor without an account. The free allowance includes three PDF or Word exports and five local ATS checks each month.",
  },
  {
    question: "Does ResuMate work on a phone?",
    answer: "Yes. The editor, preview controls, job match, template picker, and export flow adapt for phones and tablets.",
  },
]

const TAGLINE_WORDS = "Your experience is real. Your resume should make it easy to see.".split(" ")

function TaglineReveal() {
  const sectionRef = useRef<HTMLElement>(null)
  const [visibleWords, setVisibleWords] = useState(0)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduceMotion || !("IntersectionObserver" in window)) {
      setVisibleWords(TAGLINE_WORDS.length)
      return
    }

    let timer = 0
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      let next = 0
      const revealNext = () => {
        next += 1
        setVisibleWords(next)
        if (next < TAGLINE_WORDS.length) timer = window.setTimeout(revealNext, 75)
      }
      revealNext()
    }, { threshold: 0.35 })
    observer.observe(section)
    return () => {
      observer.disconnect()
      window.clearTimeout(timer)
    }
  }, [])

  return (
    <section className="home-tagline" ref={sectionRef} aria-label="ResuMate promise">
      <p>
        {TAGLINE_WORDS.map((word, index) => (
          <span className={index < visibleWords ? "is-active" : ""} key={`${word}-${index}`}>{word} </span>
        ))}
      </p>
    </section>
  )
}

export function Landing({ onStartBlank, onStartSample, onCreateAccount }: { onStartBlank: () => void; onStartSample: () => void; onCreateAccount: () => void }) {
  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>(".home-page [data-reveal]"))
    if (!items.length) return
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach((item) => item.classList.add("is-visible"))
      return
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add("is-visible")
        observer.unobserve(entry.target)
      })
    }, { rootMargin: "0px 0px -10%", threshold: 0.12 })
    items.forEach((item) => observer.observe(item))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <span className="home-eyebrow">Resume building without the guesswork</span>
          <h1 id="home-title">Turn your experience into a resume people can scan quickly.</h1>
          <p className="home-hero-sub">
            Build in a structured editor, compare your resume with a real job description, and export a clean PDF or Word file. Start free without creating an account.
          </p>
          <div className="home-hero-actions">
            <button className="btn-primary home-primary-action" onClick={onStartBlank}>Build my resume free</button>
            <a className="home-text-link" href="/pricing">See pricing and limits</a>
          </div>
          <p className="home-risk-note">No card required. Your first resume stays in this browser.</p>
          <div className="home-plan-proof" aria-label="Plan prices">
            <span><strong>$0</strong> Free</span>
            <span><strong>$15</strong> Career Sprint</span>
            <span><strong>$24</strong> Pro monthly</span>
          </div>
        </div>

        <div className="home-hero-visual is-visible" data-reveal>
          <figure className="home-product-demo">
            <figcaption className="home-demo-bar">
              <span>Product marketing resume</span>
              <span className="home-demo-status">Saved locally</span>
            </figcaption>
            <div className="home-demo-body" aria-hidden="true">
              <div className="home-demo-editor">
                <span className="home-demo-label">Job match</span>
                <div className="home-score-ring"><strong>82</strong><span>clear match</span></div>
                <span className="home-demo-label">Priority edit</span>
                <div className="home-demo-tip">Add one result that shows how your launch work affected adoption.</div>
              </div>
              <div className="home-demo-paper">
                <h2>Maya Chen</h2>
                <p>Product marketing manager</p>
                <i />
                <h3>Profile</h3>
                <span /><span /><span className="short" />
                <h3>Experience</h3>
                <strong>Senior product marketing manager</strong>
                <span /><span /><span className="short" />
              </div>
            </div>
          </figure>
          <figure className="home-mascot-card">
            <img src="/mascot-mate.webp" width="800" height="1000" alt="Mate, ResuMate's friendly paper resume mascot holding a pencil and a check card" decoding="async" />
            <figcaption><strong>Meet Mate.</strong><span>A calm second set of eyes for the details.</span></figcaption>
          </figure>
        </div>
      </section>

      <TaglineReveal />

      <section className="home-section home-benefits" aria-labelledby="benefits-title" data-reveal>
        <header className="home-section-head">
          <span className="home-kicker">What changes</span>
          <h2 id="benefits-title">A better resume workflow, from first draft to final file.</h2>
          <p>Use deterministic checks for the facts, hosted AI when it helps with wording, and your own judgment for the final decision.</p>
        </header>
        <div className="home-benefit-grid">
          <article className="home-benefit-main">
            <span>01</span>
            <h3>Write with structure</h3>
            <p>Turn scattered notes into clear sections with focused fields, useful prompts, and a live document preview.</p>
            <div className="home-mini-editor" aria-hidden="true"><span /><span /><span className="short" /></div>
          </article>
          <article>
            <span>02</span>
            <h3>Match the role, not a mystery score</h3>
            <p>Compare required and preferred signals against the job description, then see which edit matters first.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Use AI when it earns its place</h3>
            <p>Paid plans include guarded hosted actions for summaries, bullets, cover letters, and interview preparation.</p>
          </article>
          <article>
            <span>04</span>
            <h3>Keep the final call</h3>
            <p>Review every suggestion, choose an ATS friendly template, and export files you can inspect yourself.</p>
          </article>
        </div>
      </section>

      <section className="home-section home-workflow" aria-labelledby="workflow-title" data-reveal>
        <div className="home-section-head compact">
          <span className="home-kicker">Three useful steps</span>
          <h2 id="workflow-title">From blank page to ready to send.</h2>
        </div>
        <ol className="home-steps">
          <li><span>1</span><div><h3>Add what is true</h3><p>Enter your experience, education, skills, and measurable results.</p></div></li>
          <li><span>2</span><div><h3>Adapt for one role</h3><p>Paste the job description and work through the strongest missing signals.</p></div></li>
          <li><span>3</span><div><h3>Export with confidence</h3><p>Choose a template and download PDF, Word, text, Markdown, or JSON Resume.</p></div></li>
        </ol>
      </section>

      <section className="home-section home-template-proof" aria-labelledby="templates-title" data-reveal>
        <div className="home-template-copy">
          <span className="home-kicker">Nine original templates</span>
          <h2 id="templates-title">Formatting choices you can explain.</h2>
          <p>Choose conservative, compact, technical, or design led layouts. The practical templates use standard section labels and selectable text for common parsing workflows.</p>
          <button className="btn-ghost home-secondary-action" onClick={onStartSample}>Try a filled in sample</button>
        </div>
        <div className="home-template-stack" aria-hidden="true">
          <div className="home-stack-sheet executive"><b>ALEX RIVERA</b><span /><span /><em /><span /><span /><em /><span /></div>
          <div className="home-stack-sheet technical"><b>PRIYA SHAH</b><span /><em /><span /><span /><em /><span /><span /></div>
          <div className="home-stack-sheet compact"><b>JORDAN LEE</b><span /><span /><em /><span /><em /><span /><span /></div>
        </div>
      </section>

      <section className="home-section home-plan-section" aria-labelledby="plans-title" data-reveal>
        <div className="home-plan-copy">
          <span className="home-kicker">Start free, add power when needed</span>
          <h2 id="plans-title">Pay for the search you are running now.</h2>
          <p>Free covers the core workflow. Career Sprint adds 40 hosted AI actions for 30 days. Pro includes 150 hosted AI actions each month.</p>
        </div>
        <a className="btn-primary home-primary-action" href="/pricing">Compare every plan</a>
      </section>

      <section className="home-section home-faq" aria-labelledby="faq-title" data-reveal>
        <header className="home-section-head compact">
          <span className="home-kicker">Plain answers</span>
          <h2 id="faq-title">Know what ResuMate does before you start.</h2>
        </header>
        <div className="home-faq-grid">
          {FAQS.map((faq) => <article key={faq.question}><h3>{faq.question}</h3><p>{faq.answer}</p></article>)}
        </div>
      </section>

      <section className="home-final" data-reveal>
        <span className="home-eyebrow">Your next draft can start now</span>
        <h2>Build the resume. Keep the decisions.</h2>
        <button className="btn-primary home-primary-action" onClick={onStartBlank}>Build my resume free</button>
        <p>No account is required to begin. <button className="home-inline-action" onClick={onCreateAccount}>Create an account</button> when you want a verified profile and paid plan access.</p>
      </section>

      <footer className="home-footer">
        <div><strong>ResuMate</strong><p>Self serve resume software by Built WAI.</p></div>
        <nav aria-label="Product and legal">
          <a href="/pricing">Pricing</a><a href="mailto:support@builtwai.com">Support</a><a href="/privacy">Privacy</a><a href="/tos">Terms</a><a href="/refund">Refunds</a>
        </nav>
      </footer>
    </div>
  )
}
