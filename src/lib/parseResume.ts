// Best-effort résumé parser. Converts raw text (from a PDF or .txt) into a
// structured Resume. Heuristic by nature — it aims to populate as much as it
// reasonably can; the user reviews/edits afterward. It never throws.
import {
  Resume,
  SkillGroup,
  ExperienceItem,
  EducationItem,
  ProjectItem,
  CertificationItem,
} from "../types/resume"
import { createEmptyResume } from "../data/sample"
import { uid } from "./id"

const MONTH =
  "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)"
const DATE = `(?:${MONTH}\\.?\\s*)?\\d{4}`
const RANGE = new RegExp(
  `(${DATE})\\s*(?:-|\u2013|\u2014|to|until)\\s*(${DATE}|Present|Current|Now|Ongoing)`,
  "i",
)
const SINGLE_DATE = new RegExp(DATE, "i")
const BULLET_RE = /^\s*[\u2022\u00b7\u25aa\u25e6\u2023\u25cf\u25cb\u2219*\-\u2013\u2014>]\s+/
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
const URL_G =
  /\b((?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s,)]*)?)/gi
const SEP_RE = /\s*[|\u2022\u00b7\u2014\u2013]\s*|,\s+| - | at /i

const SECTION_PATTERNS: { key: string; re: RegExp }[] = [
  { key: "summary", re: /^(professional\s+summary|summary|profile|objective|about\s+me|about|overview)\b/i },
  { key: "experience", re: /^(work\s+experience|professional\s+experience|employment(\s+history)?|experience|work\s+history|career\s+history)\b/i },
  { key: "education", re: /^(education|academic\s+background|academics)\b/i },
  { key: "skills", re: /^(technical\s+skills|core\s+competencies|key\s+skills|skills(\s*&\s*\w+)?|technologies|competencies|expertise)\b/i },
  { key: "projects", re: /^(projects|personal\s+projects|selected\s+projects|side\s+projects|notable\s+projects)\b/i },
  { key: "certifications", re: /^(certifications?|licenses?(\s*&\s*certifications?)?|certificates)\b/i },
  { key: "other", re: /^(awards|honors|achievements|publications|interests|references|languages|volunteer|activities)\b/i },
]

function norm(s: string): string {
  return s.replace(/\s+/g, " ").trim()
}

function headerKey(line: string): string | null {
  const l = line.trim().replace(/[:\u2013\u2014\-\s]+$/, "")
  if (!l || l.length > 45) return null
  if (/,/.test(l)) return null // lists / locations are not section headers
  const colon = l.indexOf(":")
  if (colon >= 0 && l.slice(colon + 1).trim().split(/\s+/).filter(Boolean).length >= 2) return null
  const words = l.split(/\s+/).length
  if (words > 5) return null
  for (const { key, re } of SECTION_PATTERNS) if (re.test(l)) return key
  return null
}

function findUrls(text: string): string[] {
  const matches = text.match(URL_G) || []
  return matches.filter(
    (u) =>
      !u.includes("@") &&
      (/(linkedin|github|gitlab|behance|dribbble)\./i.test(u) ||
        /\.(com|net|org|io|dev|me|co|ai|app|edu|gov|info|design|xyz|tech|us|uk|ca|so|sh)(\/|$)/i.test(u)),
  )
}

function stripProto(u: string): string {
  return u.replace(/^https?:\/\//i, "").replace(/\/$/, "").trim()
}

function findPhone(text: string): string {
  const candidates = text.match(/\(?\+?\d[\d\s().\-]{8,}\d/g) || []
  for (const c of candidates) {
    const digits = c.replace(/\D/g, "")
    if (digits.length >= 10 && digits.length <= 13) return norm(c)
  }
  return ""
}

function findLocation(text: string): string {
  const m = text.match(
    /\b([A-Z][a-zA-Z.]+(?:\s[A-Z][a-zA-Z.]+)*),\s*([A-Z]{2}|[A-Z][a-z]+)\b/,
  )
  return m ? `${m[1]}, ${m[2]}` : ""
}

function looksLikeName(line: string): boolean {
  const l = line.trim()
  if (!l || l.includes("@") || /\d/.test(l)) return false
  if (/(https?:|www\.|\.com|linkedin|github)/i.test(l)) return false
  const words = l.split(/\s+/)
  if (words.length < 2 || words.length > 4) return false
  return words.every((w) => /^[A-Z][A-Za-z'.\-]*$/.test(w) || /^[A-Z.]{2,}$/.test(w))
}

function isContactLine(l: string): boolean {
  return /@|https?:|www\.|linkedin|github|\.com|\+?\d[\d\s().\-]{6,}/i.test(l)
}

function splitList(s: string): string[] {
  return s
    .split(/\s*[,;|\u2022\u00b7]\s*|\s{2,}|\s\u2013\s/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0 && x.length <= 45)
}

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const a of arr) {
    const k = a.toLowerCase()
    if (!seen.has(k)) {
      seen.add(k)
      out.push(a)
    }
  }
  return out
}

function cleanBullet(line: string): string {
  return line.replace(BULLET_RE, "").replace(/^[\u2022\u00b7\u25aa\u25e6\u25cf\u25cb\u2219]\s*/, "").trim()
}

function extractDates(text: string): { start: string; end: string; current: boolean } {
  const m = text.match(RANGE)
  if (m) {
    const current = /present|current|now|ongoing/i.test(m[2])
    return { start: norm(m[1]), end: current ? "" : norm(m[2]), current }
  }
  const s = text.match(SINGLE_DATE)
  if (s) return { start: norm(s[0]), end: "", current: false }
  return { start: "", end: "", current: false }
}

function stripDates(text: string): string {
  return text
    .replace(RANGE, "")
    .replace(new RegExp(DATE, "ig"), "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s*[|\u2022\u00b7\u2013\u2014,\-]\s*$/, "")
    .replace(/^\s*[|\u2022\u00b7\u2013\u2014,\-]\s*/, "")
    .trim()
}

function splitHeader(text: string): string[] {
  return text.split(SEP_RE).map((s) => s.trim()).filter(Boolean)
}

interface Block {
  headers: string[]
  bullets: string[]
}

// Group a section body into entries: each entry has 1+ header lines followed by
// 0+ bullet lines. A new entry begins when a non-bullet line appears after we've
// already collected bullets, or after a blank-line gap.
function blockize(body: string[]): Block[] {
  const blocks: Block[] = []
  let cur: Block | null = null
  const close = () => {
    if (cur && (cur.headers.length || cur.bullets.length)) blocks.push(cur)
    cur = null
  }
  for (const rawLine of body) {
    const line = rawLine.trim()
    if (!line) {
      if (cur && cur.bullets.length) close()
      continue
    }
    if (BULLET_RE.test(rawLine)) {
      if (!cur) cur = { headers: [], bullets: [] }
      cur.bullets.push(cleanBullet(rawLine))
    } else {
      if (cur && cur.bullets.length) {
        close()
        cur = { headers: [line], bullets: [] }
      } else if (cur) {
        if (cur.headers.length >= 3) {
          close()
          cur = { headers: [line], bullets: [] }
        } else {
          cur.headers.push(line)
        }
      } else {
        cur = { headers: [line], bullets: [] }
      }
    }
  }
  close()
  return blocks
}

function parseSkills(lines: string[]): SkillGroup[] {
  const groups: SkillGroup[] = []
  const loose: string[] = []
  for (const raw of lines) {
    const line = raw.replace(BULLET_RE, "").trim()
    if (!line) continue
    const m = line.match(/^([A-Za-z][A-Za-z /&+]{1,30}):\s*(.+)$/)
    if (m) {
      const items = dedupe(splitList(m[2]))
      if (items.length) groups.push({ id: uid("sk"), category: norm(m[1]), items })
    } else {
      loose.push(...splitList(line))
    }
  }
  if (loose.length) groups.push({ id: uid("sk"), category: "Skills", items: dedupe(loose) })
  return groups
}

function parseExperience(body: string[]): ExperienceItem[] {
  const items: ExperienceItem[] = []
  for (const b of blockize(body)) {
    const joined = b.headers.join(" | ")
    const { start, end, current } = extractDates(joined)
    const h0 = stripDates(b.headers[0] || "")
    let parts = splitHeader(h0)
    let role = parts[0] || ""
    let company = parts[1] || ""
    let location = findLocation(joined) || parts[2] || ""
    if (!company && b.headers[1]) {
      const p2 = splitHeader(stripDates(b.headers[1]))
      company = p2[0] || ""
      if (!location) location = p2[1] || ""
    }
    const bullets = b.bullets.map(cleanBullet).filter(Boolean)
    if (role || company || bullets.length)
      items.push({
        id: uid("exp"),
        company: norm(company),
        role: norm(role),
        location: norm(location),
        startDate: start,
        endDate: end,
        current,
        bullets,
      })
  }
  return items
}

function parseEducation(body: string[]): EducationItem[] {
  const items: EducationItem[] = []
  for (const b of blockize(body)) {
    const all = [...b.headers, ...b.bullets].join(" | ")
    const { start, end } = extractDates(all)
    const schoolLine =
      b.headers.find((h) => /(University|College|Institute|School|Academy|Polytechnic)/i.test(h)) ||
      b.headers[0] ||
      ""
    const degMatch = all.match(
      /\b(Ph\.?\s?D|Doctorate|M\.?B\.?A|M\.?S\.?c?|Master(?:'s)?|B\.?S\.?c?|B\.?A|Bachelor(?:'s)?|Associate(?:'s)?|Diploma|Certificate)\b[^,|\u2022]*/i,
    )
    let degree = ""
    let field = ""
    if (degMatch) {
      const dm = norm(degMatch[0])
      const fm = dm.match(/\b(?:in|of)\b\s+(.+)$/i)
      if (fm) {
        field = norm(fm[1])
        degree = norm(dm.slice(0, dm.length - fm[0].length))
      } else {
        degree = dm
      }
    }
    let school = stripDates(schoolLine)
    if (degMatch) school = school.replace(degMatch[0], "").trim()
    school = school.replace(SEP_RE, " ").trim()
    const location = findLocation(all.replace(schoolLine, ""))
    if (school || degree || field)
      items.push({
        id: uid("edu"),
        school: norm(school),
        degree,
        field,
        location,
        startDate: start,
        endDate: end,
        details: "",
      })
  }
  return items
}

function parseProjects(body: string[]): ProjectItem[] {
  const items: ProjectItem[] = []
  for (const b of blockize(body)) {
    const header = b.headers[0] || ""
    const url = findUrls([...b.headers, ...b.bullets].join(" "))[0] || ""
    const parts = splitHeader(header.replace(url, ""))
    const name = norm(parts[0] || header)
    const description = norm(b.headers.slice(1).join(" ") || parts.slice(1).join(" "))
    const bullets = b.bullets.map(cleanBullet).filter(Boolean)
    if (name)
      items.push({
        id: uid("prj"),
        name,
        link: stripProto(url),
        description,
        bullets,
      })
  }
  return items
}

function parseCertifications(lines: string[]): CertificationItem[] {
  const items: CertificationItem[] = []
  for (const raw of lines) {
    const line = raw.replace(BULLET_RE, "").trim()
    if (!line) continue
    const yearM = line.match(/\b(19|20)\d{2}\b/)
    const date = yearM ? yearM[0] : ""
    const rest = norm(line.replace(/\(?\b(19|20)\d{2}\b\)?/, ""))
    const parts = rest
      .split(/\s*[\u2014\u2013|,]\s*|\s-\s|\sby\s|\sfrom\s/i)
      .map((s) => s.replace(/^[\s\-\u2013\u2014|,]+|[\s\-\u2013\u2014|,]+$/g, "").trim())
      .filter(Boolean)
    const name = parts[0] || rest
    const issuer = parts[1] || ""
    if (name) items.push({ id: uid("cert"), name, issuer, date })
  }
  return items
}

function detectSections(allLines: string[]): { key: string; start: number; end: number }[] {
  const found: { key: string; start: number }[] = []
  for (let i = 0; i < allLines.length; i++) {
    const key = headerKey(allLines[i])
    if (key) found.push({ key, start: i })
  }
  const ranges = found.map((f, i) => ({
    key: f.key,
    start: f.start,
    end: i + 1 < found.length ? found[i + 1].start : allLines.length,
  }))
  const seen = new Set<string>()
  return ranges.filter((r) => {
    if (seen.has(r.key)) return false
    seen.add(r.key)
    return true
  })
}

export function parseResumeText(rawText: string): Resume {
  const resume = createEmptyResume("Imported Resume")
  try {
    const allLines = rawText.replace(/\r/g, "").split("\n").map((l) => l.replace(/\u00a0/g, " ").trimEnd())
    const flat = allLines.join("\n")

    resume.contact.email = (flat.match(EMAIL_RE) || [""])[0]
    const noEmail = flat.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, " ")
    for (const u of findUrls(noEmail)) {
      const lu = u.toLowerCase()
      if (lu.includes("linkedin.com")) {
        if (!resume.contact.linkedin) resume.contact.linkedin = stripProto(u)
      } else if (lu.includes("github.com")) {
        if (!resume.contact.github) resume.contact.github = stripProto(u)
      } else if (!resume.contact.website) {
        resume.contact.website = stripProto(u)
      }
    }
    const phone = findPhone(flat)
    if (phone) resume.contact.phone = phone

    const sections = detectSections(allLines)
    const firstSection = sections.length ? sections[0].start : allLines.length
    const head = allLines.slice(0, firstSection).map((l) => l.trim()).filter(Boolean)

    const nameLine = head.find(looksLikeName)
    if (nameLine) resume.contact.fullName = norm(nameLine)
    const afterName = nameLine ? head.indexOf(nameLine) + 1 : 0
    for (let i = afterName; i < head.length; i++) {
      const l = head[i]
      if (isContactLine(l) || l === resume.contact.fullName) continue
      if (l.length <= 70 && !/[|\u2022]/.test(l)) {
        resume.contact.headline = norm(l)
        break
      }
    }
    const loc = findLocation(head.join("  "))
    if (loc) resume.contact.location = loc

    for (const sec of sections) {
      const body = allLines.slice(sec.start + 1, sec.end).map((l) => l.trim())
      const nonEmpty = body.filter(Boolean)
      if (sec.key === "summary") resume.summary = norm(nonEmpty.join(" "))
      else if (sec.key === "skills") resume.skills = parseSkills(nonEmpty)
      else if (sec.key === "experience") resume.experience = parseExperience(body)
      else if (sec.key === "education") resume.education = parseEducation(body)
      else if (sec.key === "projects") resume.projects = parseProjects(body)
      else if (sec.key === "certifications") resume.certifications = parseCertifications(nonEmpty)
    }
  } catch {
    /* best-effort: return whatever we managed to fill */
  }

  resume.name = resume.contact.fullName ? `${resume.contact.fullName} \u2014 Imported` : "Imported Resume"
  resume.updatedAt = Date.now()
  return resume
}
