import { navigate } from "../router"

export function Privacy() {
  return (
    <div className="page narrow privacy-page">
      <button className="btn-ghost small" onClick={() => navigate("/")}>← Back home</button>
      <h1>Privacy &amp; data</h1>
      <p className="page-sub">
        ResuMate is designed to keep ordinary resume editing on your device. Here is what happens
        when you use each feature.
      </p>

      <div className="card">
        <h2 className="card-title">Stored in your browser</h2>
        <ul className="bullet-list">
          <li>Resumes, saved job descriptions, theme settings, and optional provider settings use browser storage.</li>
          <li>Use <strong>Backup all</strong> to save a portable copy, or <strong>Clear data</strong> to remove saved resumes, job descriptions, and the local AI key.</li>
          <li>If browser storage is unavailable or full, edits may not persist; the app will show a save warning.</li>
        </ul>
      </div>

      <div className="card">
        <h2 className="card-title">AI features</h2>
        <p className="hint">
          Offline ATS checks run locally. When you choose an AI feature, the selected resume and/or
          job-description text is sent through the app's serverless endpoint to the configured AI
          provider. Do not submit information you do not want processed by that provider.
        </p>
      </div>

      <div className="card">
        <h2 className="card-title">Share links</h2>
        <p className="hint">
          A share link contains an encoded copy of the resume in the URL fragment. It is not
          encrypted: anyone who has the link can decode and read the resume. Treat it like a public
          document; there is no server-side revocation for a link that has already been copied.
        </p>
      </div>

      <div className="card">
        <h2 className="card-title">Your choices</h2>
        <p className="hint">
          You can use the editor, exports, and offline ATS check without an account or AI key. Review
          the privacy and retention policies of any AI provider you select before using AI features.
        </p>
      </div>
    </div>
  )
}
