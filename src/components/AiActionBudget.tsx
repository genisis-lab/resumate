import { useEffect, useState } from "react"
import type { PlanId } from "../lib/billing"
import { navigate } from "../router"

type Usage = {
  isAdmin: boolean
  unlimited: boolean
  limit: number | null
  used: number
  remaining: number | null
  resetsAt: string
}

export function AiActionBudget({ plan, refreshKey = 0 }: { plan: PlanId; refreshKey?: number }) {
  const [usage, setUsage] = useState<Usage | null>(null)
  const [signedOut, setSignedOut] = useState(false)

  useEffect(() => {
    if (plan === "free") return
    let active = true
    void fetch("/api/ai/usage", { credentials: "same-origin" }).then(async (response) => {
      if (response.status === 401) {
        if (active) setSignedOut(true)
        return
      }
      if (!response.ok) return
      const next = await response.json() as Usage
      if (active) {
        setUsage(next)
        setSignedOut(false)
      }
    }).catch(() => undefined)
    return () => { active = false }
  }, [plan, refreshKey])

  if (plan === "free") {
    return <div className="ai-budget"><strong>Hosted AI is a paid feature.</strong><span>Local ATS checks remain available on Free.</span><button className="text-button" onClick={() => navigate("/pricing")}>See paid plans</button></div>
  }
  if (signedOut) {
    return <div className="ai-budget"><strong>One hosted request uses 1 AI action.</strong><span>Sign in to use and view your allowance.</span><button className="text-button" onClick={() => navigate("/login")}>Sign in</button></div>
  }
  if (usage?.unlimited) return <div className="ai-budget"><strong>Admin allowance: unlimited.</strong><span>Each request is still protected by burst limits.</span></div>
  if (usage && usage.remaining !== null) {
    return <div className="ai-budget" aria-live="polite"><strong>1 AI action per request.</strong><span>{usage.remaining} of {usage.limit} remain · resets {new Date(usage.resetsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></div>
  }
  return <div className="ai-budget"><strong>1 AI action per request.</strong><span>Your allowance is checked before anything is sent.</span></div>
}
