import { enforcePostAndOrigin, requestError, text, type AiEnv } from "../../../server/ai-proxy"
import { deleteVault, getVault, putVault } from "../../../server/sync"

// GET  /api/sync/vault   -> the encrypted vault (or null)
// POST /api/sync/vault   -> replace it on top of a known version (Pro)
// POST /api/sync/delete  -> erase the server copy
export const onRequest: PagesFunction<AiEnv> = async ({ request, env }) => {
  try {
    const action = new URL(request.url).pathname.split("/").filter(Boolean).at(-1)
    if (request.method === "GET" && action === "vault") return await getVault(request, env)
    if (action !== "vault" && action !== "delete") return text("Not found", 404)
    const blocked = enforcePostAndOrigin(request)
    if (blocked) return blocked
    return action === "vault" ? await putVault(request, env) : await deleteVault(request, env)
  } catch (error) {
    return requestError(error)
  }
}
