import type { Resume } from "../types/resume"
import type { JobApplication } from "./applications"
import type { SavedJD } from "./jdLibrary"
import { pruneTombstones, type Tombstone } from "./changes"

// Everything a user keeps in this browser that sync carries between devices.
export interface Workspace {
  format: 1
  resumes: Resume[]
  jds: SavedJD[]
  applications: JobApplication[]
  tombstones: Tombstone[]
}

type Stamped = { id: string }

function mergeById<T extends Stamped>(local: T[], remote: T[], stamp: (item: T) => number, deleted: Map<string, number>): T[] {
  const byId = new Map<string, T>()
  for (const item of [...remote, ...local]) {
    if (!item || typeof item.id !== "string") continue
    const existing = byId.get(item.id)
    if (!existing || stamp(item) >= stamp(existing)) byId.set(item.id, item)
  }
  return [...byId.values()].filter((item) => {
    const deletedAt = deleted.get(item.id)
    return deletedAt === undefined || stamp(item) > deletedAt
  })
}

const resumeStamp = (item: Resume) => Number(item.updatedAt) || 0
const jdStamp = (item: SavedJD) => Number(item.savedAt) || 0
const applicationStamp = (item: JobApplication) => Number(item.updatedAt) || 0

// The untouched starter resume a fresh browser creates. It is not worth
// copying to devices that already have real resumes.
export function isBlankResume(resume: Resume): boolean {
  const contact = resume.contact || ({} as Resume["contact"])
  return !contact.fullName?.trim() && !contact.email?.trim() && !resume.summary?.trim()
    && !resume.experience?.length && !resume.education?.length && !resume.skills?.length
    && !resume.projects?.length && !resume.certifications?.length && !resume.customSections?.length
}

// Newest edit wins per item; a deletion wins over any edit made before it.
// On an exact tie the local copy is kept.
export function mergeWorkspaces(local: Workspace, remote: Workspace): Workspace {
  const tombstones = pruneTombstones([...remote.tombstones, ...local.tombstones])
  const deleted = new Map(tombstones.map((item) => [item.id, item.deletedAt]))
  const remoteIds = new Set(remote.resumes.map((item) => item.id))
  const localResumes = remote.resumes.length ? local.resumes.filter((item) => remoteIds.has(item.id) || !isBlankResume(item)) : local.resumes
  return {
    format: 1,
    resumes: mergeById(localResumes, remote.resumes, resumeStamp, deleted),
    jds: mergeById(local.jds, remote.jds, jdStamp, deleted).sort((a, b) => jdStamp(b) - jdStamp(a)).slice(0, 30),
    applications: mergeById(local.applications, remote.applications, applicationStamp, deleted).sort((a, b) => applicationStamp(b) - applicationStamp(a)).slice(0, 100),
    tombstones,
  }
}

export function parseWorkspace(value: unknown): Workspace {
  const row = value && typeof value === "object" ? value as Partial<Workspace> : {}
  if (row.format !== 1) throw new Error("This synced copy was made by a newer version of ResuMate. Reload to update.")
  return {
    format: 1,
    resumes: Array.isArray(row.resumes) ? row.resumes.filter((item) => item && typeof item.id === "string") : [],
    jds: Array.isArray(row.jds) ? row.jds.filter((item) => item && typeof item.id === "string" && typeof item.text === "string") : [],
    applications: Array.isArray(row.applications) ? row.applications.filter((item) => item && typeof item.id === "string") : [],
    tombstones: Array.isArray(row.tombstones) ? pruneTombstones(row.tombstones) : [],
  }
}

// Stable fingerprint used to skip uploads when nothing changed.
export function workspaceFingerprint(workspace: Workspace): string {
  const parts = [
    ...workspace.resumes.map((item) => `r:${item.id}:${resumeStamp(item)}`),
    ...workspace.jds.map((item) => `j:${item.id}:${jdStamp(item)}`),
    ...workspace.applications.map((item) => `a:${item.id}:${applicationStamp(item)}`),
    ...workspace.tombstones.map((item) => `t:${item.id}:${item.deletedAt}`),
  ]
  return parts.sort().join("|")
}
