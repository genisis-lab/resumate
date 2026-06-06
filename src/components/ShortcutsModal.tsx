import { useEffect } from "react"

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "Ctrl / Cmd + Z", action: "Undo" },
  { keys: "Ctrl / Cmd + Shift + Z", action: "Redo" },
  { keys: "Ctrl / Cmd + S", action: "Export to PDF (in the editor)" },
  { keys: "?", action: "Open this shortcuts panel" },
  { keys: "Esc", action: "Close any open dialog" },
]

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Keyboard shortcuts</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <table className="shortcuts">
          <tbody>
            {SHORTCUTS.map((s) => (
              <tr key={s.action}>
                <td><kbd>{s.keys}</kbd></td>
                <td>{s.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
