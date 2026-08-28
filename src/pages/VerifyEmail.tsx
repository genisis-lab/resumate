import { useEffect, useState } from "react"
import { verifyAccountEmail } from "../lib/auth"
import { navigate } from "../router"

export function VerifyEmail({ onVerified }: { onVerified: () => Promise<void> }) {
  const [state, setState] = useState<"working" | "done" | "error">("working")
  const [message, setMessage] = useState("Verifying your email…")
  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token") || ""
    void verifyAccountEmail(token).then(async () => {
      await onVerified()
      window.history.replaceState({}, "", "/verify-email")
      setState("done")
      setMessage("Your email is verified and your account is ready.")
    }).catch((error: unknown) => {
      setState("error")
      setMessage(error instanceof Error ? error.message : "This verification link could not be used.")
    })
  }, [onVerified])
  return (
    <div className="status-page">
      <div className={`status-mark ${state}`} aria-hidden="true">{state === "working" ? "…" : state === "done" ? "✓" : "×"}</div>
      <h1>{state === "done" ? "Email verified" : state === "error" ? "Verification failed" : "One moment"}</h1>
      <p role="status">{message}</p>
      {state === "done" && <button className="btn-primary large" onClick={() => navigate("/account")}>Open your account</button>}
      {state === "error" && <button className="btn-primary large" onClick={() => navigate("/login")}>Return to sign in</button>}
    </div>
  )
}
