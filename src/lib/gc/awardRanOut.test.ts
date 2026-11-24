import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { AWARD_RAN_OUT_CONFIRM, awardRanOutConfirmWords, awardRanOutLine } from './awardRanOut'
import type { SubBid } from './types'

/** A made-up quote sent Oct 8 with no day said. */
const NO_DAY: SubBid = { amount: 12500, submittedOn: '2026-10-08', basedOnRev: 0, includes: {}, plugs: {}, note: '' }
/** The same quote holding 30 days: good until Nov 7. */
const bid = (): SubBid => ({ ...NO_DAY, goodForDays: 30 })

describe('awardRanOutLine', () => {
  it('names the day once the number is past it', () => {
    expect(awardRanOutLine(bid(), '2026-11-24')).toBe('Their number ran out Nov 7. Ask them whether it still holds.')
  })

  it('says nothing while the number holds, on its last day too', () => {
    expect(awardRanOutLine(bid(), '2026-11-07')).toBeNull()
    expect(awardRanOutLine(bid(), '2026-10-09')).toBeNull()
  })

  it('says nothing when they gave no day, or there is no quote', () => {
    expect(awardRanOutLine(NO_DAY, '2026-11-24')).toBeNull()
    expect(awardRanOutLine(null, '2026-11-24')).toBeNull()
  })
})

describe('awardRanOutConfirmWords', () => {
  it('asks first, names the trade, the company and the day, and its button names the act', () => {
    const words = awardRanOutConfirmWords('Concrete', 'Lone Star Concrete', bid(), '2026-11-24')
    expect(words).toEqual({
      title: 'Award Concrete to Lone Star Concrete on a number that ran out?',
      message: 'Lone Star Concrete held this number until Nov 7. They may not do the work for it now. Ask them whether it still holds. The award drafts the statement of work at this number.',
      confirmLabel: 'Award on this number',
    })
    expect(words?.confirmLabel).toBe(AWARD_RAN_OUT_CONFIRM)
    expect(plainWordsFailures(words?.message ?? '')).toEqual([])
  })

  it('is null while the number holds, so the press awards with no window', () => {
    expect(awardRanOutConfirmWords('Concrete', 'Lone Star Concrete', bid(), '2026-11-07')).toBeNull()
    expect(awardRanOutConfirmWords('Concrete', 'Lone Star Concrete', NO_DAY, '2026-11-24')).toBeNull()
    expect(awardRanOutConfirmWords('Concrete', 'Lone Star Concrete', null, '2026-11-24')).toBeNull()
  })
})
