import { navigate } from "../router"

const FEATURES = [
  { icon: "⚡", title: "No sign-up", text: "Start instantly. Your resume saves to your browser — no account, ever." },
  { icon: "🔒", title: "Private by design", text: "Editing and offline checks stay in your browser. AI sends only the text you submit." },
  { icon: "🤖", title: "AI ATS scoring", text: "Paste a job description and get a match score plus tailored fixes." },
  { icon: "📄", title: "PDF & Word export", text: "Download crisp, ATS-parseable PDF and editable .docx files." },
  { icon: "🎨", title: "6 templates", text: "Modern, classic, minimal, ATS-safe, two-column, and creative — switch with one click." },
  { icon: "✨", title: "Live preview", text: "See every change instantly in a pixel-accurate preview." },
]

export function Landing({
  onStartBlank,
  onStartSample,
}: {
  onStartBlank: () => void
  onStartSample: () => void
}) {
  return (
    <div className="landing">
      <section className="hero">
        <span className="eyebrow">Free · No sign-up · Open in your browser</span>
        <h1>Build an ATS-ready resume<br />in minutes.</h1>
        <p className="hero-sub">ResuMate is a fast, private resume builder with AI-powered ATS scoring, instant optimization tips, and one-click PDF & Word export.</p>
        <div className="hero-cta">
          <button className="btn-primary large" onClick={onStartBlank}>Start building →</button>
          <button className="btn-ghost large" onClick={onStartSample}>Try with a sample</button>
        </div>
        <p className="hero-note">No email required. Offline editing stays in your browser; AI tools send only what you submit.</p>
      </section>

      <section className="features">
        {FEATURES.map((f) => (
          <div className="feature-card" key={f.title}>
            <div className="feature-icon">{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </div>
        ))}
      </section>

      <section className="how">
        <h2>How it works</h2>
        <div className="steps">
          <div className="step"><span className="step-n">1</span><div><strong>Fill in your details</strong><p>Use the structured editor with live preview.</p></div></div>
          <div className="step"><span className="step-n">2</span><div><strong>Run an ATS check</strong><p>Paste a job description and get a score + fixes.</p></div></div>
          <div className="step"><span className="step-n">3</span><div><strong>Export & apply</strong><p>Download a polished PDF or Word file and submit.</p></div></div>
        </div>
      </section>

      <footer className="landing-footer">
        <p>ResuMate — privacy-first resume builder. <button className="footer-link" onClick={() => navigate("/privacy")}>Privacy &amp; data</button></p>
      </footer>
    </div>
  )
}
