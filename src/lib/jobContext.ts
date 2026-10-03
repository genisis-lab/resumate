// The job description pasted on one tool page follows the visitor to the
// others for this tab only (sessionStorage), so it never outlives the session.
const KEY = "resumate.jd"

export function readSavedJob(): string {
  try {
    return sessionStorage.getItem(KEY) || ""
  } catch {
    return ""
  }
}

export function writeSavedJob(value: string): void {
  try {
    sessionStorage.setItem(KEY, value)
  } catch {
    /* storage can be unavailable in private modes */
  }
}
