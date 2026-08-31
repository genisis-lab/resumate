import { FormEvent, useCallback, useEffect, useState } from "react"
import { getAuthConfig, loginAccount, registerAccount, resendVerification } from "../lib/auth"
import { navigate } from "../router"
import { TurnstileWidget } from "../components/TurnstileWidget"
import { trackEvent } from "../lib/analytics"

export function AuthPage({ mode, onAuthenticated }: { mode: "login" | "signup"; onAuthenticated: () => Promise<void> }) {
  const signup = mode === "signup"
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [accepted, setAccepted] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [securityLoading, setSecurityLoading] = useState(true)
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState("")
  const [turnstileReset, setTurnstileReset] = useState(0)
  const onTurnstileToken = useCallback((token: string) => setTurnstileToken(token), [])
  const onTurnstileError = useCallback((message: string) => setError(message), [])

  useEffect(() => {
    let active = true
    void getAuthConfig().then((config) => {
      if (active) setTurnstileSiteKey(config.turnstileSiteKey)
    }).catch((caught) => {
      if (active) setError(caught instanceof Error ? caught.message : "Account security could not be loaded.")
    }).finally(() => {
      if (active) setSecurityLoading(false)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (signup) trackEvent("signup_started")
  }, [signup])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError("")
    setNotice("")
    if (signup && !accepted) {
      setError("Accept the Terms and Privacy Policy to create an account.")
      return
    }
    setPending(true)
    try {
      if (signup) {
        const result = await registerAccount(name, email, password, turnstileToken || undefined)
        setNotice(result.emailSent
          ? "Check your inbox for a verification link. It expires in one hour."
          : "Your account was created, but email delivery is not ready. Use resend after mail is configured.")
      } else {
        await loginAccount(email, password, turnstileToken || undefined)
        await onAuthenticated()
        navigate("/account")
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Account request failed. Please try again.")
      if (turnstileSiteKey) setTurnstileReset((value) => value + 1)
    } finally {
      setPending(false)
    }
  }

  async function resend() {
    setError("")
    try {
      const result = await resendVerification(email)
      setNotice(result.message || "If that account exists, a new email is on its way.")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not resend verification.")
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-intro">
        <a className="text-link" href="/">← Back home</a>
        <span className="eyebrow">Your ResuMate account</span>
        <h1>{signup ? "Keep your career workspace ready." : "Welcome back."}</h1>
        <p>{signup
          ? "Create a verified account for plan access and future sync options. Your existing browser resumes stay exactly where they are."
          : "Sign in to manage your account and upgrade path. Resume editing continues to work from this browser."}</p>
        <div className="auth-assurance">
          <strong>Browser-first by design</strong>
          <p>Creating an account does not upload your locally saved resumes. Cloud sync is not active yet.</p>
        </div>
      </section>
      <section className="auth-panel" aria-labelledby="auth-title">
        <h2 id="auth-title">{signup ? "Create account" : "Sign in"}</h2>
        <p>{signup ? "No credit card. Verify your email to finish." : "Use your verified email address."}</p>
        <form onSubmit={submit}>
          {signup && <label className="field"><span className="field-label">Name</span><input className="field-input" name="name" autoComplete="name" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></label>}
          <label className="field"><span className="field-label">Email</span><input className="field-input" name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label className="field"><span className="field-label">Password</span><input className="field-input" name="password" type="password" autoComplete={signup ? "new-password" : "current-password"} required minLength={10} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /><span className="field-help">At least 10 characters.</span></label>
          {signup && <label className="auth-consent"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>I agree to the <a href="/tos">Terms</a> and acknowledge the <a href="/privacy">Privacy Policy</a>.</span></label>}
          {turnstileSiteKey && (
            <TurnstileWidget
              siteKey={turnstileSiteKey}
              action={signup ? "signup" : "login"}
              resetVersion={turnstileReset}
              onToken={onTurnstileToken}
              onError={onTurnstileError}
            />
          )}
          {error && <p className="form-message error" role="alert">{error}</p>}
          {notice && <p className="form-message success" role="status">{notice}</p>}
          <button className="btn-primary large auth-submit" disabled={pending || securityLoading || Boolean(turnstileSiteKey && !turnstileToken)}>{pending ? "Working…" : securityLoading ? "Loading security…" : signup ? "Create verified account" : "Sign in"}</button>
        </form>
        {!signup && <button className="text-button" type="button" onClick={resend}>Resend verification email</button>}
        <p className="auth-switch">{signup ? "Already have an account?" : "New to ResuMate?"} <a href={signup ? "/login" : "/signup"}>{signup ? "Sign in" : "Create an account"}</a></p>
      </section>
    </div>
  )
}
