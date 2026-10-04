import { useEffect, useState } from "react"
import { confirmDialog } from "../components/ui/dialogs"
import type { AccountUser } from "../lib/auth"

type AdminOverview = {
  summary: { users: number; verified: number; sprint: number; pro: number; aiActions: number }
  users: Array<{ id: string; email: string; name: string; plan: string; emailVerifiedAt: number | null; createdAt: number; aiActions: number }>
  funnel: Array<{ eventName: string; count: number }>
  upgradeSources?: Array<{ source: string; eventName: string; count: number }>
  templates?: Array<{ template: string; eventName: string; count: number }>
  webhookFailures: Array<{ provider: string; eventId: string; eventType: string; errorCode: string; createdAt: number }>
  audits: Array<{ action: string; targetUserId: string; reason: string; createdAt: number }>
}

type SmokeCheck = { model: string; check: "structured" | "plain_text"; ok: boolean; latencyMs: number; preview: string; error?: string }
type SmokeResult = { precise: string; writing: string; ranAt: number; checks: SmokeCheck[] }

const SMOKE_MODELS = [
  ["", "Configured models"],
  ["all", "Every allowlisted model"],
  ["@cf/qwen/qwen3-30b-a3b-fp8", "Qwen3 30B"],
  ["@cf/openai/gpt-oss-120b", "gpt-oss-120b"],
  ["@cf/openai/gpt-oss-20b", "gpt-oss-20b"],
  ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "Llama 3.3 70B"],
  ["@cf/meta/llama-4-scout-17b-16e-instruct", "Llama 4 Scout"],
  ["@cf/ibm-granite/granite-4.0-h-micro", "Granite 4.0 Micro"],
] as const

function shortModel(model: string): string {
  return model.slice(model.lastIndexOf("/") + 1) || model
}

function AiSmokeTest() {
  const [model, setModel] = useState("")
  const [result, setResult] = useState<SmokeResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState("")

  async function run() {
    setRunning(true)
    setError("")
    try {
      const response = await fetch("/api/admin/ai-smoke", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(model ? { model } : {}),
      })
      if (!response.ok) throw new Error(await response.text() || "Smoke test failed.")
      setResult(await response.json() as SmokeResult)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Smoke test failed.")
    } finally {
      setRunning(false)
    }
  }

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div><span className="account-label">Hosted AI</span><h2>Model smoke test</h2></div>
        <div className="admin-smoke-controls">
          <select className="field-input" value={model} onChange={(event) => setModel(event.target.value)} aria-label="Models to test">
            {SMOKE_MODELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button className="btn-primary small" disabled={running} onClick={() => void run()}>{running ? "Running…" : "Run smoke test"}</button>
        </div>
      </div>
      <p className="muted">Sends a fixed, fictional resume through each model: one JSON summary that must use only listed skills, and one plain-text thank-you note. It uses a small number of neurons, never touches user data, and does not count against any plan. It skips fallback, so each model is judged on its own output.</p>
      {error && <p className="form-message error" role="alert">{error}</p>}
      {result && <>
        <p className="admin-smoke-config">Precise: <code>{shortModel(result.precise)}</code> · Writing: <code>{shortModel(result.writing)}</code> · {new Date(result.ranAt).toLocaleTimeString()}</p>
        <div className="admin-smoke-grid">
          {result.checks.map((check) => (
            <article key={`${check.model}-${check.check}`} className={`admin-smoke-card ${check.ok ? "ok" : "fail"}`}>
              <header><strong>{shortModel(check.model)}</strong><span>{check.check === "structured" ? "JSON summary" : "Plain text"}</span></header>
              <dl><div><dt>Result</dt><dd>{check.ok ? "Pass" : "Fail"}</dd></div><div><dt>Latency</dt><dd>{(check.latencyMs / 1000).toFixed(1)}s</dd></div></dl>
              {check.preview && <p>{check.preview}</p>}
              {check.error && <p className="form-message error">{check.error}</p>}
            </article>
          ))}
        </div>
      </>}
    </section>
  )
}

const EVENT_LABELS: Record<string, string> = {
  landing_view: "Landing views",
  signup_started: "Signup starts",
  signup_completed: "Accounts created",
  email_verified: "Emails verified",
  pricing_view: "Pricing views",
  checkout_started: "Checkout starts",
  checkout_created: "Checkout links",
  purchase_activated: "Paid activations",
  ai_action_completed: "AI actions",
  export_completed: "Exports",
  export_blocked: "Exports blocked",
  template_previewed: "Premium previews",
  upgrade_prompt_viewed: "Upgrade prompts shown",
  upgrade_prompt_clicked: "Upgrade prompts clicked",
  sync_enabled: "Sync turned on",
}

// Ordered acquisition-to-purchase path. Each step shows its share of the step before.
const FUNNEL_STEPS = ["landing_view", "signup_started", "signup_completed", "email_verified", "pricing_view", "checkout_started", "checkout_created", "purchase_activated"]
const ACTIVITY_EVENTS = ["ai_action_completed", "export_completed", "export_blocked", "template_previewed", "upgrade_prompt_viewed", "upgrade_prompt_clicked", "sync_enabled"]

const SOURCE_LABELS: Record<string, string> = {
  export_premium_template: "Premium template export",
  export_limit: "Free export limit",
  ats_limit: "Free ATS-check limit",
  ai_locked: "AI tools (Free)",
  ai_limit: "AI allowance used up",
  template_gallery: "Template gallery",
  builder_template: "Editor template picker",
  builder_banner: "Editor upgrade notice",
  account: "Account page",
  landing: "Landing page",
  nav: "Navigation",
  sync: "Cloud sync",
  languages: "Resume languages",
}

function pct(part: number, whole: number): string {
  if (!whole) return "—"
  const value = (part / whole) * 100
  return `${value >= 10 || value === 0 ? Math.round(value) : value.toFixed(1)}%`
}

function pivot<K extends string>(rows: Array<Record<K, string> & { eventName: string; count: number }> | undefined, key: K) {
  const table = new Map<string, Record<string, number>>()
  for (const row of rows || []) {
    const id = row[key]
    if (!id) continue
    const entry = table.get(id) || {}
    entry[row.eventName] = (entry[row.eventName] || 0) + Number(row.count)
    table.set(id, entry)
  }
  return [...table.entries()]
}

function FunnelChart({ counts }: { counts: Record<string, number> }) {
  const max = Math.max(1, ...FUNNEL_STEPS.map((step) => counts[step] || 0))
  return (
    <ol className="funnel-chart" aria-label="Acquisition to purchase funnel, last 30 days">
      {FUNNEL_STEPS.map((step, index) => {
        const count = counts[step] || 0
        const previous = index ? counts[FUNNEL_STEPS[index - 1]] || 0 : 0
        const share = index ? pct(count, previous) : ""
        const tip = index ? `${count.toLocaleString()} ${EVENT_LABELS[step].toLowerCase()} · ${share} of ${EVENT_LABELS[FUNNEL_STEPS[index - 1]].toLowerCase()}` : `${count.toLocaleString()} ${EVENT_LABELS[step].toLowerCase()}`
        return (
          <li key={step} className="funnel-row" tabIndex={0} aria-label={tip}>
            <span className="funnel-label">{EVENT_LABELS[step]}</span>
            <span className="funnel-track"><span className="funnel-bar" style={{ width: `${Math.max(count ? 1.5 : 0, (count / max) * 100)}%` }} /></span>
            <span className="funnel-value">{count.toLocaleString()}</span>
            <span className="funnel-step">{share}</span>
            <span className="funnel-tip" role="tooltip">{tip}</span>
          </li>
        )
      })}
    </ol>
  )
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
    if (!(await confirmDialog({ title: `Sign out every active session for ${target.email}?`, description: "The user will need to sign in again on every device.", confirmLabel: "Revoke sessions", tone: "danger" }))) return
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

  const counts = Object.fromEntries((data?.funnel || []).map((event) => [event.eventName, Number(event.count)]))
  const sources = pivot(data?.upgradeSources, "source").sort((a, b) => (b[1].upgrade_prompt_viewed || 0) - (a[1].upgrade_prompt_viewed || 0))
  const templateRows = pivot(data?.templates, "template").sort((a, b) => (b[1].template_previewed || 0) - (a[1].template_previewed || 0))

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
          {data.funnel.length ? <>
            <FunnelChart counts={counts} />
            <div className="admin-funnel">{ACTIVITY_EVENTS.map((name) => <div key={name}><span>{EVENT_LABELS[name]}</span><strong>{(counts[name] || 0).toLocaleString()}</strong></div>)}</div>
          </> : <p className="muted">No conversion events recorded yet.</p>}
        </section>
        <section className="admin-section">
          <div className="admin-section-head"><div><span className="account-label">Last 30 days · by placement</span><h2>Upgrade prompts</h2></div></div>
          {sources.length ? (
            <div className="admin-table-wrap"><table className="admin-table">
              <thead><tr><th scope="col">Placement</th><th scope="col">Shown</th><th scope="col">Clicked</th><th scope="col">Click rate</th><th scope="col">Checkouts</th><th scope="col">Purchases</th></tr></thead>
              <tbody>{sources.map(([source, row]) => <tr key={source}><th scope="row">{SOURCE_LABELS[source] || source}</th><td>{row.upgrade_prompt_viewed || 0}</td><td>{row.upgrade_prompt_clicked || 0}</td><td>{pct(row.upgrade_prompt_clicked || 0, row.upgrade_prompt_viewed || 0)}</td><td>{row.checkout_started || 0}</td><td>{row.purchase_activated || 0}</td></tr>)}</tbody>
            </table></div>
          ) : <p className="muted">No upgrade prompts recorded yet. They appear when Free users hit a limit or a Premium feature.</p>}
          {templateRows.length > 0 && <>
            <h3 className="admin-subhead">Templates</h3>
            <div className="admin-table-wrap"><table className="admin-table">
              <thead><tr><th scope="col">Template</th><th scope="col">Premium previews on Free</th><th scope="col">Upgrade clicks</th><th scope="col">Exports</th></tr></thead>
              <tbody>{templateRows.map(([template, row]) => <tr key={template}><th scope="row">{template}</th><td>{row.template_previewed || 0}</td><td>{row.upgrade_prompt_clicked || 0}</td><td>{row.export_completed || 0}</td></tr>)}</tbody>
            </table></div>
          </>}
        </section>
        <AiSmokeTest />
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
