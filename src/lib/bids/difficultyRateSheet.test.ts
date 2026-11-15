import { describe, expect, it } from 'vitest'
import { DIFFICULTY_CRITERIA_V1, DIFFICULTY_CRITERIA_V2 } from './difficultyCriteria'
import { DIFFICULTY_PRICE_V1 } from './difficultyPrice'
import { readDifficultyPaying } from './difficultyPaying'
import {
  RATE_SHEET_WORDS,
  rateSheetBidNumbers,
  rateSheetConsequence,
  rateSheetGcRecord,
  rateSheetGcRecordWords,
  rateSheetOverTitle,
  rateSheetPayingWords,
  rateSheetSavePlan,
  rateSheetScales,
} from './difficultyRateSheet'
import type { BidPricingHistoryRow } from '../../types/database-functions'

const body = DIFFICULTY_CRITERIA_V1
const price = DIFFICULTY_PRICE_V1

describe('rateSheetOverTitle', () => {
  it('names the bid and the project, the parts that exist', () => {
    expect(rateSheetOverTitle({ label: 'b512', project: 'Riverside Lofts' })).toBe('Bid b512 · Riverside Lofts')
    expect(rateSheetOverTitle({ label: null, project: 'Riverside Lofts' })).toBe('Riverside Lofts')
    expect(rateSheetOverTitle({ label: ' ', project: '' })).toBeNull()
    expect(rateSheetOverTitle(null)).toBeNull()
  })
})

describe('rateSheetBidNumbers', () => {
  const pin = { fieldHours: 96, laborRate: 80, ownCostUsd: 11_000, carriedUsd: 21_000 }
  it('reads the pin first: what the lines were made from', () => {
    expect(rateSheetBidNumbers({ pin, stamp: { revenueUsd: 21_000, costUsd: 11_433, difficultyUsd: 433 }, bidValue: 21_000, estimate: { fieldHours: 10, laborRate: 50 } })).toEqual({
      fieldHours: 96,
      laborRate: 80,
      ownCost: 11_000,
      carried: 21_000,
      marginPct: 45.6,
      source: 'pin',
    })
  })
  it('with no pin: the estimate’s hours, the kept cost less its difficulty part, the kept price', () => {
    expect(rateSheetBidNumbers({ pin: null, stamp: { revenueUsd: 100_000, costUsd: 70_500, difficultyUsd: 500 }, bidValue: 90_000, estimate: { fieldHours: 480, laborRate: 80 } })).toEqual({
      fieldHours: 480,
      laborRate: 80,
      ownCost: 70_000,
      carried: 100_000,
      marginPct: 29.5,
      source: 'priced',
    })
  })
  it('with no price kept: the labor as the cost, the bid value to carry, no margin', () => {
    expect(rateSheetBidNumbers({ pin: null, stamp: null, bidValue: 50_000, estimate: { fieldHours: 100, laborRate: 80 } })).toEqual({ fieldHours: 100, laborRate: 80, ownCost: 8_000, carried: 50_000, marginPct: null, source: 'estimate' })
    expect(rateSheetBidNumbers({ pin: null, stamp: null, bidValue: null, estimate: { fieldHours: 100, laborRate: 80 } })?.carried).toBe(8_000)
  })
  it('is nothing when the bid has neither hours nor a cost', () => {
    expect(rateSheetBidNumbers({ pin: null, stamp: null, bidValue: 50_000, estimate: null })).toBeNull()
    expect(rateSheetBidNumbers({ pin: { fieldHours: 0, laborRate: 0, ownCostUsd: 0, carriedUsd: 0 }, stamp: null, bidValue: null, estimate: { fieldHours: 0, laborRate: 80 } })).toBeNull()
  })
})

describe('rateSheetScales', () => {
  it('gives each picked GC scale its sentence, in the criteria’s order', () => {
    const scales = rateSheetScales({ office: 1, field: 2, paying: 1 }, body)
    expect(scales.map((s) => [s.key, s.points])).toEqual([
      ['paying', 1],
      ['field', 2],
      ['office', 1],
    ])
    expect(scales.every((s) => s.sentence.length > 0)).toBe(true)
  })
})

describe('rateSheetConsequence', () => {
  const numbers = { fieldHours: 480, laborRate: 80, ownCost: 70_000, carried: 100_000, marginPct: 30, source: 'priced' as const }
  it('says the points in dollars and in hours, and what that is on the price', () => {
    const c = rateSheetConsequence({ picks: { field: 2, office: 1, paying: 1 }, body, price, numbers, payingReason: 'Read from their bills: Paid in 52 days, the median of 7 bills.', hasBid: true })
    // field 2 = 10% of 480 h at $80 = $3,840; office 1 = 12 h at $80 = $960; paying 1 = $100k × 1.5% × 7/30 = $350
    expect(c.head).toBe('4 points · about +$5,150 in cost')
    expect(c.detail).toBe('48 field hours, 12 office hours and the wait on their pay. About +$7,357 on the price at 30%.')
    expect(c.notes).toEqual([])
  })
  it('names a scale that adds nothing and the cap when it bites', () => {
    const c = rateSheetConsequence({ picks: { field: 3, office: 2 }, body, price, numbers: { ...numbers, ownCost: 20_000 }, payingReason: null, hasBid: true })
    expect(c.head).toBe('5 points · about +$2,000 in cost')
    expect(c.notes[0]).toContain('the price list holds them to $2,000')
    const none = rateSheetConsequence({ picks: { paying: 1 }, body, price, numbers, payingReason: 'Read from their bills: Paid in 40 days, the median of 7 bills.', hasBid: true })
    expect(none.head).toBe('1 point · nothing added to this bid')
    expect(none.notes).toEqual(['Paying adds nothing: their median is not past 45 days.'])
  })
  it('a bid not costed yet says so, with the points alone', () => {
    const c = rateSheetConsequence({ picks: { field: 2 }, body, price, numbers: null, payingReason: null, hasBid: true })
    expect(c.head).toBe('2 points')
    expect(c.detail).toBe(RATE_SHEET_WORDS.notCosted)
    expect(c.lines).toBeNull()
  })
  it('the end-of-job ask has no bid: the points are for the bids to come', () => {
    const c = rateSheetConsequence({ picks: { field: 1, office: 1 }, body, price, numbers: null, payingReason: null, hasBid: false })
    expect(c.head).toBe('2 points')
    expect(c.detail).toBe(RATE_SHEET_WORDS.noBid)
  })
  it('one field hour reads in the singular and a margin with a fraction keeps one decimal', () => {
    const c = rateSheetConsequence({ picks: { field: 1 }, body, price, numbers: { fieldHours: 20, laborRate: 80, ownCost: 10_000, carried: 12_000, marginPct: 16.7, source: 'priced' }, payingReason: null, hasBid: true })
    expect(c.detail).toBe('1 field hour. About +$96 on the price at 16.7%.')
  })
})

describe('rateSheetPayingWords', () => {
  const read = readDifficultyPaying({ readable: true, own: { medianDays: 52, samples: 7 }, receipts: [], gcPace: null, calendar: null, todayYmd: '2026-11-15' })
  it('a read point: the numbers behind it, and not yours to pick', () => {
    expect(rateSheetPayingWords({ pick: { points: 1, reason: 'Read from their bills: Paid in 52 days, the median of 7 bills.' }, read })).toBe('1 point from their bills · Paid in 52 days, the median of 7 bills. Not yours to pick.')
  })
  it('a by-hand point says whose words set it', () => {
    expect(rateSheetPayingWords({ pick: { points: 1, reason: 'By hand: They hold retainage for a year.' }, read: null })).toBe('1 point, set by hand: They hold retainage for a year. Not yours to pick.')
    // The walk of part 5 read a reason typed with no full stop run into the next sentence.
    expect(rateSheetPayingWords({ pick: { points: 1, reason: 'By hand: their bills are on another system' }, read: null })).toBe('1 point, set by hand: their bills are on another system. Not yours to pick.')
  })
  it('no point: why the bills give none, or not read yet', () => {
    const few = readDifficultyPaying({ readable: true, own: { medianDays: 20, samples: 1 }, receipts: [], gcPace: null, calendar: null, todayYmd: '2026-11-15' })
    expect(rateSheetPayingWords({ pick: null, read: few })).toBe('1 bill on record, fewer than the 3 the read needs. No point. Not yours to pick.')
    expect(rateSheetPayingWords({ pick: null, read: null })).toBe('Not read yet.')
  })
})

describe('rateSheetGcRecord', () => {
  const row = (customer_id: string, outcome: 'won' | 'lost', bid_value: number, est_cost: number): BidPricingHistoryRow => ({ bid_id: `${customer_id}-${bid_value}`, project_name: null, outcome, loss_reason: null, bid_value, est_cost, customer_id })
  const rows = [row('gc', 'won', 100_000, 72_000), row('gc', 'won', 50_000, 34_000), row('gc', 'lost', 80_000, 60_000), row('other', 'won', 10_000, 5_000)]
  it('tallies this GC’s decided bids and the margin band of the won ones', () => {
    const r = rateSheetGcRecord(rows, 'gc')
    expect(r).toEqual({ total: 3, won: 2, lowPct: 28, highPct: 32 })
    expect(rateSheetGcRecordWords(r)).toBe('Bids like this: won 2 of 3 to them, at 28 to 32%.')
  })
  it('one won bid is one margin; none won, or none with a cost, is the tally alone', () => {
    expect(rateSheetGcRecordWords(rateSheetGcRecord([rows[0]!], 'gc'))).toBe('Bids like this: won 1 of 1 to them, at 28%.')
    expect(rateSheetGcRecordWords(rateSheetGcRecord([rows[2]!], 'gc'))).toBe('Bids like this: won 0 of 1 to them.')
    expect(rateSheetGcRecordWords(rateSheetGcRecord([row('gc', 'won', 100_000, 0)], 'gc'))).toBe('Bids like this: won 1 of 1 to them.')
  })
  it('leaves the line out with no decided bid to them, or no read', () => {
    expect(rateSheetGcRecord(rows, 'nobody')).toBeNull()
    expect(rateSheetGcRecord(null, 'gc')).toBeNull()
    expect(rateSheetGcRecordWords(null)).toBeNull()
  })
})

describe('the bid’s own picks on the sheet (PR 6)', () => {
  const numbers = { fieldHours: 480, laborRate: 80, ownCost: 70_000, carried: 100_000, marginPct: 30, source: 'priced' as const }
  it('prices the site with the GC’s picks, from a bid only', () => {
    expect(rateSheetScales({ field: 2 }, DIFFICULTY_CRITERIA_V2, { site: 1 }).map((s) => `${s.key} ${s.points}`)).toEqual(['field 2', 'site 1'])
    const c = rateSheetConsequence({ picks: { field: 2 }, body: DIFFICULTY_CRITERIA_V2, price, numbers, payingReason: null, hasBid: true, bidPicks: { site: 1 } })
    // field 2 = 48 h, site 1 = 4% of 480 = 19.2 h, at $80
    expect(c.head).toBe('3 points · about +$5,376 in cost')
    expect(c.detail).toBe('67.2 field hours. About +$7,680 on the price at 30%.')
    const ask = rateSheetConsequence({ picks: { field: 2 }, body: DIFFICULTY_CRITERIA_V2, price, numbers: null, payingReason: null, hasBid: false, bidPicks: { site: 1 } })
    expect(ask.head).toBe('2 points')
  })

  describe('rateSheetSavePlan', () => {
    const base = { fromAsk: false, hasStanding: true, gcChanged: false, gcPicked: true, gcProblems: [] as string[], bidChanged: false, noPickWords: 'Pick at least one sentence.' }
    it('nothing moved: dead, and says so', () => {
      expect(rateSheetSavePlan(base)).toEqual({ rating: false, bidPicks: false, dead: true, why: RATE_SHEET_WORDS.nothingChanged })
      expect(rateSheetSavePlan({ ...base, hasStanding: false, gcPicked: false })).toMatchObject({ dead: true, why: 'Pick at least one sentence.' })
    })
    it('only the site moved: saves the bid’s picks, and the GC’s rules do not bind', () => {
      expect(rateSheetSavePlan({ ...base, bidChanged: true, gcProblems: ['Say what happened.'] })).toEqual({ rating: false, bidPicks: true, dead: false, why: null })
    })
    it('the rating moved: its rules bind, and the site rides along', () => {
      expect(rateSheetSavePlan({ ...base, gcChanged: true, bidChanged: true, gcProblems: ['Say what happened.'] })).toEqual({ rating: true, bidPicks: true, dead: true, why: 'Say what happened.' })
      expect(rateSheetSavePlan({ ...base, gcChanged: true, bidChanged: true })).toEqual({ rating: true, bidPicks: true, dead: false, why: null })
    })
    it('from the ask the rating is always saved', () => {
      expect(rateSheetSavePlan({ ...base, fromAsk: true })).toEqual({ rating: true, bidPicks: false, dead: false, why: null })
      expect(rateSheetSavePlan({ ...base, fromAsk: true, gcProblems: ['Say what happened.'] }).dead).toBe(true)
    })
  })
})
