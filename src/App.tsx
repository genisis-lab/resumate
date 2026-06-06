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
import { getTheme, setTheme } from "./lib/storage"
import { readSharedResume, clearShareParam } from "./lib/share"
import { useInstallPrompt } from "./lib/pwa"
import { exportPdf } from "./lib/exportPdf"
import { ShortcutsModal } from "./components/ShortcutsModal"

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
    <button className="btn-ghost small" onClick={promptInstall} title="Install ResuMate as an app">⬇ Install</button>
  )
}

export default function App() {
  const route = useRoute()
  const { resume, setResume, switchResume, replaceResume, savedAt, undo, redo, canUndo, canRedo } = useResume()
  const sharedChecked = useRef(false)
  const [showShortcuts, setShowShortcuts] = useState(false)

  const isApp = route !== "/"

  // If the page was opened from a shared link (?r=...), offer to load it once.
  useEffect(() => {
    if (sharedChecked.current) return
    sharedChecked.current = true
    const shared = readSharedResume()
    if (shared) {
      const ok = confirm("This link contains a shared resume. Load it as a new resume in your browser?")
      if (ok) {
        replaceResume(shared)
        navigate("/builder")
      }
      clearShareParam()
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
            <button className={route === "/builder" ? "active" : ""} onClick={() => navigate("/builder")}>Editor</button>
            <button className={route === "/templates" ? "active" : ""} onClick={() => navigate("/templates")}>Templates</button>
            <button className={route === "/analyze" ? "active" : ""} onClick={() => navigate("/analyze")}>ATS Check</button>
            <button className={route === "/cover" ? "active" : ""} onClick={() => navigate("/cover")}>Cover Letter</button>
            <button className={route === "/interview" ? "active" : ""} onClick={() => navigate("/interview")}>Interview</button>
            <button className={route === "/settings" ? "active" : ""} onClick={() => navigate("/settings")}>Settings</button>
          </div>
        )}
        <div className="nav-right">
          {isApp && savedAt > 0 && <span className="saved-pill" role="status" aria-live="polite">Saved</span>}
          <InstallButton />
          <button className="icon-btn" onClick={() => setShowShortcuts(true)} title="Keyboard shortcuts (press ?)" aria-label="Keyboard shortcuts">⌨</button>
          <ThemeToggle />
        </div>
      </nav>

      <main className="main" id="main">
        {route === "/" && <Landing />}
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
      </main>
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
    </div>
  )
}
