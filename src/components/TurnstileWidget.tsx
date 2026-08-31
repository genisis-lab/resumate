import { useEffect, useRef } from "react"

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string
  remove: (widgetId: string) => void
}

declare global {
  interface Window { turnstile?: TurnstileApi }
}

let loader: Promise<TurnstileApi> | null = null

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (loader) return loader
  loader = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-resumate-turnstile="true"]')
    const script = existing || document.createElement("script")
    const ready = () => window.turnstile ? resolve(window.turnstile) : reject(new Error("Security check did not load."))
    script.addEventListener("load", ready, { once: true })
    script.addEventListener("error", () => reject(new Error("Security check did not load.")), { once: true })
    if (!existing) {
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
      script.async = true
      script.defer = true
      script.dataset.resumateTurnstile = "true"
      document.head.appendChild(script)
    }
  })
  return loader
}

export function TurnstileWidget({
  siteKey,
  action,
  resetVersion,
  onToken,
  onError,
}: {
  siteKey: string
  action: "signup" | "login"
  resetVersion: number
  onToken: (token: string) => void
  onError: (message: string) => void
}) {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    let widgetId = ""
    onToken("")
    void loadTurnstile().then((api) => {
      if (!active || !host.current) return
      widgetId = api.render(host.current, {
        sitekey: siteKey,
        action,
        theme: "auto",
        size: "flexible",
        appearance: "interaction-only",
        callback: (token: string) => onToken(token),
        "expired-callback": () => onToken(""),
        "timeout-callback": () => onToken(""),
        "error-callback": () => {
          onToken("")
          onError("The security check could not finish. Try again.")
        },
      })
    }).catch(() => {
      if (active) onError("The security check could not load. Refresh and try again.")
    })
    return () => {
      active = false
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [action, onError, onToken, resetVersion, siteKey])

  return <div className="turnstile-shell" ref={host} aria-label="Security check" />
}
