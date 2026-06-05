// Minimal hash-based router — no dependency, works perfectly on static hosts
// like Cloudflare Pages (no SPA rewrite rules needed).
import { useEffect, useState } from "react"

export function currentPath(): string {
  const h = window.location.hash.replace(/^#/, "")
  return h || "/"
}

export function navigate(path: string): void {
  window.location.hash = path
  window.scrollTo(0, 0)
}

export function useRoute(): string {
  const [path, setPath] = useState(currentPath())
  useEffect(() => {
    const onChange = () => setPath(currentPath())
    window.addEventListener("hashchange", onChange)
    return () => window.removeEventListener("hashchange", onChange)
  }, [])
  return path
}
