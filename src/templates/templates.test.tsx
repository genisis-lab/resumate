import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ResumePreview, initials, readableInk } from './ResumePreview'
import { FREE_TEMPLATE_IDS, PREMIUM_TEMPLATE_COUNT, TEMPLATES, isTemplateId, templateMeta } from './registry'
import { createSampleResume } from '../data/sample'
import { normalizeResume } from '../lib/storage'
import { canUseTemplate } from '../lib/usage'
import type { TemplateId } from '../types/resume'

const css = readFileSync(new URL('./templates.css', import.meta.url), 'utf8')

function render(template: TemplateId, mutate?: (r: ReturnType<typeof createSampleResume>) => void, printTarget = false) {
  const sample = createSampleResume()
  sample.settings.template = template
  mutate?.(sample)
  return renderToStaticMarkup(<ResumePreview resume={normalizeResume(sample)} printTarget={printTarget} />)
}

describe('template registry', () => {
  it('registers unique templates with three free choices and the rest premium', () => {
    const ids = TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(TEMPLATES.length).toBe(17)
    expect([...FREE_TEMPLATE_IDS].sort()).toEqual(['ats', 'classic', 'modern'])
    expect(PREMIUM_TEMPLATE_COUNT).toBe(14)
    for (const t of TEMPLATES) {
      expect(canUseTemplate('free', t.id)).toBe(t.tier === 'free')
      expect(canUseTemplate('sprint', t.id)).toBe(true)
      expect(canUseTemplate('pro', t.id)).toBe(true)
    }
  })

  it('renders every registered template with its own stylesheet hooks', () => {
    for (const t of TEMPLATES) {
      expect(render(t.id)).toContain(`tpl-${t.id}`)
      if (!['modern'].includes(t.id)) expect(css).toContain(`.tpl-${t.id}`)
    }
  })

  it('falls back safely for unknown or legacy template ids', () => {
    expect(isTemplateId('sidebar')).toBe(true)
    expect(isTemplateId('not-a-template')).toBe(false)
    expect(templateMeta('nope' as TemplateId).id).toBe('modern')
    const restored = normalizeResume({ ...createSampleResume(), settings: { ...createSampleResume().settings, template: 'retro', accent: 'red;background:url(x)', fontScale: 9, paperSize: 'tabloid' } })
    expect(restored.settings.template).toBe('modern')
    expect(restored.settings.accent).toBe('#2563eb')
    expect(restored.settings.fontScale).toBe(1.15)
    expect(restored.settings.paperSize).toBeUndefined()
  })
})

describe('template rendering', () => {
  it('only the editor preview carries the print target id', () => {
    expect(render('modern')).not.toContain('resume-print-area')
    expect(render('modern', undefined, true)).toContain('id="resume-print-area"')
  })

  it('breaks long contact lines between details and links instead of dangling separators', () => {
    const html = render('modern')
    expect(html).toContain('rp-contact-break')
    const short = render('modern', (r) => { r.contact.website = ''; r.contact.linkedin = '' })
    expect(short).not.toContain('rp-contact-break')
  })

  it('places the name before sidebar content so parsers read it first', () => {
    const html = render('sidebar')
    expect(html.indexOf('Jordan Avery')).toBeLessThan(html.indexOf('rp-side'))
    expect(html).toContain('rp-contact-list')
    expect(html).toContain('<dt>Email</dt>')
  })

  it('keeps comma separators in the text layer for chip skills', () => {
    const html = render('bold')
    expect(html).toContain('<span class="rp-chip">Figma</span><span class="rp-chip-sep">, </span>')
  })

  it('draws monogram initials as an image, not text', () => {
    const html = render('monogram')
    expect(html).toContain('rp-monogram')
    expect(html).not.toMatch(/>JA</)
    expect(initials('Jordan Avery')).toBe('JA')
    expect(initials('  cher ')).toBe('C')
    expect(initials('')).toBe('YN')
  })

  it('picks readable ink for accent backgrounds', () => {
    expect(readableInk('#2563eb')).toBe('#ffffff')
    expect(readableInk('#111827')).toBe('#ffffff')
    expect(readableInk('#fde68a')).toBe('#111827')
    expect(readableInk('bogus')).toBe('#ffffff')
  })

  it('uses only static fonts and no text opacity in exported pages', () => {
    // Variable fonts become Type 3 fonts in Chromium PDFs and break ATS text extraction.
    expect(css).not.toMatch(/Variable/)
    const paperRules = css.split('/* ---------- Preview frame')[0]
    expect(paperRules).not.toMatch(/opacity/)
  })
})
