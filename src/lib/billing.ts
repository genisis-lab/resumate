// Checkout is deliberately inactive. Future webhooks should map the one active
// provider's product IDs into these internal plans and never expose provider IDs
// as application entitlements.
export type PlanId = "free" | "sprint" | "pro"

export const BILLING_STATE = {
  checkoutEnabled: false,
  activeProvider: null as string | null,
}

export const PLAN_ENTITLEMENTS: Record<PlanId, readonly string[]> = {
  free: ["resume:local", "ats:local", "export:basic"],
  sprint: ["resume:versions", "ats:expanded", "ai:hosted", "export:all", "templates:all"],
  pro: ["resume:versions", "ats:expanded", "ai:hosted", "export:all", "templates:all", "account:sync"],
}

export const MONTHLY_AI_ACTIONS: Record<PlanId, number> = {
  free: 0,
  sprint: 40,
  pro: 150,
}

export async function beginUpgrade(plan: Exclude<PlanId, "free">): Promise<void> {
  if (!BILLING_STATE.checkoutEnabled || BILLING_STATE.activeProvider !== "whop") {
    throw new Error("Checkout is not open yet.")
  }
  const response = await fetch("/api/billing/checkout", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  })
  if (!response.ok) throw new Error(response.status === 401 ? "Sign in before upgrading." : "Checkout is temporarily unavailable.")
  const data: unknown = await response.json()
  const purchaseUrl = data && typeof data === "object" && !Array.isArray(data)
    ? (data as Record<string, unknown>).purchaseUrl
    : null
  if (typeof purchaseUrl !== "string") throw new Error("Checkout returned an invalid link.")
  const url = new URL(purchaseUrl)
  if (url.protocol !== "https:" || url.hostname !== "whop.com" || url.username || url.password) {
    throw new Error("Checkout returned an invalid link.")
  }
  window.location.assign(url.href)
}
