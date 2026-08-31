import { useEffect, useState } from "react"
import { AccountUser, deleteAccount, logoutAccount } from "../lib/auth"
import { navigate } from "../router"

export function Account({ user, onChanged }: { user: AccountUser | null; onChanged: () => Promise<void> }) {
  const [error, setError] = useState("")
  const [showDelete, setShowDelete] = useState(false)
  const [deletePassword, setDeletePassword] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [aiUsage, setAiUsage] = useState<{ limit: number | null; used: number; remaining: number | null; resetsAt: string; unlimited?: boolean } | null>(null)
  const [billing, setBilling] = useState<{ plan: "sprint" | "pro"; status: string; currentPeriodEnd: number | null; cancelAtPeriodEnd: boolean; manageUrl: string } | null>(null)
  useEffect(() => {
    if (!user) {
      setAiUsage(null)
      setBilling(null)
      return
    }
    let active = true
    void fetch("/api/ai/usage", { credentials: "same-origin" })
      .then(async (response) => response.ok ? await response.json() as typeof aiUsage : null)
      .then((usage) => { if (active) setAiUsage(usage) })
      .catch(() => { if (active) setAiUsage(null) })
    void fetch("/api/billing/status", { credentials: "same-origin" })
      .then(async (response) => response.ok ? await response.json() as { subscription?: typeof billing } : null)
      .then((result) => { if (active) setBilling(result?.subscription || null) })
      .catch(() => { if (active) setBilling(null) })
    return () => { active = false }
  }, [user])
  if (!user) {
    return <div className="status-page"><h1>Your account</h1><p>Sign in to view plan and account details.</p><button className="btn-primary large" onClick={() => navigate("/login")}>Sign in</button></div>
  }
  async function signOut() {
    await logoutAccount()
    await onChanged()
    navigate("/")
  }
  async function remove() {
    if (!deletePassword) {
      setError("Enter your password to delete your account.")
      return
    }
    if (!confirm("Delete your ResuMate account? This cannot be undone. Resumes saved in this browser will remain unless you clear them separately.")) return
    setDeleting(true)
    try {
      await deleteAccount(deletePassword)
      await onChanged()
      navigate("/")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete your account.")
      setDeleting(false)
    }
  }
  return (
    <div className="account-page">
      <header className="account-head"><span className="eyebrow">Account</span><h1>Good to have you here, {user.name.split(" ")[0]}.</h1><p>Manage your verified identity and see what your current plan includes.</p></header>
      <div className="account-grid">
        <section className="account-card"><span className="account-label">Profile</span><h2>{user.name}</h2><p>{user.email}</p><span className="verified-line">✓ Email verified</span></section>
        <section className="account-card account-plan">
          <span className="account-label">Current plan</span>
          <h2>{user.isAdmin ? "Admin" : user.plan === "sprint" ? "Career Sprint" : user.plan === "pro" ? "Pro" : "Free"}</h2>
          <p>{user.isAdmin
            ? "Owner access includes every premium feature and unlimited monthly hosted AI actions. Security and burst protections still apply."
            : user.plan === "free"
            ? "Core browser editor, local ATS checks, and essential exports. No payment method is connected."
            : `Hosted AI allowance: ${aiUsage ? `${aiUsage.remaining} of ${aiUsage.limit} actions remain` : "loading…"}. One hosted request uses one action.`}</p>
          {aiUsage && aiUsage.limit !== null && aiUsage.limit > 0 && (
            <p className="account-allowance" aria-live="polite">
              Used {aiUsage.used} · resets {new Date(aiUsage.resetsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </p>
          )}
          {billing && (
            <div className="billing-summary">
              <strong>{billing.cancelAtPeriodEnd ? "Cancellation scheduled" : "Billing active"}</strong>
              <span>{billing.currentPeriodEnd ? `${billing.cancelAtPeriodEnd ? "Access through" : "Renews or ends"} ${new Date(billing.currentPeriodEnd).toLocaleDateString()}` : `Status: ${billing.status.replace(/_/g, " ")}`}</span>
              <a className="btn-primary" href={billing.manageUrl} target="_blank" rel="noreferrer">Manage billing on Whop</a>
            </div>
          )}
          {!billing && <button className="btn-primary" onClick={() => navigate("/pricing")}>See upgrade options</button>}
        </section>
        <section className="account-card account-data"><span className="account-label">Resume storage</span><h2>Saved on this device</h2><p>Your existing resumes have not been uploaded. Export a backup from the editor before clearing browser data.</p><button className="btn-ghost" onClick={() => navigate("/builder")}>Open editor</button></section>
      </div>
      <section className="account-actions">
        <h2>Account controls</h2>
        {error && <p className="error" role="alert">{error}</p>}
        <div>{user.isAdmin && <button className="btn-primary" onClick={() => navigate("/admin")}>Open admin console</button>}<button className="btn-ghost" onClick={signOut}>Sign out</button><button className="btn-ghost danger" onClick={() => { setError(""); setShowDelete((value) => !value) }}>Delete account</button></div>
        {showDelete && (
          <div className="delete-confirmation">
            <p>Enter your password to permanently remove your account. Resumes stored in this browser will not be deleted.</p>
            <label className="field"><span className="field-label">Current password</span><input className="field-input" type="password" autoComplete="current-password" minLength={10} maxLength={128} value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} /></label>
            <button className="btn-ghost danger" disabled={deleting} onClick={remove}>{deleting ? "Deleting…" : "Permanently delete account"}</button>
          </div>
        )}
      </section>
    </div>
  )
}
