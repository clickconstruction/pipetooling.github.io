import { describe, expect, it } from 'vitest'
import { awaitingChip, heldChip, printedChip, readyChip, shortDay } from './lienFootChip'

describe('the footer chip (v2.4855)', () => {
  it('shortDay reads an instant in the company calendar and a bare day as itself', () => {
    expect(shortDay('2026-10-07T19:24:33Z')).toBe('Oct 7')
    expect(shortDay('2026-10-08T03:30:00Z')).toBe('Oct 7') // 10:30 pm Central the night before
    expect(shortDay('2026-10-20')).toBe('Oct 20')
    expect(shortDay(null)).toBe('')
  })

  it('ready: the leader’s word with its day, the GC’s rule, or the approval day; the hover keeps the old sentence', () => {
    const word = readyChip({ approval_mode: 'word', approved_at: '2026-10-07T18:00:00Z', word_note: 'Malachi Whites RMP #41130, October 7, 2026', word_channel: 'standing_over' }, 'Southern Post', null)
    expect(word).toEqual({ tone: 'green', words: 'Approved · leader’s word · Oct 7', title: 'On the leader’s word · Malachi Whites RMP #41130, October 7, 2026 · standing over the desk · in the run.' })
    expect(readyChip({ approval_mode: 'rule' }, 'Southern Post', null).words).toBe('Approved · Southern Post’s standing rule')
    expect(readyChip({ approval_mode: 'rule' }, '', null).title).toBe("Approved by the GC's standing rule · in the run.")
    expect(readyChip({ approval_mode: 'leader', approved_at: '2026-10-06T15:00:00Z' }, null, 'Offer 10% by Nov 15')).toEqual({ tone: 'green', words: 'Approved · Oct 6 · Offer 10% by Nov 15', title: 'Approved October 6, 2026 · Offer 10% by Nov 15 · in the run.' })
  })

  it('ready after a take-back (punch list #101): the chip ends with the day, the hover says who and which print', () => {
    const chip = readyChip({ approval_mode: 'leader', approved_at: '2026-10-06T15:00:00Z' }, null, null, null, { tail: 'taken back Oct 8', sentence: 'Printed Oct 7, taken back Oct 8 by Dana. Nothing was mailed.' })
    expect(chip).toEqual({ tone: 'green', words: 'Approved · Oct 6 · taken back Oct 8', title: 'Approved October 6, 2026 · in the run. Printed Oct 7, taken back Oct 8 by Dana. Nothing was mailed.' })
  })

  it('awaiting, printed and held say the day and the why', () => {
    expect(awaitingChip({ submitted_at: '2026-10-07T14:12:00Z' })).toEqual({ tone: 'blue', words: 'Waiting on the leader · since Oct 7', title: 'Waiting on the leader since October 7, 2026.' })
    expect(awaitingChip(null).words).toBe('Waiting on the leader')
    expect(printedChip({ printed_at: '2026-09-14T16:00:00Z' })).toEqual({ tone: 'blue', words: 'Printed Sep 14 · in the mail', title: 'Printed September 14, 2026 · in the mail. Type its tracking numbers in the run to record it.' })
    expect(heldChip({ hold_reason: 'promised', hold_until: '2026-10-20' }, null)).toEqual({ tone: 'amber', words: 'Held · they promised · asks again Oct 20', title: 'Held — they promised · asks again October 20, 2026.' })
    expect(heldChip({ hold_reason: 'rule', hold_until: '2026-10-20' }, 'RMC').words).toBe('Held · RMC’s standing rule · asks again Oct 20')
    expect(heldChip({ hold_reason: 'call_first' }, null).words).toBe('Held · the leader will call first')
  })
})
