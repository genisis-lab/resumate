import { BROWSER_EVENTS, browserMetadata, trackConversion, type ConversionEvent } from "../../../server/analytics"
import { enforcePostAndOrigin, readBoundedJson, requestError, text } from "../../../server/ai-proxy"
import { overRateLimit, visitorKey, type VisitorEnv } from "../../../server/visitor"

type AnalyticsEnv = Cloudflare.Env & VisitorEnv

// Anonymous, aggregate funnel events. No user id, IP, or free text is stored.
export const onRequest: PagesFunction<AnalyticsEnv> = async ({ request, env }) => {
  const blocked = enforcePostAndOrigin(request)
  if (blocked) return blocked
  try {
    const body = await readBoundedJson<Record<string, unknown>>(request)
    if (!body || typeof body.event !== "string" || !BROWSER_EVENTS.has(body.event as ConversionEvent)) return text("Unsupported event", 400)
    if (await overRateLimit(env.DB, `analytics:${await visitorKey(request, env, "analytics")}`, 120, 60 * 60 * 1_000)) {
      return new Response(null, { status: 204 })
    }
    await trackConversion(env, body.event as ConversionEvent, null, browserMetadata(body))
    return new Response(null, { status: 204 })
  } catch (error) {
    return requestError(error)
  }
}
