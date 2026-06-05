// Reads an uploaded résumé file (PDF or plain text) and returns a structured
// Resume. PDF parsing lazy-loads pdf.js so it isn't in the initial bundle.
import { Resume } from "../types/resume"
import { parseResumeText } from "./parseResume"

export async function importResumeFromFile(file: File): Promise<Resume> {
  const name = (file.name || "").toLowerCase()
  const isPdf = file.type === "application/pdf" || name.endsWith(".pdf")

  let text: string
  if (isPdf) {
    const buf = await file.arrayBuffer()
    const { extractPdfText } = await import("./pdf")
    text = await extractPdfText(buf)
  } else {
    text = await file.text()
  }

  if (!text || !text.trim()) {
    throw new Error(
      "No readable text was found. If this is a scanned PDF (an image), it has no selectable text to import.",
    )
  }
  return parseResumeText(text)
}
