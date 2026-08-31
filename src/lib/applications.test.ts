import { beforeEach, describe, expect, it, vi } from "vitest"
import { deleteApplication, listApplications, saveApplication, updateApplicationStage } from "./applications"

const values = new Map<string, string>()

beforeEach(() => {
  values.clear()
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => values.set(key, value),
  })
})

describe("application tracker", () => {
  it("stores, updates, and deletes a private browser-local application", () => {
    const saved = saveApplication({
      company: "Northstar",
      role: "Product Designer",
      stage: "saved",
      jobDescription: "Build accessible product experiences.",
      resumeId: "resume-1",
      resumeName: "Product resume",
      coverLetter: "Draft",
      interviewNotes: "Prepare a portfolio story.",
      notes: "Referral pending.",
    })
    expect(listApplications()).toHaveLength(1)
    updateApplicationStage(saved.id, "interview")
    expect(listApplications()[0].stage).toBe("interview")
    deleteApplication(saved.id)
    expect(listApplications()).toEqual([])
  })
})
