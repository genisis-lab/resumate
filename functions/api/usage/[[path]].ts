import { enforcePostAndOrigin, json, readBoundedJson, requestError, text } from "../../../server/ai-proxy"
import { consumeFreeUsage, freeAction, readFreeUsage, type FreeUsageEnv } from "../../../server/free-usage"

// GET  /api/usage/free     -> this month's Free export and ATS-check counts
// POST /api/usage/consume  -> count one use, or refuse when the limit is reached
export const onRequest: PagesFunction<FreeUsageEnv> = async ({ request, env }) => {
  try {
    const action = new URL(request.url).pathname.split("/").filter(Boolean).at(-1)
    if (request.method === "GET" && action === "free") return json(await readFreeUsage(request, env))
    if (action !== "consume") return text("Not found", 404)
    const blocked = enforcePostAndOrigin(request)
    if (blocked) return blocked
    const body = await readBoundedJson<{ action?: unknown; localAllowed?: unknown }>(request)
    const kind = freeAction(body?.action)
    if (!kind) return text("Unknown usage action", 400)
    const result = await consumeFreeUsage(request, env, kind, body?.localAllowed !== false)
    return json(result, result.allowed ? 200 : 429)
  } catch (error) {
    return requestError(error)
  }
}
