import {
  type BillingEnv,
  type InternalPaidPlan,
  createWhopCheckout,
} from "../../../server/billing"
import { enforcePostAndOrigin, readBoundedJson, requestError, text } from "../../../server/ai-proxy"

async function handle(request: Request, env: BillingEnv): Promise<Response> {
  const blocked = enforcePostAndOrigin(request)
  if (blocked) return blocked
  try {
    const body = await readBoundedJson<{ plan?: unknown }>(request)
    const plan = body?.plan
    if (plan !== "sprint" && plan !== "pro") return text("Choose Career Sprint or Pro", 400)
    return await createWhopCheckout(request, env, plan as InternalPaidPlan)
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    console.error("checkout_exception", {
      name: error instanceof Error ? error.name : "unknown",
      database: /D1_ERROR|SQLITE|no such table|no such column/.test(message),
      redirect: /redirect/i.test(message),
      timeout: /timeout|timed out/i.test(message),
      fetch: /fetch/i.test(message),
      json: /JSON|Unexpected token/i.test(message),
    })
    return requestError(error)
  }
}

export const onRequest: PagesFunction<BillingEnv> = ({ request, env }) => handle(request, env)
