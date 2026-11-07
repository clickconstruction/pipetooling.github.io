import { describe, expect, it } from 'vitest'
import { awardBaselineOptions, awardBaselinePick, awardBaselineRpcArgs, awardNotNowSource, awardPressWords, stageHoursWords, workbenchLineBudget, type AwardBaselineInput, type AwardBidBreakdown } from './awardBaseline'
import type { BaselineReading } from '../bids/bidBaselineRates'

const usableBid: AwardBidBreakdown = { has_estimate: true, labor_hours: 480, labor_rate: 42, labor_usd: 20_160, materials_usd: 38_400, completeness: { rows_total: 36, rows_with_hours: 36, rate_set: true, usable: true }, labor_hours_by_stage: { rough: 210, top: 150, trim: 120 } }
const thinBid: AwardBidBreakdown = { has_estimate: true, labor_hours: 71, labor_rate: 42, labor_usd: 2_982, materials_usd: 0, completeness: { rows_total: 31, rows_with_hours: 9, rate_set: true, usable: false }, labor_hours_by_stage: null }
const book: BaselineReading = { n: 12, medianHoursPerThousand: 4.2, p25: 3.5, p75: 5.1, impliedHours: 470.4, billed: 10, scope: 'similar' }
const thinBook: BaselineReading = { n: 2, medianHoursPerThousand: 4.2, p25: null, p75: null, impliedHours: 470.4, billed: 2, scope: 'all' }
const base: AwardBaselineInput = { breakdown: usableBid, bidLabel: 'B874', book, priceUsd: 120_000, rateUsd: 45, typedHours: null }

describe('awardBaselineOptions · three sources in order', () => {
  it('the bid with usable hours is the pick, with the stages and the book beside it as a second opinion', () => {
    const o = awardBaselineOptions(base)
    expect(o.map((x) => x.source)).toEqual(['bid', 'book', 'typed'])
    expect(o[0]).toMatchObject({ usable: true, hours: 480, head: "480 h · from the bid's Labor rows" })
    expect(o[0]!.why).toBe("36 of 36 rows carry hours. Rough In 210 h · Top Out 150 h · Trim Set 120 h. The bid's own number. This is the one that scores.")
    expect(o[1]).toMatchObject({ usable: true, hours: 470.4, head: '470 h · from the book, assumed' })
    expect(o[1]!.why).toBe('4.2 h per $1k × $120,000, from 12 similar projects. The book runs 2% under the bid here. Worth a look at the bid, not a reason to override it.')
    expect(o[2]).toMatchObject({ usable: false, hours: null, head: 'Typed' })
    expect(awardBaselinePick(o)).toBe('bid')
    expect(awardPressWords(o, 'bid')).toBe('Award it · 480 h from the bid')
  })
  it('a bid sent without enough hours is dead and says what would make it the pick; the book is picked, read as a guess', () => {
    const o = awardBaselineOptions({ ...base, breakdown: thinBid, bidLabel: 'B917', priceUsd: 112_000 })
    expect(o[0]).toMatchObject({ usable: false, hours: null })
    expect(o[0]!.why).toBe('Not usable: hours on 9 of 31 rows. Fill the Labor rows on B917 and this becomes the pick. The 9 rows carry 71 h.')
    expect(o[1]!.why).toBe('4.2 h per $1k × $112,000, from 12 similar projects. A guess, read as one. The line draws grey and the score skips it until a bid baseline or a typed one replaces it.')
    expect(awardBaselinePick(o)).toBe('book')
    expect(awardPressWords(o, 'book')).toBe('Award it · 470 h assumed')
    expect(awardNotNowSource(o)).toBe('book')
  })
  it('no bid and a thin book leave only the typed box; the dead ones say why', () => {
    const o = awardBaselineOptions({ breakdown: null, bidLabel: null, book: thinBook, priceUsd: 50_000, rateUsd: 45, typedHours: null })
    expect(o[0]!.why).toBe('No bid is linked to this job.')
    expect(o[1]).toMatchObject({ usable: false, why: '2 baselines in the book so far · needs 3.' })
    expect(awardBaselinePick(o)).toBe('typed')
    expect(awardPressWords(o, 'typed')).toBe('Award it · no baseline yet')
    expect(awardNotNowSource(o)).toBeNull()
    const typed = awardBaselineOptions({ breakdown: null, bidLabel: null, book: thinBook, priceUsd: 50_000, rateUsd: 45, typedHours: 220 })
    expect(typed[2]).toMatchObject({ usable: true, hours: 220, head: '220 h · typed' })
    expect(awardPressWords(typed, 'typed')).toBe('Award it · 220 h typed')
  })
  it('no price: the book needs one; a bid with no estimate says so', () => {
    const o = awardBaselineOptions({ breakdown: { ...usableBid, has_estimate: false }, bidLabel: 'B12', book, priceUsd: 0, rateUsd: 45, typedHours: null })
    expect(o[0]!.why).toBe('B12 has no cost estimate. Add hours on its Labor tab and this becomes the pick.')
    expect(o[1]!.why).toBe('Needs a price on the job.')
    expect(stageHoursWords(thinBid)).toBe('')
  })
})

describe('awardBaselineRpcArgs · what the press writes', () => {
  it('the bid pick names the bid and nothing else', () => {
    const o = awardBaselineOptions(base)
    expect(awardBaselineRpcArgs(base, o, 'bid', 'j1', 'b1')).toEqual({ p_job_id: 'j1', p_source: 'bid', p_bid_id: 'b1', p_labor_hours: null, p_labor_rate: null, p_book: {}, p_note: null })
    expect(awardBaselineRpcArgs(base, o, 'bid', 'j1', null)).toBeNull()
  })
  it('the book pick carries the hours, the rate and the reading it came from', () => {
    const i = { ...base, breakdown: thinBid }
    const o = awardBaselineOptions(i)
    expect(awardBaselineRpcArgs(i, o, 'book', 'j1', 'b1')).toEqual({ p_job_id: 'j1', p_source: 'book', p_bid_id: null, p_labor_hours: 470.4, p_labor_rate: 45, p_book: { hours_per_thousand: 4.2, n: 12, price_usd: 120_000, scope: 'similar', billed: 10 }, p_note: null })
  })
  it('the typed pick carries the hours and the note; a dead pick writes nothing', () => {
    const i = { ...base, typedHours: 220 }
    const o = awardBaselineOptions(i)
    expect(awardBaselineRpcArgs(i, o, 'typed', 'j1', null, '  Repeat of the Lakeside building ')).toMatchObject({ p_source: 'typed', p_labor_hours: 220, p_labor_rate: 45, p_note: 'Repeat of the Lakeside building' })
    expect(awardBaselineRpcArgs(base, awardBaselineOptions(base), 'typed', 'j1', null)).toBeNull()
  })
})

describe('workbenchLineBudget · the ◆ a carried line takes', () => {
  it('reads labor and materials as shares of the carried price at the bid rate', () => {
    expect(workbenchLineBudget(usableBid, 120_000, 45)).toEqual({ budget_labor_pct: 17, budget_materials_pct: 32, budget_source: 'workbench', budget_tuned_at: null, budget_rate_usd: 42 })
  })
  it('materials give way when the two would pass the price; the company rate stands in for a missing one', () => {
    expect(workbenchLineBudget({ ...usableBid, labor_usd: 70_000, materials_usd: 60_000, labor_rate: null }, 100_000, 45)).toEqual({ budget_labor_pct: 70, budget_materials_pct: 30, budget_source: 'workbench', budget_tuned_at: null, budget_rate_usd: 45 })
  })
  it('nothing without a usable estimate or a price', () => {
    expect(workbenchLineBudget(thinBid, 120_000, 45)).toBeNull()
    expect(workbenchLineBudget(usableBid, 0, 45)).toBeNull()
    expect(workbenchLineBudget(null, 120_000, 45)).toBeNull()
  })
})
