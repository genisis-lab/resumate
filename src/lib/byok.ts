// Bring-Your-Own-Key: provider preferences may persist locally, but the secret
// itself lives only in sessionStorage so closing the tab clears it. Requests go
// through ResuMate's same-origin proxy and only to exact supported endpoints.

export interface AiConfig {
  key: string
  url: string
  model: string
}

export interface AiPreset {
  id: string
  label: string
  url: string
  model: string
  hint: string
}

const AI_KEY = "resumate.ai.v1"
const AI_SECRET_KEY = "resumate.ai.secret.v1"

export const AI_PRESETS: AiPreset[] = [
  {
    id: "openai",
    label: "OpenAI",
    url: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
    hint: "Most reliable. Paid usage, ~$0.15 / 1M tokens.",
  },
  {
    id: "groq",
    label: "Groq (free tier)",
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.3-70b-versatile",
    hint: "Generous free tier. Very fast. Great default for free AI.",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "meta-llama/llama-3.1-8b-instruct:free",
    hint: "Access many models, including free ones.",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    model: "gemini-2.0-flash",
    hint: "Free tier available from Google AI Studio.",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    url: "https://api.deepseek.com/v1/chat/completions",
    model: "deepseek-chat",
    hint: "Inexpensive, strong writing quality.",
  },
]

export function getAiConfig(): AiConfig | null {
  try {
    const raw = localStorage.getItem(AI_KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as Partial<AiConfig>
    if (!stored || typeof stored !== "object") return null

    // One-time migration removes keys saved by older releases from persistent
    // storage while preserving the current tab's session.
    let key = sessionStorage.getItem(AI_SECRET_KEY) || ""
    if (!key && typeof stored.key === "string" && stored.key.trim()) {
      key = stored.key.trim()
      sessionStorage.setItem(AI_SECRET_KEY, key)
      localStorage.setItem(AI_KEY, JSON.stringify({ url: stored.url, model: stored.model }))
    }
    const preset = AI_PRESETS.find((candidate) => candidate.url === stored.url) || AI_PRESETS[0]
    const model = typeof stored.model === "string" && /^[A-Za-z0-9._:/+-]{1,160}$/.test(stored.model)
      ? stored.model
      : preset.model
    if (!key) return null
    return {
      key,
      url: preset.url,
      model,
    }
  } catch {
    return null
  }
}

export function setAiConfig(cfg: AiConfig): void {
  try {
    const preset = AI_PRESETS.find((candidate) => candidate.url === cfg.url) || AI_PRESETS[0]
    sessionStorage.setItem(AI_SECRET_KEY, cfg.key.trim())
    localStorage.setItem(AI_KEY, JSON.stringify({ url: preset.url, model: cfg.model }))
  } catch {
    /* ignore storage errors */
  }
}

export function clearAiConfig(): void {
  try {
    localStorage.removeItem(AI_KEY)
    sessionStorage.removeItem(AI_SECRET_KEY)
  } catch {
    /* ignore storage errors */
  }
}

export function hasUserKey(): boolean {
  return getAiConfig() !== null
}

// Overrides merged into every /api/* request body. When the user has supplied
// their own key, the serverless function uses it instead of the site key.
export function aiClientOverrides(): Record<string, string> {
  const c = getAiConfig()
  if (!c) return {}
  return { clientKey: c.key, clientUrl: c.url, clientModel: c.model }
}
