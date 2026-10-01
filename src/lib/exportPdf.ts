// PDF export via the browser's native print engine.
// This produces vector, selectable, ATS-parseable text (not a screenshot) and
// requires zero dependencies. The print stylesheet isolates #resume-print-area
// and removes the page margin Chrome otherwise uses for its URL/title footer.
import type { PaperSize } from "../types/resume"
import { PAGE_SIZES } from "./fitPage"

const PAGE_STYLE_ID = "resumate-print-page"

export function exportPdf(resumeName?: string, paperSize: PaperSize = "letter"): void {
  // The preview is rendered inside an element with id "resume-print-area".
  // We toggle a body class so the print CSS shows only that node.
  const originalTitle = document.title
  const cleanName = resumeName?.replace(/\s+/g, " ").trim().slice(0, 80)
  document.title = cleanName ? `${cleanName} — Resume` : "Resume"
  document.body.classList.add("printing")
  document.getElementById(PAGE_STYLE_ID)?.remove()
  const pageStyle = document.createElement("style")
  pageStyle.id = PAGE_STYLE_ID
  pageStyle.textContent = `@page { size: ${PAGE_SIZES[paperSize].css}; margin: 0; }`
  document.head.appendChild(pageStyle)
  const cleanup = () => {
    document.body.classList.remove("printing")
    document.title = originalTitle
    pageStyle.remove()
    window.removeEventListener("afterprint", cleanup)
  }
  window.addEventListener("afterprint", cleanup)
  // Give the browser a tick to apply print styles.
  setTimeout(() => window.print(), 50)
}
