const FAQS = [
  ["Is ResuMate a resume-writing service?", "No. ResuMate is self-serve software. You enter and control your own details, choose a template, review automated checks, and export the file yourself."],
  ["Does the ATS checker guarantee interviews?", "No. The local checker reviews structure and keyword alignment against a job description. It cannot predict an employer's private system or hiring decision."],
  ["Are AI features live?", "Local ATS analysis and browser-local PDF or text resume matching are live now. Online AI writing tools work only when an AI provider is configured; expanded hosted AI allowances are upcoming."],
  ["Where are my resumes stored?", "Editing and ordinary saves stay in this browser. Creating an account does not upload existing resumes. Future cloud sync will be opt-in and clearly labeled."],
  ["Can I export without paying?", "Yes. The free plan includes core PDF and Word exports, and you can also use the browser editor without an account."],
  ["Can I use ResuMate on mobile?", "Yes. The editor, preview controls, imports, and export menu adapt for phones and tablets."],
]

export function Landing({ onStartBlank, onStartSample, onCreateAccount }: { onStartBlank: () => void; onStartSample: () => void; onCreateAccount: () => void }) {
  return (
    <div className="landing">
      <section className="hero landing-hero">
        <div className="hero-copy">
          <span className="eyebrow">Self-serve resume software</span>
          <h1>Build a resume that reads clearly to people and software.</h1>
          <p className="hero-sub">Write from a structured editor, compare your resume with a job description, and export a clean PDF or Word file. Your details stay under your control.</p>
          <div className="hero-cta"><button className="btn-primary large" onClick={onCreateAccount}>Create a free account</button><button className="text-button hero-text-action" onClick={onStartBlank}>Open the editor without an account →</button></div>
          <p className="hero-note">No credit card. Email verification protects your account. Existing browser resumes are never uploaded automatically.</p>
          <div className="proof-strip" aria-label="Available product capabilities"><span>9 original templates</span><span>PDF and Word export</span><span>Local ATS check</span><span>Offline editing</span></div>
        </div>
        <div className="hero-product" aria-label="ResuMate editor preview">
          <div className="product-top"><span>Product Marketing Resume</span><span className="product-saved">Saved locally</span></div>
          <div className="product-body"><div className="product-editor"><span className="mock-label">Professional summary</span><div className="mock-input tall"><span /><span /><span className="short" /></div><span className="mock-label">Experience</span><div className="mock-input"><span /><span className="short" /></div><div className="mock-score"><strong>82</strong><span>Local match</span></div></div><div className="product-paper"><h2>Maya Chen</h2><p>Product Marketing Manager</p><i /><h3>Professional summary</h3><span /><span /><span className="paper-short" /><h3>Experience</h3><strong>Senior Product Marketing Manager</strong><span /><span /><span /></div></div>
        </div>
      </section>

      <section className="landing-section workflow-section"><div className="section-kicker">A focused workflow</div><h2>You bring the experience. ResuMate helps you shape it.</h2><div className="workflow-grid"><article><span>01</span><h3>Enter your real details</h3><p>Use structured fields, inline quality checks, action-verb guidance, and a live resume preview.</p></article><article><span>02</span><h3>Adapt for the role</h3><p>Paste a job description and use your editor resume or a local PDF/TXT file for deterministic keyword, requirement, and structure feedback. Optional online AI tools are labeled when available.</p></article><article><span>03</span><h3>Export and apply</h3><p>Choose an ATS-conscious template and download PDF, Word, plain text, Markdown, or JSON Resume.</p></article></div></section>

      <section className="landing-section landing-proof"><div className="proof-copy"><span className="section-kicker">Designed for real applications</span><h2>Formatting choices you can explain.</h2><p>Nine original templates cover conservative, compact, technical, and design-led roles. Standard section labels and selectable text keep the practical templates friendly to common parsing workflows.</p><button className="btn-ghost" onClick={onStartSample}>Try the editor with sample data</button></div><div className="template-stack" aria-hidden="true"><div className="stack-sheet executive"><b>ALEX RIVERA</b><span /><span /><em /><span /><span /><em /><span /></div><div className="stack-sheet technical"><b>PRIYA SHAH</b><span /><em /><span /><span /><em /><span /><span /></div><div className="stack-sheet compact"><b>JORDAN LEE</b><span /><span /><em /><span /><em /><span /><span /></div></div></section>

      <section className="landing-section capability-grid"><div className="capability-main"><span className="section-kicker">Available now</span><h2>Useful before you pay.</h2><p>The browser editor, local ATS check, imports, exports, backups, mobile preview, and share links work today.</p></div><article><span>Local</span><h3>ATS structure and keyword check</h3><p>Compare your content with a target role without sending the text to a server.</p></article><article><span>Optional</span><h3>Online AI assistance</h3><p>Available only when a provider is configured. Hosted allowances are upcoming and never implied as active.</p></article><article><span>Upcoming</span><h3>Cloud resume sync</h3><p>Verified accounts prepare the path; your current browser resumes remain local.</p></article></section>

      <section className="landing-section landing-faq"><div><span className="section-kicker">Plain answers</span><h2>Know what the software does before you sign up.</h2></div><div className="faq-list">{FAQS.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>

      <section className="landing-final"><span className="eyebrow">Start with the free account</span><h2>Build the document. Keep the decisions.</h2><button className="btn-primary large" onClick={onCreateAccount}>Create a free account</button><p>Or <button className="inline-button" onClick={onStartBlank}>use the editor without signing up</button>.</p></section>

      <footer className="landing-footer"><div><strong>ResuMate</strong><p>Self-serve resume-building software by Built WAI.</p></div><nav className="footer-links" aria-label="Product and legal"><a className="footer-link" href="/pricing">Pricing</a><a className="footer-link" href="mailto:support@builtwai.com">Support</a><a className="footer-link" href="/privacy">Privacy</a><a className="footer-link" href="/tos">Terms</a><a className="footer-link" href="/refund">Refunds</a></nav></footer>
    </div>
  )
}
