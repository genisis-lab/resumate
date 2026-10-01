import { describe, expect, it } from "vitest"
import { dateStyle, findCliches, qualityFlags } from "./quality"
import { createSampleResume } from "../data/sample"

describe("local quality checks", () => {
  it("flags overused phrases once each", () => {
    expect(findCliches("Results-driven team player and results driven self-starter")).toEqual(["results-driven", "team player", "self-starter"])
    expect(findCliches("Built dynamically generated reports")).toEqual([])
  })

  it("classifies date styles", () => {
    expect(dateStyle("2021")).toBe("year")
    expect(dateStyle("Jan 2021")).toBe("short-month")
    expect(dateStyle("January 2021")).toBe("long-month")
    expect(dateStyle("03/2021")).toBe("numeric")
    expect(dateStyle("Present")).toBeNull()
  })

  it("adds actionable flags for mixed dates, missing dates, empty roles, and clichés", () => {
    const resume = createSampleResume()
    resume.summary = "Results-driven designer."
    resume.experience[0].startDate = "Jan 2021"
    resume.experience.push({ id: "x", company: "Acme", role: "Designer", location: "", startDate: "", endDate: "", current: false, bullets: [] })
    const text = qualityFlags(resume).map((flag) => flag.text).join("\n")
    expect(text).toContain("mixed formats")
    expect(text).toContain("missing dates")
    expect(text).toContain("no bullet points")
    expect(text).toContain("results-driven")
  })

  it("stays quiet about the clean sample resume's dates", () => {
    const text = qualityFlags(createSampleResume()).map((flag) => flag.text).join("\n")
    expect(text).not.toContain("mixed formats")
    expect(text).not.toContain("missing dates")
  })
})
