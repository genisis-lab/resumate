// End-to-end encryption for optional workspace sync.
//
// A 256-bit AES-GCM key is derived from the user's sync passphrase with
// PBKDF2-SHA-256 (600,000 iterations, random 16-byte salt). The key is
// non-extractable and never leaves the browser. Every upload uses a fresh
// 12-byte nonce, and the user id is bound in as additional authenticated data
// so a vault cannot be swapped between accounts. The plaintext is gzip-
// compressed first when the browser supports CompressionStream.

export const PBKDF2_ITERATIONS = 600_000
const KEY_CHECK_TEXT = "resumate-sync-key-check-v1"
const FORMAT_RAW = 0
const FORMAT_GZIP = 1
const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function toBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(binary)
}

export function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length))
}

export function newSalt(): string {
  return toBase64(randomBytes(16))
}

function aad(userId: string): Uint8Array<ArrayBuffer> {
  return encoder.encode(`resumate-sync:v1:${userId}`)
}

export async function deriveSyncKey(passphrase: string, salt: string, iterations = PBKDF2_ITERATIONS): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", encoder.encode(passphrase.normalize("NFKC")), "PBKDF2", false, ["deriveKey"])
  return await crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: fromBase64(salt), iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
}

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  const output = new Blob([bytes]).stream().pipeThrough(stream as unknown as ReadableWritablePair<Uint8Array, Uint8Array>)
  return new Uint8Array(await new Response(output).arrayBuffer())
}

async function pack(value: unknown): Promise<Uint8Array<ArrayBuffer>> {
  const json = encoder.encode(JSON.stringify(value))
  const canCompress = typeof CompressionStream === "function"
  const body = canCompress ? await pipe(json, new CompressionStream("gzip")) : json
  const packed = new Uint8Array(body.length + 1)
  packed[0] = canCompress ? FORMAT_GZIP : FORMAT_RAW
  packed.set(body, 1)
  return packed
}

async function unpack(bytes: Uint8Array<ArrayBuffer>): Promise<unknown> {
  const format = bytes[0]
  const body = bytes.slice(1)
  if (format === FORMAT_RAW) return JSON.parse(decoder.decode(body))
  if (format === FORMAT_GZIP) {
    if (typeof DecompressionStream !== "function") throw new Error("This browser cannot open compressed sync data. Update it and try again.")
    return JSON.parse(decoder.decode(await pipe(body, new DecompressionStream("gzip"))))
  }
  throw new Error("Unknown sync data format")
}

export async function encryptJson(key: CryptoKey, userId: string, value: unknown): Promise<{ ciphertext: string; iv: string }> {
  const iv = randomBytes(12)
  const sealed = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad(userId) }, key, await pack(value))
  return { ciphertext: toBase64(new Uint8Array(sealed)), iv: toBase64(iv) }
}

export async function decryptJson(key: CryptoKey, userId: string, sealed: { ciphertext: string; iv: string }): Promise<unknown> {
  const opened = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(sealed.iv), additionalData: aad(userId) }, key, fromBase64(sealed.ciphertext))
  return await unpack(new Uint8Array(opened))
}

// A small sealed constant that lets a new device confirm the passphrase
// before touching the workspace. It reveals nothing the vault does not.
export async function makeKeyCheck(key: CryptoKey, userId: string): Promise<string> {
  const iv = randomBytes(12)
  const sealed = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad(userId) }, key, encoder.encode(KEY_CHECK_TEXT))
  return `${toBase64(iv)}.${toBase64(new Uint8Array(sealed))}`
}

export async function verifyKeyCheck(key: CryptoKey, userId: string, check: string): Promise<boolean> {
  const [iv, sealed] = check.split(".")
  if (!iv || !sealed) return false
  try {
    const opened = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv), additionalData: aad(userId) }, key, fromBase64(sealed))
    return decoder.decode(opened) === KEY_CHECK_TEXT
  } catch {
    return false
  }
}
