import { ReactNode, useLayoutEffect, useRef, useState } from "react"
import type { PaperSize } from "../types/resume"
import { PAGE_SIZES, PageMetrics, measurePaper } from "../lib/fitPage"

// Shows a resume at its true printed size, scaled down to fit the available
// width. Line breaks and page counts therefore match the exported PDF.
export function PaperFrame({
  size,
  children,
  maxScale = 1,
  showPageBreaks = false,
  onMetrics,
  className = "",
}: {
  size: PaperSize
  children: ReactNode
  maxScale?: number
  showPageBreaks?: boolean
  onMetrics?: (metrics: PageMetrics) => void
  className?: string
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(maxScale)
  const [metrics, setMetrics] = useState<PageMetrics>({ pages: 1, breaks: [] })
  const onMetricsRef = useRef(onMetrics)
  onMetricsRef.current = onMetrics
  const lastKey = useRef("")
  const pageWidth = PAGE_SIZES[size].width

  useLayoutEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const update = () => {
      const width = frame.clientWidth
      if (width > 0) setScale(Math.min(maxScale, width / pageWidth))
      const paper = frame.querySelector<HTMLElement>(".resume-paper")
      if (!paper) return
      const next = measurePaper(paper, size)
      const key = `${next.pages}:${next.breaks.map(Math.round).join(",")}`
      // Report only real changes so parents can store metrics without re-render loops.
      if (key === lastKey.current) return
      lastKey.current = key
      setMetrics(next)
      onMetricsRef.current?.(next)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(frame)
    const paper = frame.querySelector(".resume-paper")
    const sheet = frame.querySelector(".rp-sheet")
    if (paper) observer.observe(paper)
    if (sheet) observer.observe(sheet)
    return () => observer.disconnect()
  }, [children, maxScale, pageWidth, size])

  return (
    <div ref={frameRef} className={`paper-frame ${className}`}>
      <div className="paper-zoom" style={{ zoom: scale, width: pageWidth }}>
        {children}
        {showPageBreaks && metrics.breaks.map((top, index) => (
          <div className="page-break-guide no-print" style={{ top }} key={top} aria-hidden="true">
            <span>Page {index + 2}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
