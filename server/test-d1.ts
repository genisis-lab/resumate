// SQLite-backed stand-in for a D1 binding, for tests that need the real SQL.
import { readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { fileURLToPath } from "node:url"

type Value = null | number | bigint | string | Uint8Array

export class SqliteD1 {
  readonly sqlite = new DatabaseSync(":memory:")

  constructor() {
    const root = join(dirname(fileURLToPath(import.meta.url)), "../migrations")
    for (const file of readdirSync(root).filter((name) => name.endsWith(".sql")).sort()) {
      this.sqlite.exec(readFileSync(join(root, file), "utf8"))
    }
  }

  prepare(sql: string) {
    const statement = this.sqlite.prepare(sql)
    const bound = (values: Value[]) => ({
      first: async <T>() => (statement.get(...values) || null) as T | null,
      all: async <T>() => ({ results: statement.all(...values) as T[], success: true }),
      run: async () => {
        const result = statement.run(...values)
        return { success: true, meta: { changes: Number(result.changes) } }
      },
    })
    return { bind: (...values: Value[]) => bound(values), ...bound([]) }
  }

  async batch(statements: Array<{ run(): Promise<unknown> }>) {
    this.sqlite.exec("BEGIN IMMEDIATE")
    try {
      const results = []
      for (const statement of statements) results.push(await statement.run())
      this.sqlite.exec("COMMIT")
      return results
    } catch (error) {
      this.sqlite.exec("ROLLBACK")
      throw error
    }
  }
}

export async function sessionHash(token: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)))
  let binary = ""
  for (const byte of digest) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

// Insert a verified user with a live session; returns the session cookie header.
export async function signedInUser(db: SqliteD1, plan: "free" | "sprint" | "pro" = "free", id = crypto.randomUUID()): Promise<{ id: string; cookie: string }> {
  const now = Date.now()
  db.sqlite.prepare(
    `INSERT INTO users (id, email, name, password_hash, password_salt, email_verified_at, plan, created_at, updated_at)
     VALUES (?, ?, 'Test User', 'hash', 'salt', ?, ?, ?, ?)`,
  ).run(id, `${id}@example.com`, now, plan, now, now)
  const token = `token-${id}`
  db.sqlite.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)")
    .run(await sessionHash(token), id, now + 3_600_000, now, now)
  return { id, cookie: `__Host-resumate_session=${token}` }
}
