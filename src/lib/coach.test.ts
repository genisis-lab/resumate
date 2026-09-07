import { expect, it, vi } from 'vitest'
import { createSampleResume } from '../data/sample'
import { writingFields, replaceWritingField, consistencyIssues } from './coach'
import { runCoach } from '../../server/coach'
vi.mock('../../server/ai-proxy', async importOriginal => ({...await importOriginal<typeof import('../../server/ai-proxy')>(), callAI: vi.fn()}))
import { callAI } from '../../server/ai-proxy'
it('applies accepted text only to an unchanged field and finds real local conflicts', () => {
  const r = createSampleResume(), field = writingFields(r)[0]
  expect(replaceWritingField(r, field.key, 'stale text', 'replacement')).toBe(r)
  const edited = replaceWritingField(r, field.key, field.text, 'Reviewed summary')
  expect(edited.summary).toBe('Reviewed summary'); expect(r.summary).toBe(field.text)
  r.experience[0].startDate = '2025-01-01'; r.experience[0].endDate = '2020-01-01'
  expect(consistencyIssues(r)).toHaveLength(2)
})
it('rejects fabricated source evidence and accepts exact quotes', async () => {
  const settings = {} as Parameters<typeof runCoach>[4]
  const reply = {items: [{original: 'SQL', suggestion: 'Invented experience', category: 'supported', reason: 'Matches'}], followUp: ''}
  vi.mocked(callAI).mockResolvedValue(JSON.stringify(reply))
  expect((await runCoach('evidence', 'Used SQL for reporting', 'SQL required', '', settings)).status).toBe(502)
  reply.items[0].suggestion = 'Used SQL for reporting'
  vi.mocked(callAI).mockResolvedValue(JSON.stringify(reply))
  expect((await runCoach('evidence', 'Used SQL for reporting', 'SQL required', '', settings)).status).toBe(200)
})
