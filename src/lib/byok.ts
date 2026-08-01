// Bring-Your-Own-Key: store an optional user-provided AI API config in
// localStorage so the app can use supported providers without the site owner
// paying for BYOK usage. The key stays in this browser's storage, then is sent
// to ResuMate's same-origin proxy with the AI request and forwarded to the
// selected provider. It is never exposed to the site environment.

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
    const c = JSON.parse(raw) as Partial<AiConfig>
    if (!c || !c.key) return null
    return {
      key: c.key,
      url: c.url || AI_PRESETS[0].url,
      model: c.model || AI_PRESETS[0].model,
    }
  } catch {
    return null
  }
}

export function setAiConfig(cfg: AiConfig): void {
  try {
    localStorage.setItem(AI_KEY, JSON.stringify(cfg))
  } catch {
    /* ignore storage errors */
  }
}

export function clearAiConfig(): void {
  try {
    localStorage.removeItem(AI_KEY)
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
