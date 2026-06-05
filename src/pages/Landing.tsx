import { navigate } from "../router"
import { loadStore, setActiveId, saveResume } from "../lib/storage"
import { createSampleResume } from "../data/sample"

const FEATURES = [
  { icon: "⚡", title: "No sign-up", text: "Start instantly. Your resume saves to your browser — no account, ever." },
  { icon: "🔒", title: "Private by design", text: "Data lives in your browser's local storage. Export a JSON backup anytime." },
  { icon: "🤖", title: "AI ATS scoring", text: "Paste a job description and get a match score plus tailored fixes." },
  { icon: "📄", title: "PDF & Word export", text: "Download crisp, ATS-parseable PDF and editable .docx files." },
  { icon: "🎨", title: "4 templates", text: "Modern, classic, minimal, and ATS-safe — switch with one click." },
  { icon: "✨", title: "Live preview", text: "See every change instantly in a pixel-accurate preview." },
]

export function Landing() {
  function startSample() {
    const sample = createSampleResume()
    saveResume(sample)
    setActiveId(sample.id)
    navigate("/builder")
  }
  function startBlank() {
    const store = loadStore()
    setActiveId(store.resumes[0].id)
    navigate("/builder")
  }
  return (
    <div className="landing">
      <section className="hero">
        <span className="eyebrow">Free · No sign-up · Open in your browser</span>
        <h1>Build an ATS-ready resume<br />in minutes.</h1>
        <p className="hero-sub">ResuMate is a fast, private resume builder with AI-powered ATS scoring, instant optimization tips, and one-click PDF & Word export.</p>
        <div className="hero-cta">
          <button className="btn-primary large" onClick={startBlank}>Start building →</button>
          <button className="btn-ghost large" onClick={startSample}>Try with a sample</button>
        </div>
        <p className="hero-note">No email required. Nothing uploaded to a server.</p>
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
        <p>ResuMate — privacy-first resume builder. Your data stays in your browser.</p>
      </footer>
    </div>
  )
}
