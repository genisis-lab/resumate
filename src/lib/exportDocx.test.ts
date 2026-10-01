import { describe, expect, it } from 'vitest'
import { buildDocxBlob } from './exportDocx'
import { createSampleResume } from '../data/sample'

async function docxText(blob: Blob): Promise<string> {
  // The zip writer uses the STORE method, so XML parts are readable as-is.
  return new TextDecoder().decode(await blob.arrayBuffer())
}

describe('Word export', () => {
  it('includes custom sections, real hyperlinks, and core metadata', async () => {
    const xml = await docxText(buildDocxBlob(createSampleResume()))
    expect(xml).toContain('Awards &amp; Recognition')
    expect(xml).toContain('Designer of the Year')
    expect(xml).toContain('Target="mailto:jordan.avery@email.com"')
    expect(xml).toContain('Target="https://linkedin.com/in/jordanavery"')
    expect(xml).toContain('<dc:title>Jordan Avery — Resume</dc:title>')
    expect(xml).toContain('word/styles.xml')
  })

  it('applies template fonts only when the template is unlocked', async () => {
    const resume = createSampleResume()
    resume.settings.template = 'elegant'
    resume.settings.accent = '#7c3aed'
    const styled = await docxText(buildDocxBlob(resume, { templateStyles: true }))
    expect(styled).toContain('w:ascii="Garamond"')
    expect(styled).toContain('w:color w:val="7C3AED"')
    const locked = await docxText(buildDocxBlob(resume, { templateStyles: false }))
    expect(locked).not.toContain('w:ascii="Garamond"')
    expect(locked).toContain('w:ascii="Calibri"')
  })

  it('uses the selected paper size and strips XML-invalid control characters', async () => {
    const resume = createSampleResume()
    resume.settings.paperSize = 'a4'
    resume.summary = 'Builds\u0007 reliable systems'
    const xml = await docxText(buildDocxBlob(resume))
    expect(xml).toContain('<w:pgSz w:w="11906" w:h="16838"/>')
    expect(xml).toContain('Builds reliable systems')
  })
})
