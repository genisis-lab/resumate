import { describe, expect, it } from 'vitest'
import { scoreBullet } from './writingCoach'
import { findTextIssues } from './proofread'

describe('contextual writing checks', () => {
  it('does not grade empty or unfinished input', () => {
    for (const text of ['', ' ', 'Manager', 'adding roles at work']) expect(scoreBullet(text)).toBeNull()
  })
  it('accepts truthful duties without numbers and collaborative work', () => {
    expect(scoreBullet('Assisted customers with product questions and resolved billing concerns.')?.issues).toEqual([])
    expect(scoreBullet('Maintained patient records and coordinated appointments with clinical staff.')?.issues).toEqual([])
  })
  it('flags specific grammar and former-role tense without treating digits as quality', () => {
    expect(scoreBullet('Responsible for manage the the team of 12.')?.issues.length).toBeGreaterThan(1)
    expect(scoreBullet('Manage customer requests and coordinate daily deliveries.', { current: false })?.issues.join(' ')).toContain('past tense')
    expect(scoreBullet('Manage customer requests and coordinate daily deliveries.', { current: true })?.issues).toEqual([])
    expect(findTextIssues('Supported the organisation with staff scheduling.')).toEqual([])
    expect(findTextIssues('Improved managment processes across the team.').join(' ')).toContain('management')
  })
})
