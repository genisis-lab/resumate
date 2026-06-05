// Shareable read-only links. The full resume is encoded into a URL-safe base64
// string in the query (?r=...). No server, no database — the recipient's
// browser decodes it locally. Good for sharing a draft or importing across
// devices without an account.

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
  return `${base}?r=${encodeResume(r)}`
}

// Read a shared resume payload from the current URL, if present.
export function readSharedResume(): Resume | null {
  try {
    const params = new URLSearchParams(window.location.search)
    const s = params.get("r")
    if (!s) return null
    return decodeResume(s)
  } catch {
    return null
  }
}

// Remove the ?r= payload from the address bar after we've consumed it, keeping
// the hash route intact.
export function clearShareParam(): void {
  try {
    const u = new URL(window.location.href)
    u.searchParams.delete("r")
    window.history.replaceState({}, "", u.toString())
  } catch {
    /* ignore */
  }
}
