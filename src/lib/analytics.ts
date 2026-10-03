import { navigate } from "../router"

export type BrowserConversionEvent =
  | "landing_view"
  | "signup_started"
  | "pricing_view"
  | "template_previewed"
  | "upgrade_prompt_viewed"
  | "upgrade_prompt_clicked"
  | "ai_action_completed"
  | "export_completed"
  | "export_blocked"

// Where an upgrade prompt was shown. Kept in sync with server/analytics.ts.
export type UpgradeSource =
  | "export_premium_template"
  | "export_limit"
  | "ats_limit"
  | "ai_locked"
  | "ai_limit"
  | "template_gallery"
  | "builder_template"
  | "builder_banner"
  | "account"
  | "landing"
  | "nav"
  | "sync"
  | "languages"

export interface EventDetails {
  source?: UpgradeSource
  template?: string
  plan?: "free" | "sprint" | "pro"
  format?: "pdf" | "docx" | "txt"
}

const SOURCE_KEY = "resumate.upgrade-source"

// Aggregate, anonymous counts only: the server accepts enumerable labels and
// drops anything else, so no resume content can end up in analytics.
export function trackEvent(event: BrowserConversionEvent, details: EventDetails = {}): void {
  if (typeof fetch !== "function") return
  void fetch("/api/analytics/event", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event, ...details }),
    keepalive: true,
  }).catch(() => undefined)
}

export function upgradePromptViewed(source: UpgradeSource, details: Omit<EventDetails, "source"> = {}): void {
  trackEvent("upgrade_prompt_viewed", { ...details, source })
}

// Record the click, remember the source for checkout attribution, and open pricing.
export function openUpgrade(source: UpgradeSource, details: Omit<EventDetails, "source"> = {}): void {
  trackEvent("upgrade_prompt_clicked", { ...details, source })
  try {
    sessionStorage.setItem(SOURCE_KEY, source)
  } catch {
    // Attribution is optional.
  }
  navigate(`/pricing?from=${source}`)
}

export function upgradeSourceForCheckout(): UpgradeSource | undefined {
  const fromQuery = typeof location !== "undefined" ? new URLSearchParams(location.search).get("from") : null
  let stored: string | null = null
  try {
    stored = sessionStorage.getItem(SOURCE_KEY)
  } catch {
    stored = null
  }
  const value = fromQuery || stored
  return value && /^[a-z_]{3,40}$/.test(value) ? value as UpgradeSource : undefined
}
