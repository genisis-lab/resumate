import { CONVERSION_EVENTS, trackConversion, type ConversionEvent } from "../../../server/analytics"
import { enforcePostAndOrigin, readBoundedJson, requestError, text } from "../../../server/ai-proxy"

type AnalyticsEnv = Cloudflare.Env
const BROWSER_EVENTS = new Set<ConversionEvent>(["landing_view", "signup_started", "ai_action_completed"])

export const onRequest: PagesFunction<AnalyticsEnv> = async ({ request, env }) => {
  const blocked = enforcePostAndOrigin(request)
  if (blocked) return blocked
  try {
    const body = await readBoundedJson<{ event?: unknown }>(request)
    if (typeof body?.event !== "string" || !CONVERSION_EVENTS.has(body.event as ConversionEvent)
      || !BROWSER_EVENTS.has(body.event as ConversionEvent)) return text("Unsupported event", 400)
    await trackConversion(env, body.event as ConversionEvent)
    return new Response(null, { status: 204 })
  } catch (error) {
    return requestError(error)
  }
}
