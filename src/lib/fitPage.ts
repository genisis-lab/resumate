// Estimate how many printed (US Letter) pages the resume preview spans, and a
// small helper to wait for the browser to paint after a state change.

export const PAGE_ASPECT = 11 / 8.5 // height / width for US Letter

export function measurePageCount(el: HTMLElement): number {
  const width = el.clientWidth || 1
  const pageHeight = width * PAGE_ASPECT
  if (pageHeight <= 0) return 1
  return Math.max(1, Math.ceil((el.scrollHeight - 6) / pageHeight))
}

// Resolve after two animation frames so React has committed and laid out.
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}
