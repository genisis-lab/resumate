import { useEffect, useState } from "react"

// Register the service worker. Skips dev builds so the dev server is never cached.
export function registerServiceWorker() {
  if (typeof window === "undefined") return
  if (!("serviceWorker" in navigator)) return
  const env = (import.meta as any).env
  if (env && env.PROD === false) return
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* ignore registration failures */
    })
  })
}

// Hook exposing the browser's "Add to home screen" install prompt.
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null)
  const [canInstall, setCanInstall] = useState(false)

  useEffect(() => {
    function onPrompt(e: Event) {
      e.preventDefault()
      setDeferred(e)
      setCanInstall(true)
    }
    function onInstalled() {
      setCanInstall(false)
      setDeferred(null)
    }
    window.addEventListener("beforeinstallprompt", onPrompt as EventListener)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt as EventListener)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  async function promptInstall() {
    if (!deferred) return
    deferred.prompt()
    try {
      await deferred.userChoice
    } finally {
      setDeferred(null)
      setCanInstall(false)
    }
  }

  return { canInstall, promptInstall }
}
