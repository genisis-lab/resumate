import { uid } from "./id"

export type ApplicationStage = "saved" | "applied" | "interview" | "offer" | "closed"

export type JobApplication = {
  id: string
  company: string
  role: string
  stage: ApplicationStage
  jobDescription: string
  resumeId: string
  resumeName: string
  coverLetter: string
  interviewNotes: string
  notes: string
  createdAt: number
  updatedAt: number
}

const KEY = "resumate.applications.v1"
const STAGES = new Set<ApplicationStage>(["saved", "applied", "interview", "offer", "closed"])

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : ""
}

function normalize(value: unknown): JobApplication | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const item = value as Partial<JobApplication>
  const company = cleanText(item.company, 160).trim()
  const role = cleanText(item.role, 160).trim()
  if (!company || !role) return null
  const now = Date.now()
  return {
    id: typeof item.id === "string" && item.id.length <= 120 ? item.id : uid("application"),
    company,
    role,
    stage: STAGES.has(item.stage as ApplicationStage) ? item.stage as ApplicationStage : "saved",
    jobDescription: cleanText(item.jobDescription, 24_000),
    resumeId: cleanText(item.resumeId, 120),
    resumeName: cleanText(item.resumeName, 160),
    coverLetter: cleanText(item.coverLetter, 24_000),
    interviewNotes: cleanText(item.interviewNotes, 12_000),
    notes: cleanText(item.notes, 12_000),
    createdAt: Number.isFinite(item.createdAt) ? Number(item.createdAt) : now,
    updatedAt: Number.isFinite(item.updatedAt) ? Number(item.updatedAt) : now,
  }
}

export function listApplications(): JobApplication[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) || "[]")
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item) => normalize(item) || []).slice(0, 100)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  } catch {
    return []
  }
}

function persist(items: JobApplication[]): void {
  localStorage.setItem(KEY, JSON.stringify(items.slice(0, 100)))
}

export function saveApplication(input: Omit<JobApplication, "id" | "createdAt" | "updatedAt"> & { id?: string }): JobApplication {
  const items = listApplications()
  const existing = input.id ? items.find((item) => item.id === input.id) : null
  const now = Date.now()
  const normalized = normalize({
    ...input,
    id: existing?.id || uid("application"),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  })
  if (!normalized) throw new Error("Company and role are required.")
  persist([normalized, ...items.filter((item) => item.id !== normalized.id)])
  return normalized
}

export function deleteApplication(id: string): void {
  persist(listApplications().filter((item) => item.id !== id))
}

export function updateApplicationStage(id: string, stage: ApplicationStage): void {
  if (!STAGES.has(stage)) return
  const item = listApplications().find((candidate) => candidate.id === id)
  if (!item) return
  saveApplication({ ...item, stage })
}
