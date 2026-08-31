import { useEffect, useState } from "react"
import type { AccountUser } from "../lib/auth"

type AdminOverview = {
  summary: { users: number; verified: number; sprint: number; pro: number; aiActions: number }
  users: Array<{ id: string; email: string; name: string; plan: string; emailVerifiedAt: number | null; createdAt: number; aiActions: number }>
  funnel: Array<{ eventName: string; count: number }>
  webhookFailures: Array<{ provider: string; eventId: string; eventType: string; errorCode: string; createdAt: number }>
  audits: Array<{ action: string; targetUserId: string; reason: string; createdAt: number }>
}

const EVENT_LABELS: Record<string, string> = {
  landing_view: "Landing views",
  signup_started: "Signup starts",
  signup_completed: "Accounts created",
  email_verified: "Emails verified",
  checkout_started: "Checkout starts",
  checkout_created: "Checkout links",
  purchase_activated: "Paid activations",
  ai_action_completed: "AI activations",
}

export function Admin({ user }: { user: AccountUser | null }) {
  const [data, setData] = useState<AdminOverview | null>(null)
  const [error, setError] = useState("")
  const [target, setTarget] = useState<AdminOverview["users"][number] | null>(null)
  const [reason, setReason] = useState("")
  const [pending, setPending] = useState(false)

  async function load() {
    setError("")
    try {
      const response = await fetch("/api/admin/overview", { credentials: "same-origin" })
      if (!response.ok) throw new Error(response.status === 403 ? "This account is not authorized for the admin console." : "Admin data is temporarily unavailable.")
      setData(await response.json() as AdminOverview)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Admin data is temporarily unavailable.")
    }
  }

  useEffect(() => { if (user?.isAdmin) void load() }, [user?.isAdmin])

  async function revoke() {
    if (!target || reason.trim().length < 10) {
      setError("Add a support reason of at least 10 characters.")
      return
    }
    if (!confirm(`Sign out every active session for ${target.email}?`)) return
    setPending(true)
    setError("")
    try {
      const response = await fetch("/api/admin/revoke-sessions", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetUserId: target.id, reason: reason.trim(), confirmation: "REVOKE" }),
      })
      if (!response.ok) throw new Error(await response.text() || "Support action failed.")
      setTarget(null)
      setReason("")
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Support action failed.")
    } finally {
      setPending(false)
    }
  }

  if (!user?.isAdmin) return <div className="status-page"><h1>Admin console</h1><p>This page is restricted to a verified owner account.</p></div>
  return (
    <div className="admin-page">
      <header className="admin-head"><span className="eyebrow">Owner console</span><h1>ResuMate operations</h1><p>Account health, paid access, AI usage, conversion signals, and audited support controls. Resume and job-description content is never shown here.</p></header>
      {error && <p className="form-message error" role="alert">{error}</p>}
      {!data && !error && <p className="muted">Loading operational data…</p>}
      {data && <>
        <section className="admin-stats" aria-label="Account overview">
          <article><span>Accounts</span><strong>{data.summary.users}</strong></article>
          <article><span>Verified</span><strong>{data.summary.verified}</strong></article>
          <article><span>Paid</span><strong>{data.summary.sprint + data.summary.pro}</strong></article>
          <article><span>AI actions this month</span><strong>{data.summary.aiActions}</strong></article>
        </section>
        <section className="admin-section">
          <div className="admin-section-head"><div><span className="account-label">Last 30 days</span><h2>Conversion path</h2></div><button className="btn-ghost small" onClick={() => void load()}>Refresh</button></div>
          <div className="admin-funnel">{data.funnel.length ? data.funnel.map((event) => <div key={event.eventName}><span>{EVENT_LABELS[event.eventName] || event.eventName}</span><strong>{event.count}</strong></div>) : <p className="muted">No conversion events recorded yet.</p>}</div>
        </section>
        <section className="admin-section">
          <div className="admin-section-head"><div><span className="account-label">Verified identity and plans</span><h2>Recent accounts</h2></div><span>{data.users.length} shown</span></div>
          <div className="admin-users">{data.users.map((account) => <article key={account.id} className="admin-user-card"><div><strong>{account.name}</strong><span>{account.email}</span></div><dl><div><dt>Plan</dt><dd>{account.plan}</dd></div><div><dt>Verified</dt><dd>{account.emailVerifiedAt ? "Yes" : "No"}</dd></div><div><dt>AI this month</dt><dd>{account.aiActions}</dd></div></dl><button className="btn-ghost small" disabled={account.id === user.id} onClick={() => { setTarget(account); setReason("") }}>Support action</button></article>)}</div>
        </section>
        {target && <section className="admin-support" aria-labelledby="support-action-title"><div><span className="account-label">Audited support action</span><h2 id="support-action-title">Revoke sessions for {target.email}</h2><p>This signs the account out on every device. It does not delete the account, change a plan, or view resume data.</p></div><label className="field"><span className="field-label">Reason</span><input className="field-input" maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. User reported a lost device" /></label><div><button className="btn-ghost danger" disabled={pending} onClick={() => void revoke()}>{pending ? "Revoking…" : "Revoke all sessions"}</button><button className="btn-ghost" onClick={() => setTarget(null)}>Cancel</button></div></section>}
        <section className="admin-section two-up"><div><span className="account-label">Webhook health</span><h2>Unresolved failures</h2>{data.webhookFailures.length ? <ul className="admin-log">{data.webhookFailures.map((failure) => <li key={failure.eventId}><strong>{failure.eventType}</strong><span>{failure.errorCode} · {new Date(failure.createdAt).toLocaleString()}</span></li>)}</ul> : <p className="muted">No unresolved processing failures.</p>}</div><div><span className="account-label">Support audit</span><h2>Recent actions</h2>{data.audits.length ? <ul className="admin-log">{data.audits.map((audit, index) => <li key={`${audit.createdAt}-${index}`}><strong>{audit.action.replace(/_/g, " ")}</strong><span>{audit.reason} · {new Date(audit.createdAt).toLocaleString()}</span></li>)}</ul> : <p className="muted">No support actions recorded.</p>}</div></section>
      </>}
    </div>
  )
}
