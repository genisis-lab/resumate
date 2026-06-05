import { useEffect, useState } from "react"
import { useResume } from "./hooks/useResume"
import { useRoute, navigate } from "./router"
import { Landing } from "./pages/Landing"
import { Builder } from "./pages/Builder"
import { Analyze } from "./pages/Analyze"
import { Templates } from "./pages/Templates"
import { getTheme, setTheme } from "./lib/storage"

function ThemeToggle() {
  const [theme, setT] = useState<"light" | "dark">(getTheme())
  useEffect(() => {
    setTheme(theme)
  }, [theme])
  return (
    <button
      className="btn-ghost small"
      onClick={() => setT((t) => (t === "dark" ? "light" : "dark"))}
      title="Toggle theme"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  )
}

export default function App() {
  const route = useRoute()
  const { resume, setResume, switchResume, replaceResume, savedAt } = useResume()

  const isApp = route !== "/"

  return (
    <div className="app">
      <nav className="nav no-print">
        <button className="brand" onClick={() => navigate("/")}>
          <span className="brand-mark">◈</span> ResuMate
        </button>
        {isApp && (
          <div className="nav-links">
            <button className={route === "/builder" ? "active" : ""} onClick={() => navigate("/builder")}>Editor</button>
            <button className={route === "/templates" ? "active" : ""} onClick={() => navigate("/templates")}>Templates</button>
            <button className={route === "/analyze" ? "active" : ""} onClick={() => navigate("/analyze")}>ATS Check</button>
          </div>
        )}
        <div className="nav-right">
          {isApp && savedAt > 0 && <span className="saved-pill">Saved</span>}
          <ThemeToggle />
        </div>
      </nav>

      <main className="main">
        {route === "/" && <Landing />}
        {route === "/builder" && (
          <Builder resume={resume} setResume={setResume} switchResume={switchResume} replaceResume={replaceResume} />
        )}
        {route === "/templates" && <Templates resume={resume} setResume={setResume} />}
        {route === "/analyze" && <Analyze resume={resume} />}
      </main>
    </div>
  )
}
