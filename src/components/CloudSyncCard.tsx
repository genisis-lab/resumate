import { useEffect, useState } from "react"
import { Cloud, CloudOff, KeyRound, Lock, RefreshCw, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import type { AccountUser } from "../lib/auth"
import { openUpgrade, upgradePromptViewed } from "../lib/analytics"
import { disableSync, enableSync, fetchVault, readSyncState, type RemoteVault } from "../lib/sync"
import { runSync, syncSettingsChanged, useSyncStatus } from "../hooks/useCloudSync"
import { confirmDialog } from "./ui/dialogs"

const MIN_PASSPHRASE = 12

function ago(at: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000))
  if (seconds < 45) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

// Opt-in, end-to-end encrypted sync. Off unless the user turns it on here.
export function CloudSyncCard({ user }: { user: AccountUser }) {
  const status = useSyncStatus()
  const isPro = user.plan === "pro" || user.isAdmin
  const [remote, setRemote] = useState<{ vault: RemoteVault | null; canWrite: boolean } | null>(null)
  const [form, setForm] = useState(false)
  const [passphrase, setPassphrase] = useState("")
  const [confirm, setConfirm] = useState("")
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const enabledHere = Boolean(readSyncState())

  useEffect(() => {
    let active = true
    void fetchVault().then((value) => { if (active) setRemote(value) }).catch(() => { if (active) setRemote(null) })
    return () => { active = false }
  }, [status.kind])

  useEffect(() => {
    if (!isPro) upgradePromptViewed("sync", { plan: user.plan })
  }, [isPro, user.plan])

  const creating = !remote?.vault
  const unlocking = status.kind === "locked"

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError("")
    if (passphrase.length < MIN_PASSPHRASE) return setError(`Use at least ${MIN_PASSPHRASE} characters. A few unrelated words work well.`)
    if (creating && passphrase !== confirm) return setError("The passphrases do not match.")
    setBusy(true)
    try {
      const result = await enableSync(user.id, passphrase, remember)
      syncSettingsChanged()
      await runSync(user.id)
      setForm(false)
      setPassphrase("")
      setConfirm("")
      toast.success(creating ? "Encrypted sync is on" : "Sync unlocked on this device", {
        description: result.pulled.length ? `${result.pulled.length} item${result.pulled.length === 1 ? "" : "s"} updated from your other devices.` : "Your workspace is up to date.",
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not turn on sync.")
    } finally {
      setBusy(false)
    }
  }

  async function turnOff() {
    if (!(await confirmDialog({ title: "Turn off sync on this device?", description: "Your resumes stay in this browser and your synced copy stays encrypted on the server for your other devices.", confirmLabel: "Turn off here" }))) return
    await disableSync(user.id, false)
    syncSettingsChanged()
    toast.message("Sync is off on this device")
  }

  async function erase() {
    if (!(await confirmDialog({ title: "Erase your synced copy?", description: "This deletes the encrypted copy from our servers and turns sync off on every device the next time it checks in. Resumes saved in each browser are not touched.", confirmLabel: "Erase synced copy", tone: "danger" }))) return
    setBusy(true)
    try {
      await disableSync(user.id, true)
      syncSettingsChanged()
      setRemote({ vault: null, canWrite: isPro })
      toast.success("Synced copy erased")
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not erase the synced copy.")
    } finally {
      setBusy(false)
    }
  }

  const statusLine = status.kind === "synced" ? `Synced ${ago(status.at)}`
    : status.kind === "syncing" ? "Syncing…"
    : status.kind === "error" ? status.message
    : status.kind === "locked" ? "Locked on this device"
    : remote?.vault ? `Synced copy last updated ${ago(remote.vault.updatedAt)}${remote.vault.deviceLabel ? ` from ${remote.vault.deviceLabel}` : ""}` : "Off"

  if (!isPro && !remote?.vault) {
    return (
      <section className="account-card account-data sync-card">
        <span className="account-label">Resume storage</span>
        <h2>Saved on this device</h2>
        <p>Your resumes have not been uploaded. Pro adds optional, end-to-end encrypted sync, so you can pick up on another device without us being able to read your resumes.</p>
        <button className="btn-ghost" onClick={() => openUpgrade("sync", { plan: user.plan })}><Lock size={15} aria-hidden="true" /> Sync with Pro</button>
      </section>
    )
  }

  return (
    <section className="account-card account-data sync-card">
      <span className="account-label">Encrypted sync · optional</span>
      <h2 className="sync-title">{enabledHere ? <Cloud size={18} aria-hidden="true" /> : <CloudOff size={18} aria-hidden="true" />} {enabledHere ? "Sync is on" : "Sync is off"}</h2>
      <p className={`sync-status ${status.kind === "error" ? "error" : ""}`} aria-live="polite">{statusLine}</p>
      {!enabledHere && !form && (
        <>
          <ul className="sync-points">
            <li><ShieldCheck size={15} aria-hidden="true" /> Encrypted in your browser before upload. We store only ciphertext.</li>
            <li><KeyRound size={15} aria-hidden="true" /> Your passphrase never leaves this device and cannot be recovered by us.</li>
            <li><RefreshCw size={15} aria-hidden="true" /> Resumes, saved job posts, and applications stay in step across devices.</li>
          </ul>
          <div className="sync-actions">
            {(isPro || remote?.vault) && <button className="btn-primary" onClick={() => { setForm(true); setError("") }}>{remote?.vault ? "Turn on with my passphrase" : "Turn on encrypted sync"}</button>}
            {remote?.vault && <button className="btn-ghost danger" disabled={busy} onClick={() => void erase()}>Erase synced copy</button>}
            {!isPro && <button className="btn-ghost" onClick={() => openUpgrade("sync", { plan: user.plan })}>Renew Pro to keep syncing</button>}
          </div>
        </>
      )}
      {(form || unlocking) && (
        <form className="sync-form" onSubmit={(event) => void submit(event)}>
          <label className="field"><span className="field-label">{creating ? "Create a sync passphrase" : "Sync passphrase"}</span>
            <input className="field-input" type="password" autoComplete={creating ? "new-password" : "current-password"} minLength={MIN_PASSPHRASE} maxLength={200} value={passphrase} onChange={(event) => setPassphrase(event.target.value)} autoFocus />
          </label>
          {creating && <label className="field"><span className="field-label">Confirm passphrase</span>
            <input className="field-input" type="password" autoComplete="new-password" minLength={MIN_PASSPHRASE} maxLength={200} value={confirm} onChange={(event) => setConfirm(event.target.value)} />
          </label>}
          <label className="check-row"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Remember on this device</label>
          <p className="sync-warning">{creating
            ? "Use something different from your account password. If you forget it, your synced copy cannot be decrypted — resumes saved in each browser are unaffected."
            : "Enter the passphrase you chose when you turned on sync on your first device."}</p>
          {error && <p className="form-message error" role="alert">{error}</p>}
          <div className="sync-actions">
            <button className="btn-primary" type="submit" disabled={busy}>{busy ? "Encrypting…" : creating ? "Encrypt and sync" : "Unlock sync"}</button>
            {!unlocking && <button className="btn-ghost" type="button" onClick={() => setForm(false)}>Cancel</button>}
          </div>
        </form>
      )}
      {enabledHere && !unlocking && (
        <div className="sync-actions">
          <button className="btn-ghost" disabled={status.kind === "syncing"} onClick={() => void runSync(user.id)}><RefreshCw size={15} aria-hidden="true" /> Sync now</button>
          <button className="btn-ghost" onClick={() => void turnOff()}>Turn off here</button>
          <button className="btn-ghost danger" disabled={busy} onClick={() => void erase()}>Erase synced copy</button>
        </div>
      )}
    </section>
  )
}
