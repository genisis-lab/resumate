import { beforeEach, describe, expect, it, vi } from "vitest"

import { AI_PRESETS, clearAiConfig, getAiConfig, setAiConfig } from "./byok"

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size },
  } satisfies Storage
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage())
  vi.stubGlobal("sessionStorage", memoryStorage())
})

describe("BYOK storage", () => {
  it("keeps API secrets out of persistent storage", () => {
    setAiConfig({ key: "secret-key", url: AI_PRESETS[1].url, model: AI_PRESETS[1].model })
    expect(localStorage.getItem("resumate.ai.v1")).not.toContain("secret-key")
    expect(getAiConfig()).toEqual({ key: "secret-key", url: AI_PRESETS[1].url, model: AI_PRESETS[1].model })
    clearAiConfig()
    expect(getAiConfig()).toBeNull()
  })

  it("migrates legacy persistent keys into the current session", () => {
    localStorage.setItem("resumate.ai.v1", JSON.stringify({
      key: "legacy-secret",
      url: AI_PRESETS[0].url,
      model: AI_PRESETS[0].model,
    }))
    expect(getAiConfig()?.key).toBe("legacy-secret")
    expect(localStorage.getItem("resumate.ai.v1")).not.toContain("legacy-secret")
  })

  it("replaces unsupported endpoints with a known provider", () => {
    setAiConfig({ key: "secret-key", url: "https://example.com/steal", model: "gpt-4o-mini" })
    expect(getAiConfig()?.url).toBe(AI_PRESETS[0].url)
  })
})
