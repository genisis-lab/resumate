// Minimal history-based router. Cloudflare Pages serves index.html for app routes
// via public/_redirects. Legacy hash routes still work so old bookmarks do not break.
import { useEffect, useState } from "react"

export function currentPath(): string {
  const hashRoute = window.location.hash.replace(/^#/, "")
  if (hashRoute.startsWith("/") && !hashRoute.startsWith("/share")) {
    return hashRoute.split("?")[0]
  }
  return window.location.pathname || "/"
}

export function navigate(path: string): void {
  window.history.pushState({}, "", path)
  window.dispatchEvent(new PopStateEvent("popstate"))
  window.scrollTo(0, 0)
}

export function useRoute(): string {
  const [path, setPath] = useState(currentPath())
  useEffect(() => {
    const onChange = () => setPath(currentPath())
    window.addEventListener("popstate", onChange)
    window.addEventListener("hashchange", onChange)
    return () => {
      window.removeEventListener("popstate", onChange)
      window.removeEventListener("hashchange", onChange)
    }
  }, [])
  return path
}
