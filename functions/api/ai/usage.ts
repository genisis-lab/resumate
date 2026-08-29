import { type AiEnv, hostedAiUsage, json, text } from "../../../server/ai-proxy"

export const onRequest: PagesFunction<AiEnv> = async ({ request, env }) => {
  if (request.method !== "GET") return text("Method not allowed", 405, { Allow: "GET" })
  try {
    const usage = await hostedAiUsage(request, env)
    if (!usage) return text("Sign in to view AI usage", 401)
    return json(usage)
  } catch (error) {
    console.error(JSON.stringify({ event: "ai_usage_failed", reason: error instanceof Error ? error.name : "unknown" }))
    return text("AI usage is unavailable", 503)
  }
}
