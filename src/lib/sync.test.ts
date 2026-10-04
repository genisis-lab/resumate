import { describe, expect, it } from "vitest"
import { decryptJson, deriveSyncKey, encryptJson, makeKeyCheck, newSalt, verifyKeyCheck } from "./syncCrypto"
import { mergeWorkspaces, workspaceFingerprint, type Workspace } from "./workspace"
import { createEmptyResume } from "../data/sample"
import type { Resume } from "../types/resume"

// Fewer iterations keep the tests fast; production uses PBKDF2_ITERATIONS.
const ITERATIONS = 100_000

function resume(id: string, updatedAt: number, name = "Jordan Avery"): Resume {
  const base = createEmptyResume(name)
  return { ...base, id, updatedAt, contact: { ...base.contact, fullName: name } }
}

function workspace(patch: Partial<Workspace>): Workspace {
  return { format: 1, resumes: [], jds: [], applications: [], tombstones: [], ...patch }
}

describe("sync encryption", () => {
  it("round-trips a workspace and binds it to the account", async () => {
    const salt = newSalt()
    const key = await deriveSyncKey("correct horse battery staple", salt, ITERATIONS)
    const data = workspace({ resumes: [resume("r1", 10)] })
    const sealed = await encryptJson(key, "user-a", data)
    expect(sealed.ciphertext).not.toContain("Jordan")
    expect(await decryptJson(key, "user-a", sealed)).toEqual(JSON.parse(JSON.stringify(data)))
    await expect(decryptJson(key, "user-b", sealed)).rejects.toThrow()
  })

  it("uses a fresh nonce for every upload", async () => {
    const key = await deriveSyncKey("correct horse battery staple", newSalt(), ITERATIONS)
    const first = await encryptJson(key, "user-a", { a: 1 })
    const second = await encryptJson(key, "user-a", { a: 1 })
    expect(first.iv).not.toBe(second.iv)
    expect(first.ciphertext).not.toBe(second.ciphertext)
  })

  it("rejects a wrong passphrase with the key check", async () => {
    const salt = newSalt()
    const right = await deriveSyncKey("correct horse battery staple", salt, ITERATIONS)
    const wrong = await deriveSyncKey("correct horse battery stapler", salt, ITERATIONS)
    const check = await makeKeyCheck(right, "user-a")
    expect(await verifyKeyCheck(right, "user-a", check)).toBe(true)
    expect(await verifyKeyCheck(wrong, "user-a", check)).toBe(false)
    expect(await verifyKeyCheck(right, "user-b", check)).toBe(false)
  })
})

describe("workspace merge", () => {
  it("keeps the newest copy of each item and unions the rest", () => {
    const local = workspace({ resumes: [resume("a", 20, "Local A"), resume("b", 5)] })
    const remote = workspace({ resumes: [resume("a", 10, "Remote A"), resume("c", 7)] })
    const merged = mergeWorkspaces(local, remote)
    expect(merged.resumes.map((item) => [item.id, item.contact.fullName]).sort()).toEqual([["a", "Local A"], ["b", "Jordan Avery"], ["c", "Jordan Avery"]])
  })

  it("lets a deletion beat older edits but not newer ones", () => {
    const now = Date.now()
    const local = workspace({ resumes: [resume("a", now - 100), resume("b", now)] })
    const remote = workspace({ tombstones: [{ id: "a", deletedAt: now - 50 }, { id: "b", deletedAt: now - 60 }] })
    const merged = mergeWorkspaces(local, remote)
    expect(merged.resumes.map((item) => item.id)).toEqual(["b"])
    expect(merged.tombstones.map((item) => item.id).sort()).toEqual(["a", "b"])
  })

  it("does not copy a blank starter resume onto devices that already have resumes", () => {
    const blank = { ...createEmptyResume("My Resume"), id: "starter", updatedAt: Date.now() }
    const merged = mergeWorkspaces(workspace({ resumes: [blank] }), workspace({ resumes: [resume("real", 5)] }))
    expect(merged.resumes.map((item) => item.id)).toEqual(["real"])
  })

  it("fingerprints are order-independent and change with edits", () => {
    const a = workspace({ resumes: [resume("a", 1), resume("b", 2)] })
    const b = workspace({ resumes: [resume("b", 2), resume("a", 1)] })
    expect(workspaceFingerprint(a)).toBe(workspaceFingerprint(b))
    expect(workspaceFingerprint(a)).not.toBe(workspaceFingerprint(workspace({ resumes: [resume("a", 3), resume("b", 2)] })))
  })
})
