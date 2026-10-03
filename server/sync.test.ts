import { describe, expect, it } from "vitest"

import { onRequest as sync } from "../functions/api/sync/[[path]]"
import { SqliteD1, signedInUser } from "./test-d1"

const upload = (baseVersion: number, patch: Record<string, unknown> = {}) => ({
  baseVersion,
  ciphertext: btoa("sealed-workspace-bytes".repeat(4)),
  iv: btoa("twelve-bytes"),
  salt: btoa("sixteen-byte-slt"),
  kdfIterations: 600_000,
  keyCheck: `${btoa("twelve-bytes")}.${btoa("sealed-check-value")}`,
  deviceLabel: "Chrome on macOS",
  ...patch,
})

function call(env: unknown, path: string, cookie?: string, body?: unknown) {
  const headers: Record<string, string> = { Origin: "https://resume.builtwai.com" }
  if (cookie) headers.Cookie = cookie
  if (body !== undefined) headers["Content-Type"] = "application/json"
  return sync({ request: new Request(`https://resume.builtwai.com/api/sync/${path}`, { method: body === undefined ? "GET" : "POST", headers, body: body === undefined ? undefined : JSON.stringify(body) }), env } as never)
}

describe("encrypted sync vault", () => {
  it("stores ciphertext for Pro and enforces version order", async () => {
    const DB = new SqliteD1()
    const { cookie } = await signedInUser(DB, "pro")
    expect(await (await call({ DB }, "vault", cookie)).json()).toEqual({ vault: null, canWrite: true })
    const first = await call({ DB }, "vault", cookie, upload(0))
    expect(first.status).toBe(200)
    expect(await first.json()).toMatchObject({ version: 1 })
    // A second device that has not pulled version 1 is refused.
    const stale = await call({ DB }, "vault", cookie, upload(0))
    expect(stale.status).toBe(409)
    expect(await stale.json()).toEqual({ conflict: true, version: 1 })
    expect((await call({ DB }, "vault", cookie, upload(1))).status).toBe(200)
    const read = await (await call({ DB }, "vault", cookie)).json() as { vault: { version: number; ciphertext: string; deviceLabel: string } }
    expect(read.vault).toMatchObject({ version: 2, ciphertext: upload(0).ciphertext, deviceLabel: "Chrome on macOS" })
  })

  it("keeps sync writes to Pro but lets anyone read or erase their own copy", async () => {
    const DB = new SqliteD1()
    const { id, cookie } = await signedInUser(DB, "pro")
    expect((await call({ DB }, "vault", cookie, upload(0))).status).toBe(200)
    DB.sqlite.prepare("UPDATE users SET plan = 'free' WHERE id = ?").run(id)
    expect((await call({ DB }, "vault", cookie, upload(1))).status).toBe(403)
    expect(await (await call({ DB }, "vault", cookie)).json()).toMatchObject({ canWrite: false, vault: { version: 1 } })
    expect(await (await call({ DB }, "delete", cookie, {})).json()).toEqual({ deleted: true })
    expect(await (await call({ DB }, "vault", cookie)).json()).toMatchObject({ vault: null })
  })

  it("isolates vaults between accounts and requires sign-in", async () => {
    const DB = new SqliteD1()
    const a = await signedInUser(DB, "pro")
    const b = await signedInUser(DB, "pro")
    await call({ DB }, "vault", a.cookie, upload(0))
    expect(await (await call({ DB }, "vault", b.cookie)).json()).toMatchObject({ vault: null })
    expect((await call({ DB }, "vault")).status).toBe(401)
  })

  it("rejects malformed or oversized uploads", async () => {
    const DB = new SqliteD1()
    const { cookie } = await signedInUser(DB, "pro")
    expect((await call({ DB }, "vault", cookie, upload(0, { ciphertext: "not base64!" }))).status).toBe(400)
    expect((await call({ DB }, "vault", cookie, upload(0, { iv: btoa("short") }))).status).toBe(400)
    expect((await call({ DB }, "vault", cookie, upload(0, { kdfIterations: 1_000 }))).status).toBe(400)
    expect((await call({ DB }, "vault", cookie, upload(-1))).status).toBe(400)
    expect((await call({ DB }, "vault", cookie, upload(0, { ciphertext: "A".repeat(1_500_004) }))).status).toBe(413)
  })
})
