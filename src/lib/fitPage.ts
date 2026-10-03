// Page geometry shared by the preview, the page counter, and PDF export.
// Sizes are CSS pixels at 96 DPI, which is what Chromium's print engine uses.
import type { PaperSize, Resume } from "../types/resume"

export const PAGE_SIZES: Record<PaperSize, { width: number; height: number; css: string; label: string }> = {
  letter: { width: 816, height: 1056, css: "letter", label: "US Letter" },
  a4: { width: 794, height: 1123, css: "A4", label: "A4" },
}

export interface PageMetrics {
  pages: number
  /** Y offsets (unscaled CSS px from the top of the paper) where pages 2+ begin. */
  breaks: number[]
}

// PDF export clones the paper's vertical padding onto every printed page, so
// each page holds (page height - top padding - bottom padding) of content.
export function measurePaper(paper: HTMLElement, size: PaperSize): PageMetrics {
  const sheet = paper.querySelector<HTMLElement>(".rp-sheet")
  const style = getComputedStyle(paper)
  const padTop = parseFloat(style.paddingTop) || 0
  const padBottom = parseFloat(style.paddingBottom) || 0
  const perPage = Math.max(1, PAGE_SIZES[size].height - padTop - padBottom)
  // offsetTop accounts for full-bleed headers that pull the sheet up into the top padding.
  const contentHeight = sheet
    ? Math.max(0, sheet.offsetTop + sheet.offsetHeight - padTop)
    : Math.max(0, paper.offsetHeight - padTop - padBottom)
  const pages = Math.max(1, Math.ceil((contentHeight - 2) / perPage))
  const breaks = Array.from({ length: pages - 1 }, (_, i) => padTop + perPage * (i + 1))
  return { pages, breaks }
}

// Resolve after two animation frames so React has committed and laid out.
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

export function paperSizeOf(resume: Pick<Resume, "settings">): PaperSize {
  return resume.settings.paperSize === "a4" ? "a4" : "letter"
}
