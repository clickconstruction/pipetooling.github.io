import { describe, expect, it } from 'vitest'
import type { PayReceipt } from '../jobs/billedExpectedPay'
import type { PayCalendar } from '../jobs/payCalendar'
import {
  DIFFICULTY_PAYING_RULE_DEFAULT,
  difficultyPayingByHandOf,
  difficultyPayingByHandReason,
  difficultyPayingDriftWords,
  difficultyPayingKeptWords,
  difficultyPayingPick,
  difficultyPayingReadReason,
  difficultyPayingRuleWords,
  difficultyPayingWords,
  lateBillsInYear,
  readDifficultyPaying,
  type DifficultyPayingInputs,
} from './difficultyPaying'

const TODAY = '2026-11-14'
/** In by month end, paid the 10th of the next month. */
const CAL: PayCalendar = { cutoffDay: null, payDay: 10, monthsAfter: 1, payWhenPaid: false, clause: '', words: '' }

const receipt = (billedYmd: string, paidYmd: string, gapDays: number): PayReceipt => ({ billedYmd, paidYmd, gapDays, jobId: null, jobName: null, address: null })

const RECEIPTS: PayReceipt[] = [
  receipt('2026-09-02', '2026-10-24', 52), // due 2026-10-10, 14 days late
  receipt('2026-07-15', '2026-08-30', 46), // due 2026-08-10, 20 days late
  receipt('2026-05-03', '2026-06-09', 37), // due 2026-06-10, on time
  receipt('2025-06-01', '2025-08-01', 61), // more than a year ago
]

const inputs = (over: Partial<DifficultyPayingInputs> = {}): DifficultyPayingInputs => ({
  readable: true,
  own: { medianDays: 52, samples: 7 },
  receipts: RECEIPTS,
  gcPace: { medianDays: 35, payers: 9 },
  calendar: CAL,
  todayYmd: TODAY,
  ...over,
})

describe('difficultyPaying', () => {
  it('counts the bills in the last year that landed after their calendar due day; null with no calendar', () => {
    expect(lateBillsInYear(RECEIPTS, CAL, TODAY)).toBe(2)
    expect(lateBillsInYear(RECEIPTS, null, TODAY)).toBeNull()
    expect(lateBillsInYear([], CAL, TODAY)).toBe(0)
  })

  it('a point when the median is past the days', () => {
    const r = readDifficultyPaying(inputs())
    expect(r.points).toBe(1)
    expect(r.why).toBe('slow')
    expect(difficultyPayingWords(r)).toBe('Paid in 52 days, the median of 7 bills. The GC pace is 35 days. 2 bills in the last year went past their calendar.')
    expect(difficultyPayingReadReason(r)).toMatch(/^Read from their bills: Paid in 52 days/)
  })

  it('a point when enough bills in a year are late, though the median is fine', () => {
    const r = readDifficultyPaying(inputs({ own: { medianDays: 30, samples: 5 } }))
    expect(r.points).toBe(1)
    expect(r.why).toBe('late')
    const fine = readDifficultyPaying(inputs({ own: { medianDays: 30, samples: 5 }, calendar: null }))
    expect(fine.points).toBe(0)
    expect(fine.why).toBe('fine')
    expect(difficultyPayingWords(fine)).toBe('Paid in 30 days, the median of 5 bills. The GC pace is 35 days.')
    const none = readDifficultyPaying(inputs({ own: { medianDays: 30, samples: 5 }, receipts: [], gcPace: null }))
    expect(difficultyPayingWords(none)).toBe('Paid in 30 days, the median of 5 bills. None in the last year went past their calendar.')
  })

  it('fewer bills than the minimum reads no point and says so', () => {
    const r = readDifficultyPaying(inputs({ own: { medianDays: 80, samples: 2 }, receipts: RECEIPTS.slice(0, 2) }))
    expect(r.points).toBeNull()
    expect(r.why).toBe('too-few')
    expect(difficultyPayingWords(r)).toBe('2 bills on record, fewer than the 3 the read needs. No point.')
    const empty = readDifficultyPaying(inputs({ own: null, receipts: [] }))
    expect(difficultyPayingWords(empty)).toBe('No paid bill on record yet. The point is read once they have 3.')
    expect(difficultyPayingWords(readDifficultyPaying(inputs({ readable: false })))).toBe('Their bills could not be read, so the point is not known.')
  })

  it('the rule in a sentence, with the price list able to change it', () => {
    expect(difficultyPayingRuleWords(DIFFICULTY_PAYING_RULE_DEFAULT)).toBe('A point when the median is past 45 days, or 2 bills in a year are late. Read once a GC has 3 bills.')
    expect(readDifficultyPaying(inputs(), { daysPast: 60, lateBillsInYear: 3, minBills: 3 }).points).toBe(0)
  })

  it('the pick the card carries: by hand first, then the read, else nothing', () => {
    const read = readDifficultyPaying(inputs())
    expect(difficultyPayingPick(read, null)).toEqual({ points: 1, reason: difficultyPayingReadReason(read) })
    expect(difficultyPayingPick(read, { points: 0, reason: 'They pay us first every month.' })).toEqual({ points: 0, reason: 'By hand: They pay us first every month.' })
    expect(difficultyPayingPick(read, { points: 0, reason: '  ' })).toEqual({ points: 1, reason: difficultyPayingReadReason(read) })
    expect(difficultyPayingPick(readDifficultyPaying(inputs({ readable: false })), null)).toBeNull()
    expect(difficultyPayingByHandOf(difficultyPayingByHandReason('Slow.'))).toBe('Slow.')
    expect(difficultyPayingByHandOf('Read from their bills: x')).toBeNull()
  })

  it('bills that could not be read here keep the point the rating holds, with its words (v2.7468)', () => {
    const unreadable = readDifficultyPaying(inputs({ readable: false, own: null, receipts: [] }))
    const stored = { points: 1, reason: 'Read from their bills: Paid in 52 days, the median of 7 bills.' }
    // An estimator's save, or one made while the read failed: the stored point goes on, word for word.
    expect(difficultyPayingPick(unreadable, null, stored)).toEqual({ ...stored, kept: true })
    expect(difficultyPayingKeptWords(stored)).toBe('Their bills could not be read here. The rating keeps the 1 point it holds. Paid in 52 days, the median of 7 bills.')
    // A point set by hand is kept the same way.
    const hand = { points: 0, reason: 'By hand: They pay us first every month.' }
    expect(difficultyPayingPick(unreadable, null, hand)).toEqual({ ...hand, kept: true })
    expect(difficultyPayingKeptWords(hand)).toBe('Their bills could not be read here. The rating keeps the 0 points it holds. It was set by hand: They pay us first every month.')
    // Nothing stored, or a stored point with no words: nothing to keep.
    expect(difficultyPayingPick(unreadable, null, null)).toBeNull()
    expect(difficultyPayingPick(unreadable, null, { points: 1, reason: ' ' })).toBeNull()
    // A read that could be made decides, whatever is stored: a point, no point, or too few bills.
    const read = readDifficultyPaying(inputs())
    expect(difficultyPayingPick(read, null, { points: 0, reason: 'Read from their bills: Paid in 20 days, the median of 5 bills.' })).toEqual({ points: 1, reason: difficultyPayingReadReason(read) })
    expect(difficultyPayingPick(readDifficultyPaying(inputs({ own: { medianDays: 52, samples: 2 } })), null, stored)).toBeNull()
    // By hand on screen still comes first, and a read not back yet keeps nothing.
    expect(difficultyPayingPick(unreadable, { points: 1, reason: 'Slow.' }, stored)).toEqual({ points: 1, reason: 'By hand: Slow.' })
    expect(difficultyPayingPick(null, null, stored)).toBeNull()
  })

  it('says when the bills and the rating that stands disagree', () => {
    const read = readDifficultyPaying(inputs())
    expect(difficultyPayingDriftWords(null, read)).toBe('Their bills read 1 point now. The rating that stands has no Paying point yet. Save to read it in.')
    expect(difficultyPayingDriftWords({ points: 0, reason: 'Read from their bills: …' }, read)).toBe('Their bills read 1 point now; the rating holds 0. Save to read it in.')
    expect(difficultyPayingDriftWords({ points: 1, reason: 'Read from their bills: …' }, read)).toBeNull()
    expect(difficultyPayingDriftWords({ points: 0, reason: 'By hand: they pay first.' }, read)).toBeNull()
    expect(difficultyPayingDriftWords(null, readDifficultyPaying(inputs({ readable: false })))).toBeNull()
  })
})
