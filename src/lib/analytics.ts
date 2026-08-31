export type BrowserConversionEvent = "landing_view" | "signup_started" | "ai_action_completed"

export function trackEvent(event: BrowserConversionEvent): void {
  void fetch("/api/analytics/event", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event }),
    keepalive: true,
  }).catch(() => undefined)
}
