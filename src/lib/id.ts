// Tiny unique id helper (no dependency on crypto.randomUUID for older browsers).
export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`
}
