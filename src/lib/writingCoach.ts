import { findTextIssues } from './proofread'

export const WEAK_OPENERS = ['responsible for', 'responsibilities included', 'duties included', 'worked on', 'tasked with', 'in charge of']
export type BulletLevel = 'weak' | 'ok' | 'strong'
export interface BulletScore { score: number; level: BulletLevel; issues: string[] }

// A conservative writing checklist, not a measure of hiring quality or ATS fit.
// Incomplete fragments are not graded; truthful responsibilities need no metric.
export function scoreBullet(text: string, context: { current?: boolean } = {}): BulletScore | null {
  const t = text.trim()
  const words = t.split(/\s+/)
  if (!t || words.length < 5) return null
  const issues = findTextIssues(t)
  const weak = WEAK_OPENERS.find(opener => t.toLowerCase().startsWith(opener + ' '))
  if (weak) issues.push(`Consider naming the specific action instead of “${weak}”.`)
  if (/^(i|we)\s/i.test(t)) issues.push('Resume bullets usually omit the subject; describe the action directly.')
  if (/^(?:was|were)\s+\w+(?:ed|en)\s+by\b/i.test(t)) issues.push('Consider naming who performed the action.')
  if (context.current === false && /^(manage|lead|build|develop|maintain|support|coordinate|design|deliver|analyze|provide|assist|serve)\b/i.test(t)) issues.push('This role has ended. Use past tense for work performed there.')
  if (words.length > 40) issues.push('Consider splitting this into two focused bullets for readability.')
  const score = Math.max(0, 100 - issues.length * 20)
  return { score, level: issues.length === 0 ? 'strong' : issues.length === 1 ? 'ok' : 'weak', issues }
}
