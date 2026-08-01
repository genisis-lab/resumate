// Shareable read-only links. The full resume is encoded into a URL-safe base64
// string in the URL fragment, so it is not sent in ordinary HTTP requests or
// referrer headers. No server or database is involved. The payload is encoded,
// not encrypted, so anyone with the link can read it.

import { Resume } from "../types/resume"

function toBase64Url(s: string): string {
  const b64 = btoa(unescape(encodeURIComponent(s)))
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/")
  return decodeURIComponent(escape(atob(b64)))
}

export function encodeResume(r: Resume): string {
  return toBase64Url(JSON.stringify(r))
}

export function decodeResume(s: string): Resume | null {
  try {
    const r = JSON.parse(fromBase64Url(s)) as Resume
    if (r && typeof r === "object" && r.contact && r.settings) return r
    return null
  } catch {
    return null
  }
}

export function buildShareUrl(r: Resume): string {
  const base = window.location.origin + window.location.pathname
  return `${base}#/share?r=${encodeResume(r)}`
}

// Read a shared resume payload from the current URL, if present.
export function readSharedResume(): Resume | null {
  try {
    const hash = window.location.hash
    const hashQuery = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : ""
    const hashPayload = new URLSearchParams(hashQuery).get("r")
    // Keep accepting legacy query links so previously shared resumes still
    // import, while all newly generated links use the fragment format.
    const s = hashPayload || new URLSearchParams(window.location.search).get("r")
    if (!s) return null
    return decodeResume(s)
  } catch {
    return null
  }
}

// Remove a share payload from the address bar after it has been consumed.
export function clearShareParam(): void {
  try {
    window.history.replaceState({}, "", `${window.location.origin}${window.location.pathname}`)
  } catch {
    /* ignore */
  }
}
