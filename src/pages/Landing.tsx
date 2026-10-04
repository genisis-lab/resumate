import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowRight, Check, CheckCircle2, Circle, Cloud, Download, FileText, Globe2, HardDrive, KeyRound, Lock,
  Minus, Plus, Sparkles, Upload, Wand2,
} from "lucide-react"
import type { TemplateId } from "../types/resume"
import { createSampleResume } from "../data/sample"
import { ResumePreview } from "../templates/ResumePreview"
import { PaperFrame } from "../components/PaperFrame"
import { SiteFooter } from "../components/SiteFooter"
import { TEMPLATES, templateMeta } from "../templates/registry"
import { trackEvent } from "../lib/analytics"
import { navigate } from "../router"
import "./landing.css"

// Counts shown on the page come from the product itself, never from claims
// about users we cannot verify.
const AI_TOOL_COUNT = 12
const LANGUAGE_COUNT = 3
const FREE_TEMPLATE_COUNT = TEMPLATES.filter((item) => item.tier === "free").length

const FAQS = [
  {
    question: "Is ResuMate free?",
    answer: `Yes. You can build, check, and download a complete resume without a credit card or an account. Free includes one resume, ${FREE_TEMPLATE_COUNT} ATS friendly templates, five ATS checks and three PDF or Word downloads each month. Career Sprint and Pro add hosted AI tools, every template, and unlimited downloads.`,
  },
  {
    question: "Where are my resumes stored?",
    answer: "In your browser. Editing and saving happen on your device, and creating an account does not upload anything. Pro can turn on optional end to end encrypted sync: your browser encrypts your resumes with a passphrase only you know before anything leaves the device.",
  },
  {
    question: "Will my resume pass applicant tracking systems?",
    answer: "Every template exports selectable text with standard section headings, and the free ATS checker flags missing keywords and structure problems before you apply. No tool can promise how a specific employer's system or recruiter will rank you, so we don't.",
  },
  {
    question: "Does the AI make up experience I don't have?",
    answer: "No. The AI only works with what is on your resume. Its replies are checked against your resume, skills and keywords it cannot find there are dropped, and you review every suggestion before it changes anything.",
  },
  {
    question: "Can the AI tailor my resume to a specific job?",
    answer: "Yes, on Career Sprint and Pro. Paste the job post and ResuMate rewrites your summary for the role, lists the keywords worth adding, and drafts a matching cover letter, all grounded in your own experience.",
  },
  {
    question: "Can I write my resume in Spanish or French?",
    answer: "Yes. Any plan can switch headings and labels to Spanish or French in one click. Paid plans can translate the whole resume with AI into a new copy, keeping names, employers, and numbers exactly as written.",
  },
  {
    question: "Can I download my resume as a PDF or Word file?",
    answer: "Yes. Download a clean, ATS readable PDF or an editable Word file, plus plain text, Markdown, or JSON Resume. There is no watermark on any plan.",
  },
  {
    question: "Which template should I choose?",
    answer: "For most roles, ATS-Safe, Classic, or Modern is the safest choice. Compact fits a long career on one page, and Horizon or Bold suit design and marketing roles. You can switch templates at any time without retyping.",
  },
]

const TAGLINE = "Your experience is real. Your resume should make it easy to see."

function useReveal() {
  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>(".lp [data-reveal]"))
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduce || !("IntersectionObserver" in window)) {
      items.forEach((item) => item.classList.add("is-visible"))
      return
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add("is-visible")
        observer.unobserve(entry.target)
      }
    }, { rootMargin: "0px 0px -8%", threshold: 0.08 })
    items.forEach((item) => observer.observe(item))
    return () => observer.disconnect()
  }, [])
}

function SectionHead({ eyebrow, title, children, id, dark = false }: { eyebrow: string; title: React.ReactNode; children?: React.ReactNode; id: string; dark?: boolean }) {
  return (
    <header className={`lp-head${dark ? " dark" : ""}`} data-reveal>
      <div>
        <span className="lp-eyebrow">{eyebrow}</span>
        <h2 id={id}>{title}</h2>
      </div>
      {children && <p>{children}</p>}
    </header>
  )
}

/* ---------- Hero ---------- */

function HeroVisual({ resume }: { resume: ReturnType<typeof createSampleResume> }) {
  return (
    <div className="lp-hero-visual" data-reveal aria-hidden="true">
      <div className="lp-hero-panel">
        <div className="lp-hero-paper">
          <PaperFrame size="letter"><ResumePreview resume={resume} /></PaperFrame>
        </div>
      </div>
      <div className="lp-float lp-float-left">
        <div className="lp-float-row"><span className="lp-tag">AI rewrite</span><span className="lp-muted">Bullet 1</span></div>
        <p className="lp-strike">Helped redesign the onboarding flow.</p>
        <p>Led the onboarding redesign that raised activation 38%.</p>
      </div>
      <div className="lp-float lp-float-right">
        <div className="lp-float-row"><span className="lp-muted">Job match</span><span className="lp-good">Strong</span></div>
        <span className="lp-caps">Keywords matched</span>
        <div className="lp-chips">
          {["Design systems", "Accessibility", "Figma", "Prototyping"].map((word) => <span key={word} className="lp-chip good"><Check size={12} /> {word}</span>)}
        </div>
        <div className="lp-float-foot"><FileText size={13} /> Senior Product Designer · Lumen Health</div>
      </div>
    </div>
  )
}

function Stats() {
  const stats = [
    { value: String(TEMPLATES.length), label: `resume templates, ${FREE_TEMPLATE_COUNT} of them free` },
    { value: String(AI_TOOL_COUNT), label: "AI writing and review tools on paid plans" },
    { value: String(LANGUAGE_COUNT), label: "resume languages: English, Spanish, French" },
    { value: "$0", label: "to build, check, and download your resume" },
  ]
  return (
    <section className="lp-stats" aria-label="ResuMate in numbers" data-reveal>
      {stats.map((stat) => <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}
    </section>
  )
}

/* ---------- Core feature mockups ---------- */

function MatchMock() {
  const rows: [string, boolean][] = [["5+ years with Figma", true], ["Design systems", true], ["Accessibility practice", true], ["Stakeholder communication", false]]
  return (
    <div className="mock mock-match">
      <div className="mock-card mock-score">
        <div className="mock-gauge"><svg viewBox="0 0 120 70"><path d="M10 64a50 50 0 0 1 100 0" className="track" /><path d="M10 64a50 50 0 0 1 92-27" className="fill" /></svg><strong>82</strong><span>of 100</span></div>
        <div><b>Strong match</b><p>3 of 4 required signals found. One edit would close the gap.</p></div>
      </div>
      <div className="mock-card">
        <span className="lp-caps">Required in the job post</span>
        <ul className="mock-list">{rows.map(([label, ok]) => <li key={label}>{ok ? <CheckCircle2 size={16} className="ok" /> : <Circle size={16} className="miss" />}<span>{label}</span>{ok ? <em>On your resume</em> : <em className="miss">Missing</em>}</li>)}</ul>
      </div>
      <div className="mock-card mock-tip"><span className="lp-tag">Priority edit</span><p>Add one bullet showing how you aligned stakeholders on the design system rollout.</p></div>
    </div>
  )
}

function CoachMock() {
  return (
    <div className="mock mock-coach">
      <div className="mock-card mock-review-head"><Sparkles size={16} /><b>Resume review</b><span>3 suggestions</span></div>
      {[
        { level: "High", tone: "bad", quote: "Responsible for the design system.", fix: "Built a 120 component design system adopted by 4 product teams.", why: "Shows scope and adoption instead of a duty." },
        { level: "Medium", tone: "ok", quote: "Worked with engineers on handoff.", fix: "Cut design to dev handoff time by 45% with shared tokens.", why: "Adds the result recruiters scan for." },
      ].map((item) => (
        <div className="mock-card mock-review" key={item.quote}>
          <span className={`mock-level ${item.tone}`}>{item.level}</span>
          <p className="lp-strike">{item.quote}</p>
          <p>{item.fix}</p>
          <span className="lp-muted">{item.why}</span>
          <div className="mock-actions"><span className="mock-btn primary">Apply</span><span className="mock-btn">Skip</span></div>
        </div>
      ))}
    </div>
  )
}

function TailorMock() {
  return (
    <div className="mock mock-tailor">
      <div className="mock-card">
        <span className="lp-caps">Summary · tailored for Lumen Health</span>
        <p className="lp-strike">Senior product designer with 7+ years crafting digital products.</p>
        <p>Senior product designer who builds accessible design systems for health products, raising activation 38% through research led redesigns.</p>
      </div>
      <div className="mock-card">
        <span className="lp-caps">Keywords worth adding</span>
        <div className="lp-chips">{["Healthcare", "WCAG 2.2", "Usability testing"].map((word) => <span key={word} className="lp-chip"><Plus size={12} /> {word}</span>)}</div>
        <span className="lp-muted">Only add what you have really done.</span>
      </div>
    </div>
  )
}

function LetterMock() {
  return (
    <div className="mock mock-letter">
      <div className="mock-paper">
        <b>Jordan Avery</b>
        <span className="lp-muted">San Francisco, CA · jordan.avery@email.com</span>
        <p>Dear hiring team at Lumen Health,</p>
        <p className="accent">I led the onboarding redesign at Brightwave that raised activation 38%, and I would bring the same research led approach to your patient experience team.</p>
        <p className="accent">My design system work cut handoff time by 45% across four teams, which maps directly to the platform role you describe.</p>
        <p>Thank you for your time and consideration.</p>
      </div>
      <div className="mock-card mock-form">
        <label><span>Company</span><i>Lumen Health</i></label>
        <label><span>Role</span><i>Senior Product Designer</i></label>
        <label><span>Tone</span><div className="lp-chips"><span className="lp-chip active">Professional</span><span className="lp-chip">Warm</span><span className="lp-chip">Concise</span></div></label>
        <span className="mock-btn primary wide"><Wand2 size={14} /> Regenerate</span>
      </div>
    </div>
  )
}

function InterviewMock() {
  return (
    <div className="mock mock-interview">
      {[
        { q: "Tell us about a design decision you changed after research.", tip: "Use the onboarding redesign: what the data showed, what you changed, and the 38% lift." },
        { q: "How do you keep a design system consistent across teams?", tip: "Walk through the 120 component system, adoption by 4 teams, and the critique rituals you started." },
        { q: "How do you work with engineering on handoff?", tip: "Mention shared tokens and the 45% faster handoff." },
      ].map((item, index) => (
        <div className="mock-card mock-question" key={item.q}>
          <span className="mock-num">{index + 1}</span>
          <div><b>{item.q}</b><p>{item.tip}</p></div>
        </div>
      ))}
    </div>
  )
}

const CORE = [
  { id: "match", label: "ATS job match", path: "/analyze", cta: "Try the ATS checker", caption: "Paste any job post and see which requirements your resume covers, which keywords are missing, and the one edit that matters most.", Mock: MatchMock },
  { id: "coach", label: "AI resume coach", path: "/coach", cta: "Meet the AI coach", caption: "Get a prioritized review of your whole resume, with the exact line to change and why. You approve every edit.", Mock: CoachMock },
  { id: "tailor", label: "Tailor to a job", path: "/analyze", cta: "Tailor my resume", caption: "Rewrite your summary for one role and see the keywords worth adding, kept true to your experience.", Mock: TailorMock },
  { id: "letter", label: "Cover letters and emails", path: "/cover", cta: "Write a cover letter", caption: "A cover letter from your resume and the job post in the tone you choose, plus follow up, thank you, and networking emails.", Mock: LetterMock },
  { id: "interview", label: "Interview prep", path: "/interview", cta: "Prepare for an interview", caption: "Likely questions for the role, with answer directions drawn from your own experience.", Mock: InterviewMock },
]

function CoreFeatures({ onStart }: { onStart: () => void }) {
  const [active, setActive] = useState(0)
  const tabs = useRef<Array<HTMLButtonElement | null>>([])
  const item = CORE[active]
  function onKey(event: React.KeyboardEvent) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "ArrowRight" && event.key !== "ArrowLeft") return
    event.preventDefault()
    const next = (active + (event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : CORE.length - 1)) % CORE.length
    setActive(next)
    tabs.current[next]?.focus()
  }
  return (
    <section className="lp-section" aria-labelledby="core-title">
      <SectionHead eyebrow="Core features" id="core-title" title="More than a resume builder.">
        Check your match, rewrite with AI, tailor for one job, and prepare for the interview. Every step of the search in one workspace.
      </SectionHead>
      <div className="lp-core" data-reveal>
        <div className="lp-core-side">
          <div className="lp-tabs" role="tablist" aria-label="Core features" aria-orientation="vertical" onKeyDown={onKey}>
            {CORE.map((entry, index) => (
              <button
                key={entry.id}
                ref={(node) => { tabs.current[index] = node }}
                role="tab"
                id={`core-tab-${entry.id}`}
                aria-selected={index === active}
                aria-controls={`core-panel-${entry.id}`}
                tabIndex={index === active ? 0 : -1}
                className={index === active ? "active" : ""}
                onClick={() => setActive(index)}
              >
                {entry.label}
              </button>
            ))}
          </div>
          <button className="btn-primary lp-btn" onClick={onStart}>Get started for free <ArrowRight size={16} aria-hidden="true" /></button>
        </div>
        <div className="lp-core-stage" role="tabpanel" id={`core-panel-${item.id}`} aria-labelledby={`core-tab-${item.id}`}>
          <div className="lp-core-panel" aria-hidden="true" key={item.id}><item.Mock /></div>
          <div className="lp-core-caption">
            <p>{item.caption}</p>
            <a href={item.path} onClick={(event) => { event.preventDefault(); navigate(item.path) }}>{item.cta} <ArrowRight size={16} aria-hidden="true" /></a>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------- Privacy and languages ---------- */

function PrivacyCards() {
  return (
    <section className="lp-section" aria-labelledby="privacy-title">
      <SectionHead eyebrow="Private by design" id="privacy-title" title="Your resume, on your terms.">
        Edit in your browser, sync between devices only if you choose, and send the same resume in three languages.
      </SectionHead>
      <div className="lp-cards three" data-reveal>
        <article>
          <div className="lp-card-art" aria-hidden="true">
            <div className="art-window">
              <div className="art-bar"><i /><i /><i /><span>resume.builtwai.com</span></div>
              <div className="art-body">
                <div className="art-row"><HardDrive size={16} /><b>Saved on this device</b><span className="lp-good">Just now</span></div>
                <div className="art-row muted"><Check size={14} /> No account needed</div>
                <div className="art-row muted"><Check size={14} /> Works offline</div>
                <div className="art-row muted"><Check size={14} /> Back up to a file anytime</div>
              </div>
            </div>
          </div>
          <span className="lp-caps">Local first</span>
          <h3>Stays in your browser</h3>
          <p>Your resumes are saved on your device. Nothing is uploaded unless you use an online feature like hosted AI.</p>
        </article>
        <article>
          <div className="lp-card-art" aria-hidden="true">
            <div className="art-sync">
              <div className="art-device">Laptop</div>
              <div className="art-lock"><Lock size={18} /><span>AES-256</span></div>
              <div className="art-device">Desktop</div>
            </div>
            <div className="art-cipher"><KeyRound size={14} /> Encrypted on your device with your passphrase</div>
            <code className="art-code">x9fQ2v…J1pLw8 · version 14</code>
          </div>
          <span className="lp-caps">Pro · optional</span>
          <h3>Encrypted sync, if you want it</h3>
          <p>Turn on sync with a passphrase only you know. Your browser encrypts everything first, so we store data we cannot read.</p>
        </article>
        <article>
          <div className="lp-card-art" aria-hidden="true">
            <div className="art-langs">
              {[["EN", "Work Experience", "Present"], ["ES", "Experiencia laboral", "Actualidad"], ["FR", "Expérience professionnelle", "Aujourd’hui"]].map(([code, heading, present]) => (
                <div key={code} className="art-lang"><span className="art-code-chip">{code}</span><b>{heading}</b><span>2021 – {present}</span></div>
              ))}
            </div>
          </div>
          <span className="lp-caps">Languages</span>
          <h3>English, Spanish, and French</h3>
          <p>Switch headings in one click on any plan, or translate the whole resume with AI into a new copy on paid plans.</p>
        </article>
      </div>
    </section>
  )
}

/* ---------- Templates ---------- */

const SHOWCASE: TemplateId[] = ["ats", "classic", "modern", "sidebar", "timeline", "elegant", "developer", "bold"]

function TemplateShowcase({ onUseTemplate }: { onUseTemplate: (id: TemplateId) => void }) {
  const [active, setActive] = useState<TemplateId>("classic")
  const sample = useMemo(() => createSampleResume(), [])
  const resume = useMemo(() => ({ ...sample, settings: { ...sample.settings, template: active } }), [sample, active])
  return (
    <section className="lp-dark" aria-labelledby="templates-title">
      <div className="lp-dark-inner">
        <SectionHead dark eyebrow="Resume templates" id="templates-title" title="Start from a template recruiters can read.">
          {TEMPLATES.length} designs, from single column classics to Premium two column layouts. Try any of them on your own resume before you upgrade.
        </SectionHead>
        <div className="lp-templates" data-reveal>
          <ul className="lp-template-list" role="list">
            {SHOWCASE.map((id) => {
              const meta = templateMeta(id)
              const on = id === active
              return (
                <li key={id} className={on ? "active" : ""}>
                  <button type="button" aria-expanded={on} onClick={() => setActive(id)}>
                    {meta.label} template {meta.tier === "premium" && <span className="lp-premium">Premium</span>}
                  </button>
                  {on && (
                    <div className="lp-template-detail">
                      <p>{meta.description}</p>
                      <button type="button" className="lp-white-btn" onClick={() => onUseTemplate(id)}>Use this template <ArrowRight size={14} aria-hidden="true" /></button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="lp-template-preview" aria-hidden="true">
            <PaperFrame size="letter"><ResumePreview resume={resume} /></PaperFrame>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------- Every feature ---------- */

function EveryFeature() {
  return (
    <section className="lp-section" aria-labelledby="every-title">
      <SectionHead eyebrow="Every feature" id="every-title" title="Every tool you need to land the interview.">
        From your first bullet point to the final PDF, ResuMate handles the busywork so you can focus on the job.
      </SectionHead>
      <div className="lp-cards three grid-6" data-reveal>
        <article>
          <div className="lp-card-art" aria-hidden="true">
            <div className="art-panel">
              {[["Design systems", "3 mentions", true], ["Accessibility", "2 mentions", true], ["Usability testing", "1 mention", false], ["Healthcare", "Add", false]].map(([label, note, ok]) => (
                <div className="art-kw" key={label as string}><span>{label}</span><em className={note === "Add" ? "add" : ""}>{note}</em>{ok ? <CheckCircle2 size={16} className="ok" /> : <Circle size={16} className="miss" />}</div>
              ))}
            </div>
          </div>
          <h3>Keyword matching</h3>
          <p>See which skills from the job post your resume covers, and which are worth adding.</p>
        </article>
        <article>
          <div className="lp-card-art" aria-hidden="true">
            <div className="art-panel art-ats">
              <div className="art-ats-head"><span>ATS check</span><span className="lp-good">Ready to send</span></div>
              <strong>94<small>/100</small></strong>
              <div className="art-meter"><i style={{ width: "94%" }} /></div>
              <span><Check size={13} /> Single column layout</span>
              <span><Check size={13} /> Standard section headings</span>
              <span className="muted"><Circle size={13} /> Add 1 more keyword</span>
            </div>
          </div>
          <h3>ATS resume checker</h3>
          <p>A private check of structure and keywords that runs in your browser, free each month.</p>
        </article>
        <article>
          <div className="lp-card-art" aria-hidden="true">
            <div className="art-panel">
              <div className="art-ats-head"><span>Experience · Bullet 2</span><span className="lp-tag">AI rewrite</span></div>
              <p className="lp-strike">Worked on product launches with marketing.</p>
              <p>Partnered with marketing on 4 launches that grew qualified signups 27%.</p>
              <div className="mock-actions"><span className="mock-btn good">Accepted <Check size={12} /></span><span className="mock-btn">Try again</span></div>
            </div>
          </div>
          <h3>AI bullet writer</h3>
          <p>Turn rough notes into results led bullets for the role, without inventing numbers.</p>
        </article>
        <article>
          <div className="lp-card-art" aria-hidden="true">
            <div className="art-panel">
              <div className="art-file"><span className="art-pdf">PDF</span><div><b>resume-2024.pdf</b><span>Importing · 3 of 4 sections</span></div></div>
              <div className="art-meter"><i style={{ width: "72%" }} /></div>
              <span className="art-step"><Check size={13} /> Contact details</span>
              <span className="art-step"><Check size={13} /> Experience · 3 roles</span>
              <span className="art-step"><Check size={13} /> Education</span>
              <span className="art-step muted"><Upload size={13} /> Skills</span>
            </div>
          </div>
          <h3>Import your old resume</h3>
          <p>Start from a PDF, a text file, or a JSON Resume instead of retyping everything.</p>
        </article>
        <article>
          <div className="lp-card-art" aria-hidden="true">
            <div className="art-panel art-fit">
              <div className="art-pages"><i /><i className="ghost" /></div>
              <div className="art-fit-copy"><b>2 pages</b><ArrowRight size={14} /><b className="accent">1 page</b></div>
              <span className="mock-btn primary"><Wand2 size={13} /> Fit to one page</span>
            </div>
          </div>
          <h3>Fit to one page</h3>
          <p>A true to print preview with page breaks, plus one click to tighten spacing until it fits.</p>
        </article>
        <article>
          <div className="lp-card-art" aria-hidden="true">
            <div className="art-panel">
              <div className="art-ats-head"><span>Download</span><span className="lp-tag">No watermark</span></div>
              <div className="art-dl active"><b>PDF</b><span>ATS ready</span></div>
              <div className="art-dl"><b>Word (.docx)</b><span>Editable</span></div>
              <div className="art-dl"><b>Text and Markdown</b><span>Paste anywhere</span></div>
              <span className="mock-btn primary wide"><Download size={13} /> Download resume</span>
            </div>
          </div>
          <h3>Export to PDF or Word</h3>
          <p>Clean, selectable text files you can inspect yourself, on every plan.</p>
        </article>
      </div>
    </section>
  )
}

/* ---------- Tagline ---------- */

function TaglineReveal() {
  const words = TAGLINE.split(" ")
  const ref = useRef<HTMLParagraphElement>(null)
  const [lit, setLit] = useState(0)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      setLit(words.length)
      return
    }
    // Each word lights up once it crosses a line 40% from the bottom.
    const spans = Array.from(node.querySelectorAll<HTMLElement>("span"))
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const index = Number((entry.target as HTMLElement).dataset.index)
        setLit((current) => Math.max(current, index + 1))
        observer.unobserve(entry.target)
      }
    }, { rootMargin: "0px 0px -40% 0px", threshold: 1 })
    spans.forEach((span) => observer.observe(span))
    return () => observer.disconnect()
  }, [words.length])
  return (
    <section className="lp-tagline" aria-label="Our promise">
      <p ref={ref}>
        {words.map((word, index) => <span key={`${word}-${index}`} data-index={index} className={index < lit ? "lit" : ""}>{word} </span>)}
      </p>
    </section>
  )
}

/* ---------- FAQ ---------- */

function Faq() {
  const [open, setOpen] = useState(0)
  return (
    <section className="lp-section lp-faq" aria-labelledby="faq-title">
      <div className="lp-faq-side" data-reveal>
        <span className="lp-eyebrow">FAQ</span>
        <h2 id="faq-title">Questions, answered.</h2>
        <p>Everything you need to know before you start your resume.</p>
        <a className="lp-link" href="mailto:support@builtwai.com">Contact support <ArrowRight size={16} aria-hidden="true" /></a>
      </div>
      <div className="lp-faq-list" data-reveal>
        {FAQS.map((faq, index) => {
          const on = open === index
          return (
            <div className={`lp-faq-item${on ? " open" : ""}`} key={faq.question}>
              <h3>
                <button type="button" aria-expanded={on} aria-controls={`faq-${index}`} id={`faq-q-${index}`} onClick={() => setOpen(on ? -1 : index)}>
                  <span>{faq.question}</span>
                  <span className="lp-faq-icon" aria-hidden="true">{on ? <Minus size={14} /> : <Plus size={14} />}</span>
                </button>
              </h3>
              <div className="lp-faq-answer" id={`faq-${index}`} role="region" aria-labelledby={`faq-q-${index}`} hidden={!on}><p>{faq.answer}</p></div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/* ---------- Final CTA ---------- */

function FinalCta({ onStart }: { onStart: () => void }) {
  return (
    <section className="lp-final" aria-labelledby="final-title" data-reveal>
      <h2 id="final-title">Your next job starts with a clearer resume.</h2>
      <p>Build it free in your browser. Add AI help only when you want it.</p>
      <div className="lp-final-actions">
        <button className="btn-primary lp-btn" onClick={onStart}>Get started for free <ArrowRight size={16} aria-hidden="true" /></button>
        <a className="lp-white-btn large" href="/pricing" onClick={(event) => { event.preventDefault(); navigate("/pricing") }}>See plans</a>
      </div>
      <span className="lp-final-note">No credit card needed</span>
      <div className="lp-final-peek" aria-hidden="true">
        <div className="peek-toolbar">
          <span className="peek-chip">Modern</span><span className="peek-chip">Design</span><span className="peek-chip good">1 page</span>
          <span className="peek-spacer" /><span className="peek-chip">ATS check</span><span className="peek-chip primary"><Download size={12} /> Download PDF</span>
        </div>
        <div className="peek-body">
          <div className="peek-paper"><b>Jordan Avery</b><i /><i /><i className="short" /><em /><i /><i /><i className="short" /></div>
          <div className="peek-score"><strong>82</strong><span>Strong match</span><i /><i className="short" /></div>
        </div>
      </div>
    </section>
  )
}

export function Landing({ onStartBlank, onUseTemplate }: { onStartBlank: () => void; onStartSample?: () => void; onCreateAccount?: () => void; onUseTemplate: (id: TemplateId) => void }) {
  const hero = useMemo(() => {
    const sample = createSampleResume()
    return { ...sample, settings: { ...sample.settings, template: "classic" as TemplateId } }
  }, [])
  useEffect(() => { trackEvent("landing_view") }, [])
  useReveal()
  return (
    <div className="lp">
      <section className="lp-hero" aria-labelledby="hero-title">
        <a className="lp-pill" href="/pricing" onClick={(event) => { event.preventDefault(); navigate("/pricing") }}>
          <span className="lp-pill-badge">New</span><Cloud size={14} aria-hidden="true" /> Optional encrypted sync for Pro <ArrowRight size={14} aria-hidden="true" />
        </a>
        <h1 id="hero-title">The private resume builder,<br /> tailored to every job.</h1>
        <button className="btn-primary lp-btn lp-hero-cta" onClick={onStartBlank}>Build my resume free <ArrowRight size={18} aria-hidden="true" /></button>
        <p className="lp-hero-note"><span>No credit card or account needed</span><span aria-hidden="true">·</span><span><Globe2 size={14} aria-hidden="true" /> Your resume stays in your browser</span></p>
        <HeroVisual resume={hero} />
      </section>
      <Stats />
      <CoreFeatures onStart={onStartBlank} />
      <PrivacyCards />
      <TemplateShowcase onUseTemplate={onUseTemplate} />
      <EveryFeature />
      <TaglineReveal />
      <Faq />
      <FinalCta onStart={onStartBlank} />
      <SiteFooter />
    </div>
  )
}
