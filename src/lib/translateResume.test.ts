import { describe, expect, it } from "vitest"
import { createSampleResume } from "../data/sample"
import { applyTranslations, translationSegments } from "./translateResume"
import { normalizeResume } from "./storage"

describe("translation segments", () => {
  it("sends prose but never names, employers, schools, or contact details", () => {
    const resume = createSampleResume()
    const segments = translationSegments(resume)
    const sent = segments.map((item) => item.text).join("\n")
    expect(sent).not.toContain(resume.contact.fullName)
    expect(sent).not.toContain(resume.contact.email)
    for (const item of resume.experience) if (item.company) expect(segments.some((segment) => segment.text === item.company)).toBe(false)
    for (const item of resume.education) if (item.school) expect(segments.some((segment) => segment.text === item.school)).toBe(false)
    expect(new Set(segments.map((item) => item.id)).size).toBe(segments.length)
  })

  it("builds a new language copy and leaves the original untouched", () => {
    const resume = createSampleResume()
    const before = JSON.stringify(resume)
    const segments = translationSegments(resume)
    const copy = applyTranslations(resume, "fr", segments.map((item) => ({ id: item.id, text: `FR ${item.text}` })))
    expect(JSON.stringify(resume)).toBe(before)
    expect(copy.id).not.toBe(resume.id)
    expect(copy.settings.language).toBe("fr")
    expect(copy.name).toMatch(/\(Français\)$/)
    expect(copy.summary.startsWith("FR ")).toBe(true)
    expect(copy.experience[0].company).toBe(resume.experience[0].company)
    expect(copy.experience[0].bullets[0].startsWith("FR ")).toBe(true)
    expect(normalizeResume(copy).settings.language).toBe("fr")
  })
})
