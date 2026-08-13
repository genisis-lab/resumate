import { useState } from "react"
import { AI_PRESETS, getAiConfig, setAiConfig, clearAiConfig } from "../lib/byok"

// Settings page: Bring-Your-Own-Key. Lets a visitor paste a key for one of
// the supported providers. The key stays in this tab's session storage and is
// sent to the same-origin proxy with each AI request.
export function Settings() {
  const existing = getAiConfig()
  const existingPreset = AI_PRESETS.find((p) => p.url === existing?.url)
  const [presetId, setPresetId] = useState<string>(() => {
    return existingPreset?.id || "openai"
  })
  const [key, setKey] = useState(existing?.key || "")
  const [model, setModel] = useState(existing?.model || AI_PRESETS[0].model)
  const [saved, setSaved] = useState(false)

  function applyPreset(id: string) {
    setPresetId(id)
    const preset = AI_PRESETS.find((p) => p.id === id)
    if (preset) {
      setModel(preset.model)
    }
  }

  function onSave() {
    if (!key.trim()) {
      alert("Please paste an API key first.")
      return
    }
    const provider = AI_PRESETS.find((p) => p.id === presetId) || AI_PRESETS[0]
    setAiConfig({ key: key.trim(), url: provider.url, model: model.trim() || provider.model })
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
        letters, interview prep). Your key is stored <strong>only for this browser tab</strong>, then
        sent through ResuMate's proxy with each AI request to the provider you choose. Closing the tab clears it.
      </p>

      <div className="card">
        <h2 className="card-title">AI provider</h2>
        <label className="field">
          <span className="field-label">Provider</span>
          <select className="select" value={presetId} onChange={(e) => applyPreset(e.target.value)}>
            {AI_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>
        {activePreset && <p className="hint">{activePreset.hint}</p>}
        {!existingPreset && existing && <p className="error-text">The previously saved custom endpoint is no longer supported. Choose a provider and save again.</p>}

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
          The key stays in this tab's session storage, but AI requests pass the key and selected
          resume/job text through ResuMate's proxy to the chosen provider. Without a key, ATS scoring still
          works using the built-in offline analyzer.
        </p>
      </div>
    </div>
  )
}
