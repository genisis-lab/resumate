import { afterEach, describe, expect, it, vi } from 'vitest'
import { aiGenerateSummary, aiRewriteBullets } from './ai'
import { createEmptyResume } from '../data/sample'
vi.mock('./byok', () => ({ aiClientOverrides: () => ({}) }))
vi.mock('./analytics', () => ({ trackEvent: vi.fn() }))
afterEach(() => vi.unstubAllGlobals())

describe('AI editor boundaries', () => {
  it('does not request AI for empty bullets or a contact-only resume', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    expect(await aiRewriteBullets(['', ' '])).toEqual(['', ' '])
    const resume = createEmptyResume(); resume.contact.fullName = 'Example Person'
    await expect(aiGenerateSummary(resume)).rejects.toThrow('Add experience')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('never exposes an HTML error page or accepts an HTML success page', async () => {
    for (const status of [502, 200]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>upstream debug secret</html>', { status, headers: { 'content-type': 'text/html' } })))
      try { await aiRewriteBullets(['Resolved customer questions.']); throw new Error('Expected rejection') }
      catch (error) { expect(String(error)).not.toContain('<html>'); expect(String(error)).not.toContain('debug secret') }
    }
  })
  it('rejects malformed bullet results and preserves contextual request fields', async () => {
    for (const bullets of [[12], ['<html>error</html>'], ['one', 'two']]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ bullets })))
      await expect(aiRewriteBullets(['Supported customers.'])).rejects.toThrow('invalid bullet')
    }
    const fetcher = vi.fn().mockResolvedValue(Response.json({ bullets: ['Support customers with billing questions.'] })); vi.stubGlobal('fetch', fetcher)
    await aiRewriteBullets(['Support customers with billing questions.'], { role: 'Customer Support', current: true })
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ role: 'Customer Support', current: true })
  })
})
