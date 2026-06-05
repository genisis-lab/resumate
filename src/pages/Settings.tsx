import { useState } from "react"
import { AI_PRESETS, getAiConfig, setAiConfig, clearAiConfig } from "../lib/byok"

// Settings page: Bring-Your-Own-Key. Lets a visitor paste their own OpenAI-
// compatible API key so every AI feature works without the site owner paying.
// The key is stored only in this browser's localStorage and sent to the
// same-origin proxy with each request.
export function Settings() {
  const existing = getAiConfig()
  const [presetId, setPresetId] = useState<string>(() => {
    if (!existing) return "openai"
    const match = AI_PRESETS.find((p) => p.url === existing.url)
    return match ? match.id : "custom"
  })
  const [key, setKey] = useState(existing?.key || "")
  const [url, setUrl] = useState(existing?.url || AI_PRESETS[0].url)
  const [model, setModel] = useState(existing?.model || AI_PRESETS[0].model)
  const [saved, setSaved] = useState(false)

  function applyPreset(id: string) {
    setPresetId(id)
    const preset = AI_PRESETS.find((p) => p.id === id)
    if (preset) {
      setUrl(preset.url)
      setModel(preset.model)
    }
  }

  function onSave() {
    if (!key.trim()) {
      alert("Please paste an API key first.")
      return
    }
    setAiConfig({ key: key.trim(), url: url.trim(), model: model.trim() })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function onClear() {
    clearAiConfig()
    setKey("")
    setSaved(false)
    alert("Your API key has been removed from this browser.")
  }

  const activePreset = AI_PRESETS.find((p) => p.id === presetId)

  return (
    <div className="page narrow">
      <h1>Settings</h1>
      <p className="page-sub">
        Bring your own AI key to power smart features (ATS scoring, rewriting, tailoring, cover
        letters, interview prep). Your key is stored <strong>only in this browser</strong> and is
        never sent anywhere except the AI provider you choose. No account needed.
      </p>

      <div className="card">
        <h2 className="card-title">AI provider</h2>
        <label className="field">
          <span className="field-label">Provider</span>
          <select className="select" value={presetId} onChange={(e) => applyPreset(e.target.value)}>
            {AI_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
            <option value="custom">Custom (OpenAI-compatible)</option>
          </select>
        </label>
        {activePreset && <p className="hint">{activePreset.hint}</p>}

        <label className="field">
          <span className="field-label">API key</span>
          <input
            className="input"
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-..."
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        <label className="field">
          <span className="field-label">API URL (chat completions endpoint)</span>
          <input
            className="input"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://api.openai.com/v1/chat/completions"
            spellCheck={false}
          />
        </label>

        <label className="field">
          <span className="field-label">Model</span>
          <input
            className="input"
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="gpt-4o-mini"
            spellCheck={false}
          />
        </label>

        <div className="row gap">
          <button className="btn-primary" onClick={onSave}>Save key</button>
          {existing && <button className="btn-ghost" onClick={onClear}>Remove key</button>}
          {saved && <span className="saved-pill">Saved ✓</span>}
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Where do I get a key?</h2>
        <ul className="bullet-list">
          <li><strong>Groq</strong> — free, fast. Create a key at console.groq.com.</li>
          <li><strong>Google Gemini</strong> — generous free tier at aistudio.google.com.</li>
          <li><strong>OpenRouter</strong> — many free models at openrouter.ai.</li>
          <li><strong>OpenAI</strong> — paid, highest quality, platform.openai.com.</li>
          <li><strong>DeepSeek</strong> — low cost at platform.deepseek.com.</li>
        </ul>
        <p className="hint">
          Without a key, ATS scoring still works using a built-in offline analyzer — you just won't
          get the AI-written suggestions.
        </p>
      </div>
    </div>
  )
}
