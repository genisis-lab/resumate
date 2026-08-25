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
import { getTheme, setTheme, loadStore } from "./lib/storage"
import { createSampleResume } from "./data/sample"
import { readSharedResume, clearShareParam } from "./lib/share"
import { useInstallPrompt } from "./lib/pwa"
import { exportPdf } from "./lib/exportPdf"
import { ShortcutsModal } from "./components/ShortcutsModal"
import { BottomSheet } from "./components/BottomSheet"

const APP_NAV = [
  { path: "/builder", label: "Editor" },
  { path: "/templates", label: "Templates" },
  { path: "/analyze", label: "ATS Check" },
  { path: "/cover", label: "Cover Letter" },
  { path: "/interview", label: "Interview" },
  { path: "/settings", label: "Settings" },
]

const PUBLIC_ROUTES = new Set(["/", "/pricing", "/privacy", "/tos", "/refund"])

const PAGE_META: Record<string, { title: string; description: string }> = {
  "/pricing": {
    title: "Pricing — ResuMate",
    description: "Start ResuMate free, use a 30-day Career Sprint, or choose Pro for live ATS parsing and a complete job-search workspace.",
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
    description: "ResuMate cancellation and refund terms for future paid plans and digital purchases.",
  },
}

function ThemeToggle() {
  const [theme, setT] = useState<"light" | "dark">(getTheme())
  useEffect(() => {
    setTheme(theme)
  }, [theme])
  return (
    <button
      className="btn-ghost small"
      onClick={() => setT((t) => (t === "dark" ? "light" : "dark"))}
      title="Toggle light or dark theme"
      aria-label="Toggle light or dark theme"
    >
      {theme === "dark" ? "\u2600\ufe0f" : "\ud83c\udf19"}
    </button>
  )
}

function InstallButton() {
  const { canInstall, promptInstall } = useInstallPrompt()
  if (!canInstall) return null
  return (
    <button className="btn-ghost small install-button" onClick={promptInstall} title="Install ResuMate as an app">⬇ Install</button>
  )
}

export default function App() {
  const route = useRoute()
  const { resume, setResume, switchResume, replaceResume, savedAt, saveError, undo, redo, canUndo, canRedo } = useResume()
  const sharedChecked = useRef(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showMobileNav, setShowMobileNav] = useState(false)

  const isApp = !PUBLIC_ROUTES.has(route)
  const activeNavLabel = APP_NAV.find((item) => item.path === route)?.label || "current page"

  useEffect(() => {
    const meta = PAGE_META[route]
    document.title = meta?.title || "ResuMate — Free AI Resume Builder & ATS Checker"
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (description) {
      description.content = meta?.description || "ResuMate — build an ATS-optimized resume in minutes with offline editing, free PDF & Word export, résumé import, and optional AI-powered ATS scoring."
    }
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (canonical) canonical.href = `https://resume.builtwai.com${PUBLIC_ROUTES.has(route) ? route : "/"}`
  }, [route])

  // If the page was opened from a shared link, offer to load it once.
  useEffect(() => {
    if (sharedChecked.current) return
    sharedChecked.current = true
    const shared = readSharedResume()
    if (shared) {
      const ok = confirm("This link contains a shared resume. Load it as a new resume in your browser?")
      clearShareParam()
      if (ok) {
        replaceResume(shared)
        navigate("/builder")
      } else {
        navigate("/")
      }
    }
  }, [replaceResume])

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
          exportPdf()
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
  }, [route])

  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>
      <nav className="nav no-print">
        <button className="brand" onClick={() => navigate("/")} aria-label="ResuMate home">
          <span className="brand-mark" aria-hidden="true">◈</span> ResuMate
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
          <button className="icon-btn" onClick={() => setShowShortcuts(true)} title="Keyboard shortcuts (press ?)" aria-label="Keyboard shortcuts">⌨</button>
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
              replaceResume(createSampleResume())
              navigate("/builder")
            }}
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
          />
        )}
        {route === "/templates" && <Templates resume={resume} setResume={setResume} />}
        {route === "/analyze" && <Analyze resume={resume} setResume={setResume} />}
        {route === "/cover" && <CoverLetter resume={resume} />}
        {route === "/interview" && <Interview resume={resume} />}
        {route === "/settings" && <Settings />}
        {route === "/pricing" && <Pricing />}
        {route === "/privacy" && <Privacy />}
        {route === "/tos" && <Terms />}
        {route === "/refund" && <Refund />}
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
