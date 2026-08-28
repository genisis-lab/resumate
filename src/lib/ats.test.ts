import { describe, expect, it } from "vitest"
import { createSampleResume } from "../data/sample"
import { analyzeLocally, extractJobSignals, extractKeywords, keywordInText } from "./ats"

describe("ATS keyword matching", () => {
  it("normalizes punctuation and avoids noisy phrase artifacts", () => {
    const keywords = extractKeywords("Senior Product Designer. Lead design systems and research.")

    expect(keywords).toContain("designer")
    expect(keywords).toContain("product")
    expect(keywords).not.toContain("designer.")
    expect(keywords).not.toContain("designer lead")
  })

  it("matches complete words rather than substrings", () => {
    expect(keywordInText("Senior product designer", "design")).toBe(false)
    expect(keywordInText("Built design systems for products", "design systems")).toBe(true)
    expect(keywordInText("Built products for teams", "product")).toBe(false)
  })

  it("does not report punctuation-tainted missing terms for the sample resume", () => {
    const result = analyzeLocally(
      createSampleResume(),
      "Senior Product Designer. Lead design systems, accessibility, user research, and cross-functional delivery.",
    )

    expect(result.matchedKeywords).toContain("designer")
    expect(result.missingKeywords).not.toContain("designer.")
    expect(result.missingKeywords).not.toContain("designer lead")
    expect(result.sections?.reduce((sum, section) => sum + section.max, 0)).toBe(100)
    expect(result.summary).toContain("not an employer ATS score")
  })

  it("prioritizes explicit requirements and marks only exact evidence", () => {
    const signals = extractJobSignals(
      "Required: project management and stakeholder management. Nice to have: machine learning. You will lead delivery.",
      "Led stakeholder management for product delivery.",
    )

    expect(signals[0].priority).toBe("required")
    expect(signals).toContainEqual(expect.objectContaining({ term: "stakeholder management", priority: "required", matched: true }))
    expect(signals).toContainEqual(expect.objectContaining({ term: "machine learning", priority: "preferred", matched: false }))
  })
})
