import { type BillingEnv, processWhopWebhook } from "../../../../server/billing"
import { text } from "../../../../server/ai-proxy"

export const onRequest: PagesFunction<BillingEnv> = async ({ request, env }) => {
  if (request.method !== "POST") return text("Method not allowed", 405, { Allow: "POST" })
  return processWhopWebhook(request, env)
}
