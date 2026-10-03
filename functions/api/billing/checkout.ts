import {
  type BillingEnv,
  type InternalPaidPlan,
  createWhopCheckout,
} from "../../../server/billing"
import { enforcePostAndOrigin, readBoundedJson, requestError, text } from "../../../server/ai-proxy"
import { upgradeSource } from "../../../server/analytics"

async function handle(request: Request, env: BillingEnv): Promise<Response> {
  const blocked = enforcePostAndOrigin(request)
  if (blocked) return blocked
  try {
    const body = await readBoundedJson<{ plan?: unknown; source?: unknown }>(request)
    const plan = body?.plan
    if (plan !== "sprint" && plan !== "pro") return text("Choose Career Sprint or Pro", 400)
    return await createWhopCheckout(request, env, plan as InternalPaidPlan, upgradeSource(body?.source))
  } catch (error) {
    return requestError(error)
  }
}

export const onRequest: PagesFunction<BillingEnv> = ({ request, env }) => handle(request, env)
