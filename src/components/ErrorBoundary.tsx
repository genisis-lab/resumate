import React from "react"

interface State {
  error: Error | null
}

// Top-level boundary so a render/parse crash shows a recoverable screen instead
// of a blank white page. Saved resume data lives in localStorage and is untouched.
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("ResuMate crashed:", error)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      return (
        <div className="crash" role="alert">
          <div className="crash-card">
            <div className="crash-emoji" aria-hidden="true">😬</div>
            <h1>Something went wrong</h1>
            <p>
              The app hit an unexpected error, but your saved resume data is safe in
              this browser. Try reloading — if it keeps happening, you can continue
              and export a backup.
            </p>
            <div className="crash-actions">
              <button className="btn-primary" onClick={() => location.reload()}>Reload</button>
              <button className="btn-ghost" onClick={this.reset}>Try to continue</button>
            </div>
            <pre className="crash-detail">{String(this.state.error?.message || this.state.error)}</pre>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
