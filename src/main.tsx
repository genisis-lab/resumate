import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import { getTheme, setTheme } from "./lib/storage"
import "./index.css"

// Apply persisted theme before first paint.
setTheme(getTheme())

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
