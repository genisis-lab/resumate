// PDF export via the browser's native print engine.
// This produces vector, selectable, ATS-parseable text (not a screenshot) and
// requires zero dependencies. The print stylesheet isolates #resume-print-area
// and removes the page margin Chrome otherwise uses for its URL/title footer.

export function exportPdf(resumeName?: string): void {
  // The preview is rendered inside an element with id "resume-print-area".
  // We toggle a body class so the print CSS shows only that node.
  const originalTitle = document.title
  const cleanName = resumeName?.replace(/\s+/g, " ").trim().slice(0, 80)
  document.title = cleanName ? `${cleanName} — Resume` : "Resume"
  document.body.classList.add("printing")
  const cleanup = () => {
    document.body.classList.remove("printing")
    document.title = originalTitle
    window.removeEventListener("afterprint", cleanup)
  }
  window.addEventListener("afterprint", cleanup)
  // Give the browser a tick to apply print styles.
  setTimeout(() => window.print(), 50)
}
