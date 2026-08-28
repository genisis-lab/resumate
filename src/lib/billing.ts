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
  sprint: ["resume:versions", "ats:expanded", "export:all", "templates:all"],
  pro: ["resume:versions", "ats:expanded", "export:all", "templates:all", "account:sync"],
}
