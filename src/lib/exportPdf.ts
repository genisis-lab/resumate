// PDF export via the browser's native print engine.
// This produces vector, selectable, ATS-parseable text (not a screenshot) and
// requires zero dependencies. The print stylesheet (#print-root) isolates the
// resume page so headers/sidebars are excluded.

export function exportPdf(): void {
  // The preview is rendered inside an element with id "resume-print-area".
  // We toggle a body class so the print CSS shows only that node.
  document.body.classList.add("printing")
  const cleanup = () => {
    document.body.classList.remove("printing")
    window.removeEventListener("afterprint", cleanup)
  }
  window.addEventListener("afterprint", cleanup)
  // Give the browser a tick to apply print styles.
  setTimeout(() => window.print(), 50)
}
