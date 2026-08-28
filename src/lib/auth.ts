import { useCallback, useEffect, useState } from "react"

export type AccountUser = {
  id: string
  email: string
  name: string
  emailVerified: boolean
  plan: "free" | "sprint" | "pro"
  createdAt: number
}

type AuthResponse = { user?: AccountUser | null; error?: string; code?: string; ok?: boolean; emailSent?: boolean; message?: string }

async function authRequest(path: string, init?: RequestInit): Promise<AuthResponse> {
  const response = await fetch(`/api/auth/${path}`, {
    credentials: "same-origin",
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  })
  let data: AuthResponse = {}
  try { data = await response.json() as AuthResponse } catch { /* handled below */ }
  if (!response.ok) throw new Error(data.error || "Account request failed. Please try again.")
  return data
}

export function registerAccount(name: string, email: string, password: string) {
  return authRequest("register", { method: "POST", body: JSON.stringify({ name, email, password }) })
}

export function loginAccount(email: string, password: string) {
  return authRequest("login", { method: "POST", body: JSON.stringify({ email, password }) })
}

export function verifyAccountEmail(token: string) {
  return authRequest("verify", { method: "POST", body: JSON.stringify({ token }) })
}

export function resendVerification(email: string) {
  return authRequest("resend-verification", { method: "POST", body: JSON.stringify({ email }) })
}

export function logoutAccount() {
  return authRequest("logout", { method: "POST", body: "{}" })
}

export function deleteAccount(password: string) {
  return authRequest("account", { method: "DELETE", body: JSON.stringify({ password }) })
}

export function useAccount() {
  const [user, setUser] = useState<AccountUser | null>(null)
  const [loading, setLoading] = useState(true)
  const refresh = useCallback(async () => {
    try {
      const response = await authRequest("session")
      setUser(response.user || null)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void refresh() }, [refresh])
  return { user, loading, refresh, setUser }
}
