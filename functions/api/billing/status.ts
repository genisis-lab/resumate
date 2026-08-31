import { type BillingEnv, verifiedSessionUser } from "../../../server/billing"
import { json, text } from "../../../server/ai-proxy"

type SubscriptionRow = {
  provider: string
  internalPlan: "sprint" | "pro"
  status: string
  currentPeriodEnd: number | null
  cancelAtPeriodEnd: number
}

export const onRequest: PagesFunction<BillingEnv> = async ({ request, env }) => {
  if (request.method !== "GET") return text("Method not allowed", 405, { Allow: "GET" })
  try {
    const user = await verifiedSessionUser(request, env)
    if (!user) return text("Sign in to view billing", 401)
    const subscription = await env.DB.prepare(
      `SELECT provider, internal_plan AS internalPlan, status,
              current_period_end AS currentPeriodEnd,
              cancel_at_period_end AS cancelAtPeriodEnd
       FROM billing_subscriptions
       WHERE user_id = ? AND provider = 'whop'`,
    ).bind(user.id).first<SubscriptionRow>()
    return json({
      subscription: subscription ? {
        provider: subscription.provider,
        plan: subscription.internalPlan,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd === 1,
        manageUrl: "https://whop.com/@me/settings/memberships/",
      } : null,
    })
  } catch (error) {
    console.error(JSON.stringify({ event: "billing_status_failed", reason: error instanceof Error ? error.name : "unknown" }))
    return text("Billing status is unavailable", 503)
  }
}
