import { describe, expect, it } from 'vitest'
import { subLinesOnSheet } from './sheetLines'
import type { ThreadMessage } from './thread'

const NOW = '2026-10-12T22:00:00Z'
const JOB = 'pipeline:job-1312'

// Manny Reyes, a sub, on the Oakridge tie-in (job 1312): the mock-up's card 12. He texts from two numbers.
const line = (p: Partial<ThreadMessage> & Pick<ThreadMessage, 'id' | 'at' | 'body'>): ThreadMessage => ({
  contactId: 'c-manny',
  jobId: JOB,
  channel: 'text',
  direction: 'in',
  who: 'Manny Reyes',
  ...p,
})
const LINES: ThreadMessage[] = [
  line({ id: 'm1', at: '2026-10-12T15:02:00Z', direction: 'out', who: 'Rosa', body: 'Manny, can you do the Oakridge tie-in this week?' }),
  line({ id: 'm2', at: '2026-10-12T20:12:00Z', body: 'This is Manny, I can do the Oakridge tie-in Friday' }),
  line({ id: 'm3', at: '2026-10-12T20:40:00Z', direction: 'team', channel: 'note', who: 'Rosa', body: 'Put him on the board for Friday.' }),
  line({ id: 'm4', at: '2026-10-11T18:00:00Z', contactId: 'c-manny-2', body: 'New number, this is Manny' }),
  line({ id: 'm5', at: '2026-10-12T21:00:00Z', jobId: 'pipeline:job-1400', body: 'Need the slab dims for 1400' }),
  line({ id: 'm6', at: '2026-10-12T21:30:00Z', contactId: 'c-dana', body: 'Is the plumber coming Friday?' }),
]

describe('messages/sheetLines', () => {
  it('reads the sub’s lines on the sheet’s job from every contact of theirs, oldest first', () => {
    const r = subLinesOnSheet({ job_ledger_id: 'job-1312' }, LINES, ['c-manny', 'c-manny-2'], NOW)
    expect(r.jobId).toBe(JOB)
    expect(r.lines.map((m) => m.id)).toEqual(['m4', 'm1', 'm2', 'm3'])
  })

  it('gives their last word to us on it, as the strip shows it', () => {
    const r = subLinesOnSheet({ job_ledger_id: 'job-1312' }, LINES, ['c-manny', 'c-manny-2'], NOW)
    expect(r.lastWord).toEqual({
      id: 'm2',
      contactId: 'c-manny',
      snippet: 'This is Manny, I can do the Oakridge tie-in Friday',
      when: 'today · 3:12 PM',
      at: '2026-10-12T20:12:00Z',
    })
  })

  it('has no last word when only we have written', () => {
    const r = subLinesOnSheet({ job_ledger_id: 'job-1312' }, LINES.slice(0, 1), ['c-manny'], NOW)
    expect(r.lines.map((m) => m.id)).toEqual(['m1'])
    expect(r.lastWord).toBeNull()
  })

  it('has nothing for a sheet with no job', () => {
    expect(subLinesOnSheet({ job_ledger_id: null }, LINES, ['c-manny'], NOW)).toEqual({ jobId: null, lines: [], lastWord: null })
  })

  it('reads a contact named twice once', () => {
    const r = subLinesOnSheet({ job_ledger_id: 'job-1312' }, LINES, ['c-manny', 'c-manny'], NOW)
    expect(r.lines.map((m) => m.id)).toEqual(['m1', 'm2', 'm3'])
  })
})
