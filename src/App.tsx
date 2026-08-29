import { useEffect, useRef, useState } from "react"
import { useResume } from "./hooks/useResume"
import { useRoute, navigate } from "./router"
import { Landing } from "./pages/Landing"
import { Builder } from "./pages/Builder"
import { Analyze } from "./pages/Analyze"
import { Templates } from "./pages/Templates"
import { CoverLetter } from "./pages/CoverLetter"
import { Settings } from "./pages/Settings"
import { Interview } from "./pages/Interview"
import { Privacy } from "./pages/Privacy"
import { Terms } from "./pages/Terms"
import { Refund } from "./pages/Refund"
import { Pricing } from "./pages/Pricing"
import { AuthPage } from "./pages/Auth"
import { VerifyEmail } from "./pages/VerifyEmail"
import { Account } from "./pages/Account"
import { useAccount } from "./lib/auth"
import { getTheme, setTheme, loadStore } from "./lib/storage"
import { createSampleResume } from "./data/sample"
import { readSharedResume, clearShareParam } from "./lib/share"
import { useInstallPrompt } from "./lib/pwa"
import { exportPdf } from "./lib/exportPdf"
import { ShortcutsModal } from "./components/ShortcutsModal"
import { BottomSheet } from "./components/BottomSheet"
import { consumeUsage } from "./lib/usage"

const APP_NAV = [
  { path: "/builder", label: "Editor" },
  { path: "/templates", label: "Templates" },
  { path: "/analyze", label: "ATS Check" },
  { path: "/cover", label: "Cover Letter" },
  { path: "/interview", label: "Interview" },
  { path: "/settings", label: "Settings" },
]

const PUBLIC_ROUTES = new Set(["/", "/pricing", "/privacy", "/tos", "/refund", "/login", "/signup", "/verify-email", "/account"])

const PAGE_META: Record<string, { title: string; description: string }> = {
  "/pricing": {
    title: "Pricing — ResuMate",
    description: "Compare ResuMate's Free, 30-day Career Sprint, and monthly Pro plans.",
  },
  "/privacy": {
    title: "Privacy Policy — ResuMate",
    description: "How ResuMate handles resume content, account data, AI requests, payments, and privacy rights.",
  },
  "/tos": {
    title: "Terms of Service — ResuMate",
    description: "Terms for using ResuMate, including accounts, AI tools, and paid plans.",
  },
  "/refund": {
    title: "Refund Policy — ResuMate",
    description: "ResuMate cancellation and refund terms for paid plans and digital purchases.",
  },
  "/signup": {
    title: "Create an account — ResuMate",
    description: "Create a verified ResuMate account to manage software access and future upgrade options.",
  },
  "/login": {
    title: "Sign in — ResuMate",
    description: "Sign in to your verified ResuMate account.",
  },
  "/account": {
    title: "Your account — ResuMate",
    description: "Manage your ResuMate account and plan.",
  },
}

function ThemeToggle() {
  const [theme, setT] = useState<"light" | "dark">(getTheme())
  useEffect(() => {
    setTheme(theme)
  }, [theme])
  return (
    <button
      className="btn-ghost small theme-toggle"
      onClick={() => setT((t) => (t === "dark" ? "light" : "dark"))}
      title="Toggle light or dark theme"
      aria-label="Toggle light or dark theme"
    >
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 2.75v2M12 19.25v2M21.25 12h-2M4.75 12h-2M18.54 5.46l-1.42 1.42M6.88 17.12l-1.42 1.42M18.54 18.54l-1.42-1.42M6.88 6.88 5.46 5.46" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M19.65 15.72A8.2 8.2 0 0 1 8.28 4.35 8.2 8.2 0 1 0 19.65 15.72Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      )}
    </button>
  )
}

function InstallButton() {
  const { canInstall, promptInstall } = useInstallPrompt()
  if (!canInstall) return null
  return (
    <button className="btn-ghost small install-button" onClick={promptInstall} title="Install ResuMate as an app">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3.5v11m0 0 4-4m-4 4-4-4M5 18.5h14" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>
      <span>Install</span>
    </button>
  )
}

export default function App() {
  const route = useRoute()
  const { resume, setResume, switchResume, replaceResume, savedAt, saveError, undo, redo, canUndo, canRedo } = useResume()
  const sharedChecked = useRef(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showMobileNav, setShowMobileNav] = useState(false)
  const account = useAccount()
  const effectivePlan = account.user?.plan ?? "free"

  const isApp = !PUBLIC_ROUTES.has(route)
  const activeNavLabel = APP_NAV.find((item) => item.path === route)?.label || "current page"

  useEffect(() => {
    const meta = PAGE_META[route]
    document.title = meta?.title || "ResuMate | Free resume builder and job match"
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (description) {
      description.content = meta?.description || "Build a clear resume, compare it with a real job description, and export PDF or Word. Start free without an account."
    }
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (canonical) canonical.href = `https://resume.builtwai.com${PUBLIC_ROUTES.has(route) ? route : "/"}`
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
    if (!robots) {
      robots = document.createElement("meta")
      robots.name = "robots"
      document.head.appendChild(robots)
    }
    robots.content = new Set(["/login", "/signup", "/verify-email", "/account"]).has(route)
      ? "noindex, nofollow"
      : "index, follow"
  }, [route])

  // If the page was opened from a shared link, offer to load it once.
  useEffect(() => {
    if (account.loading) return
    if (sharedChecked.current) return
    sharedChecked.current = true
    const shared = readSharedResume()
    if (shared) {
      const ok = confirm("This link contains a shared resume. Load it as a new resume in your browser?")
      clearShareParam()
      if (ok) {
        replaceResume(effectivePlan === "free" ? { ...shared, id: resume.id, name: resume.name } : shared)
        navigate("/builder")
      } else {
        navigate("/")
      }
    }
  }, [account.loading, effectivePlan, replaceResume, resume.id, resume.name])

  // Global undo/redo keyboard shortcuts.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      if (!mod || e.key.toLowerCase() !== "z") return
      const t = e.target as HTMLElement | null
      const tag = t?.tagName?.toLowerCase()
      // Let inputs/textareas handle their own native undo.
      if (tag === "input" || tag === "textarea" || t?.isContentEditable) return
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [undo, redo])

  // App-level shortcuts: "?" opens help, Ctrl/Cmd+S exports PDF in the editor, Esc closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      const tag = t?.tagName?.toLowerCase()
      const typing = tag === "input" || tag === "textarea" || t?.isContentEditable
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === "s") {
        if (route === "/builder") {
          e.preventDefault()
          const quota = consumeUsage(effectivePlan, "documentExports")
          if (!quota.allowed) alert("The Free plan includes 3 PDF or Word exports each month. Upgrade for unlimited exports.")
          else exportPdf(resume.contact.fullName || resume.name)
        }
        return
      }
      if (e.key === "Escape") {
        setShowShortcuts(false)
        return
      }
      if (e.key === "?" && !typing) {
        e.preventDefault()
        setShowShortcuts((s) => !s)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [effectivePlan, resume.contact.fullName, resume.name, route])

  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>
      <nav className={`nav no-print ${isApp ? "app-nav" : "public-nav"}`} aria-label="Primary navigation">
        <button className="brand" onClick={() => navigate("/")} aria-label="ResuMate home">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22"><path d="M7 3.75h7l3 3v13.5H7z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /><path d="M14 3.75v3h3M9.5 11h5M9.5 14.5h5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>
          </span><span className="brand-name">ResuMate</span>
        </button>
        {isApp && (
          <div className="nav-links">
            {APP_NAV.map((item) => (
              <button key={item.path} className={route === item.path ? "active" : ""} onClick={() => navigate(item.path)}>{item.label}</button>
            ))}
          </div>
        )}
        {isApp && (
          <button
            className="mobile-nav-trigger"
            type="button"
            aria-haspopup="dialog"
            aria-label={`Open menu, currently on ${activeNavLabel}`}
            onClick={() => setShowMobileNav(true)}
          >
            Menu
          </button>
        )}
        <div className="nav-right">
          {isApp && saveError ? (
            <span className="save-warning" role="status" aria-live="polite">{saveError}</span>
          ) : isApp && savedAt > 0 ? (
            <span className="saved-pill" role="status" aria-live="polite">Saved</span>
          ) : null}
          <InstallButton />
          {isApp && <button className="icon-btn" onClick={() => setShowShortcuts(true)} title="Keyboard shortcuts (press ?)" aria-label="Keyboard shortcuts">⌨</button>}
          {!isApp && <button className={`pricing-nav${route === "/pricing" ? " active" : ""}`} aria-current={route === "/pricing" ? "page" : undefined} onClick={() => navigate("/pricing")}>Pricing</button>}
          {!account.loading && account.user && (
            <button className="account-nav" onClick={() => navigate("/account")}>{account.user.name.split(" ")[0]}</button>
          )}
          {!account.loading && !account.user && !isApp && (
            <>
              <button className="sign-in-nav" onClick={() => navigate("/login")}>Sign in</button>
              <button className="account-nav" onClick={() => navigate("/signup")}>Sign up</button>
            </>
          )}
          {!account.loading && !account.user && isApp && (
            <button className="account-nav" onClick={() => navigate("/signup")}>Sign up</button>
          )}
          <ThemeToggle />
        </div>
      </nav>

      <main className="main" id="main">
        {route === "/" && (
          <Landing
            onStartBlank={() => {
              const store = loadStore()
              switchResume(store.resumes[0].id)
              navigate("/builder")
            }}
            onStartSample={() => {
              replaceResume({ ...createSampleResume(), id: resume.id, name: resume.name })
              navigate("/builder")
            }}
            onCreateAccount={() => navigate("/signup")}
          />
        )}
        {route === "/builder" && (
          <Builder
            resume={resume}
            setResume={setResume}
            switchResume={switchResume}
            replaceResume={replaceResume}
            undo={undo}
            redo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            plan={effectivePlan}
          />
        )}
        {route === "/templates" && <Templates resume={resume} setResume={setResume} plan={effectivePlan} />}
        {route === "/analyze" && <Analyze resume={resume} setResume={setResume} plan={effectivePlan} />}
        {route === "/cover" && <CoverLetter resume={resume} />}
        {route === "/interview" && <Interview resume={resume} />}
        {route === "/settings" && <Settings />}
        {route === "/pricing" && <Pricing />}
        {route === "/privacy" && <Privacy />}
        {route === "/tos" && <Terms />}
        {route === "/refund" && <Refund />}
        {route === "/signup" && <AuthPage mode="signup" onAuthenticated={account.refresh} />}
        {route === "/login" && <AuthPage mode="login" onAuthenticated={account.refresh} />}
        {route === "/verify-email" && <VerifyEmail onVerified={account.refresh} />}
        {route === "/account" && <Account user={account.user} onChanged={account.refresh} />}
      </main>
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      <BottomSheet open={showMobileNav} title="Go to" onClose={() => setShowMobileNav(false)}>
        <nav className="mobile-nav-menu" aria-label="App sections">
          {APP_NAV.map((item) => (
            <button
              key={item.path}
              type="button"
              className={route === item.path ? "active" : ""}
              aria-current={route === item.path ? "page" : undefined}
              onClick={() => {
                setShowMobileNav(false)
                navigate(item.path)
              }}
            >
              <span>{item.label}</span>
              {route === item.path && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </nav>
      </BottomSheet>
    </div>
  )
}
