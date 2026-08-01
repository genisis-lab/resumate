import { useEffect, useRef, useState } from "react"
import { Resume } from "../types/resume"
import { buildShareUrl } from "../lib/share"

export function ShareModal({ resume, onClose }: { resume: Resume; onClose: () => void }) {
  const url = buildShareUrl(resume)
  const [qr, setQr] = useState("")
  const [qrError, setQrError] = useState("")
  const [copied, setCopied] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    let cancelled = false
    // @ts-ignore - qrcode types are optional
    import("qrcode")
      .then((mod: any) => {
        const QR = mod.default || mod
        return QR.toDataURL(url, { margin: 1, width: 220, errorCorrectionLevel: "L" })
      })
      .then((dataUrl: string) => {
        if (!cancelled) setQr(dataUrl)
      })
      .catch(() => {
        if (!cancelled)
          setQrError("This resume is a little large to fit in a QR code \u2014 use the copy link below instead.")
      })
    return () => {
      cancelled = true
    }
  }, [url])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      prompt("Copy this read-only share link:", url)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="share-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 id="share-title">Share resume</h2>
          <button ref={closeRef} className="icon-btn" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <p className="hint">
          Anyone with this read-only link can open a copy in their browser. Nothing is uploaded — the whole resume is encoded in the URL fragment.
        </p>
        <p className="hint share-warning"><strong>Public-link warning:</strong> this is encoded, not encrypted. Anyone who has the link can read the resume.</p>
        {url.length > 6000 && <p className="hint share-warning">This link is long and may not fit in every QR scanner. Copy the link instead.</p>}
        <div className="share-qr">
          {qr ? (
            <img src={qr} width={220} height={220} alt="QR code linking to this resume" />
          ) : qrError ? (
            <p className="error-text">{qrError}</p>
          ) : (
            <p className="hint">Generating QR code…</p>
          )}
        </div>
        <div className="share-url-row">
          <input
            className="field-input"
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Share link"
          />
          <button className="btn-primary small" onClick={copy}>{copied ? "Copied!" : "Copy link"}</button>
        </div>
      </div>
    </div>
  )
}
