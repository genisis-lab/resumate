import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ResumePreview } from './ResumePreview'
import { createSampleResume } from '../data/sample'
import { normalizeResume } from '../lib/storage'
import { canUseTemplate } from '../lib/usage'

describe('Professional Serif theme', () => {
  it('uses the screenshot hierarchy without changing resume content', () => {
    const sample = createSampleResume()
    sample.settings.template = 'professional'
    const before = JSON.stringify(sample)
    const html = renderToStaticMarkup(<ResumePreview resume={normalizeResume(sample)} />)
    expect(html).toContain('tpl-professional')
    expect(html).toContain('>Summary</h2>')
    expect(html.indexOf('Brightwave')).toBeLessThan(html.indexOf('2021'))
    expect(html).toContain('B.A. | Cognitive Science')
    expect(html).toContain('rp-project-link')
    expect(html).toContain('Nielsen Norman UX Certification')
    expect(JSON.stringify(sample)).toBe(before)
  })
  it('is paid-only and preserves the existing free themes', () => {
    expect(canUseTemplate('free', 'professional')).toBe(false)
    expect(canUseTemplate('sprint', 'professional')).toBe(true)
    expect(canUseTemplate('pro', 'professional')).toBe(true)
    for (const theme of ['modern', 'classic', 'ats'] as const) expect(canUseTemplate('free', theme)).toBe(true)
  })
})
