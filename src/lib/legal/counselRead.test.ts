import { describe, expect, it } from 'vitest'
import {
  counselReadDraftProblem,
  counselReadEntryBody,
  counselReadFacts,
  counselReadLine,
  counselReadMetaForDb,
  counselReadMetaFromDraft,
  counselReadMetaOf,
  counselTriesWords,
  currentCounselRead,
  isCounselReadEntry,
} from './counselRead'
import { plainWordsFailures } from '../plainWords'

const entry = (over: Partial<{ id: string; kind: string; meta: unknown; occurred_on: string; created_at: string; via_portal: boolean; voided_at: string | null; created_by: string | null }>) => ({
  id: 'e1', kind: 'note', meta: { read: { tries: 'hard', why: 'The GC disputes the change order.', cost_to_try: 2800, months: 9 } }, occurred_on: '2026-10-22', created_at: '2026-10-22T15:00:00Z', via_portal: true, voided_at: null, created_by: null,
  ...over,
})

describe('the attorney’s read as an entry (punch list #218, PR 2)', () => {
  it('reads the meta defensively and tells a read from any other note', () => {
    expect(counselReadMetaOf({ read: { tries: 'hard', why: 'w', cost_to_try: '2800', months: '9' } })).toEqual({ tries: 'hard', why: 'w', costToTry: 2800, months: 9 })
    expect(counselReadMetaOf({ read: { tries: 'easy' } })).toEqual({ tries: 'easy', why: '', costToTry: null, months: null })
    expect(counselReadMetaOf({ read: { tries: 'maybe' } })).toBeNull()
    expect(counselReadMetaOf({ settlementFloor: { amount: 1 } })).toBeNull()
    expect(counselReadMetaOf(null)).toBeNull()
    expect(isCounselReadEntry(entry({}))).toBe(true)
    expect(isCounselReadEntry(entry({ kind: 'question' }))).toBe(false)
    expect(isCounselReadEntry(entry({ meta: {} }))).toBe(false)
  })

  it('the current read is the latest one not undone, with whose it is and the name', () => {
    const office = entry({ id: 'e0', occurred_on: '2026-10-20', created_at: '2026-10-20T10:00:00Z', via_portal: false, created_by: 'u-1', meta: { read: { tries: 'easy', why: '' } } })
    const firm = entry({ meta: { read: { tries: 'hard', why: 'The GC disputes the change order.', cost_to_try: 2800, months: 9 }, recordedBy: { id: 'r1', name: 'D. Reyes' } } })
    const undone = entry({ id: 'e2', occurred_on: '2026-10-25', created_at: '2026-10-25T10:00:00Z', voided_at: '2026-10-26T00:00:00Z', meta: { read: { tries: 'easy' } } })
    const read = currentCounselRead([office, firm, undone], (id) => (id === 'u-1' ? 'Taunya' : null))!
    expect(read).toEqual({ tries: 'hard', why: 'The GC disputes the change order.', costToTry: 2800, months: 9, entryId: 'e1', ymd: '2026-10-22', by: 'firm', byName: 'D. Reyes' })
    expect(currentCounselRead([office], (id) => (id === 'u-1' ? 'Taunya' : null))?.byName).toBe('Taunya')
    expect(currentCounselRead([office])?.byName).toBe('')
    expect(currentCounselRead([undone])).toBeNull()
    expect(currentCounselRead([])).toBeNull()
  })

  it('a draft’s problem, and the meta it saves', () => {
    expect(counselReadDraftProblem({ tries: '', why: '', costText: '', monthsText: '' })).toBe('Say whether the case is easy or hard to try.')
    expect(counselReadDraftProblem({ tries: 'hard', why: '', costText: 'a lot', monthsText: '' })).toBe('The costs to try it are a dollar amount under a million, or blank.')
    expect(counselReadDraftProblem({ tries: 'hard', why: '', costText: '', monthsText: '9.5' })).toBe('Months to a judgment is a whole number up to 120, or blank.')
    expect(counselReadDraftProblem({ tries: 'hard', why: 'x'.repeat(2001), costText: '', monthsText: '' })).toBe('Keep the why under 2,000 characters.')
    expect(counselReadDraftProblem({ tries: 'easy', why: '', costText: '', monthsText: '' })).toBeNull()
    expect(counselReadMetaFromDraft({ tries: 'hard', why: ' why ', costText: '$2,800', monthsText: ' 9 ' })).toEqual({ tries: 'hard', why: 'why', costToTry: 2800, months: 9 })
    expect(counselReadMetaFromDraft({ tries: 'easy', why: '', costText: '', monthsText: '' })).toEqual({ tries: 'easy', why: '', costToTry: null, months: null })
    expect(counselReadMetaFromDraft({ tries: '', why: '', costText: '', monthsText: '' })).toBeNull()
    expect(counselReadMetaForDb({ tries: 'hard', why: 'w', costToTry: 2800, months: 9 })).toEqual({ tries: 'hard', why: 'w', cost_to_try: 2800, months: 9 })
  })

  it('the words: the chip, the facts, the entry body and whose read it is, in plain words', () => {
    expect(counselTriesWords('hard')).toBe('hard to try')
    expect(counselTriesWords('easy')).toBe('easy to try')
    expect(counselReadFacts({ costToTry: 2800, months: 9 })).toBe('Costs to try it $2,800.00. 9 months to a judgment.')
    expect(counselReadFacts({ costToTry: null, months: 1 })).toBe('1 month to a judgment.')
    expect(counselReadFacts({ costToTry: null, months: null })).toBe('')
    const body = counselReadEntryBody({ tries: 'hard', why: 'The GC disputes the change order.', costToTry: 2800, months: 9 })
    expect(body).toBe('How this case tries: hard. Costs to try it $2,800.00. 9 months to a judgment. The GC disputes the change order.')
    expect(counselReadEntryBody({ tries: 'easy', why: '', costToTry: null, months: null })).toBe('How this case tries: easy.')
    const read = currentCounselRead([entry({ meta: { read: { tries: 'hard', why: 'The GC disputes the change order.' }, recordedBy: { id: 'r', name: 'D. Reyes' } } })])!
    const day = (ymd: string) => (ymd === '2026-10-22' ? 'Oct 22' : ymd)
    expect(counselReadLine(read, day, 'office')).toBe("The firm's read, Oct 22: The GC disputes the change order.")
    expect(counselReadLine(read, day, 'firm')).toBe('Your read, Oct 22: The GC disputes the change order.')
    const ours = currentCounselRead([entry({ via_portal: false, meta: { read: { tries: 'easy' } } })])!
    expect(counselReadLine(ours, day, 'office')).toBe('Our read, Oct 22.')
    expect(counselReadLine(ours, day, 'firm')).toBe("The office's read, Oct 22.")
    for (const words of [body, counselReadLine(read, day, 'office'), counselReadFacts({ costToTry: 2800, months: 9 })]) expect(plainWordsFailures(words)).toEqual([])
  })
})
