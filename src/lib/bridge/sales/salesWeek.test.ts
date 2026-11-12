import { describe, expect, it } from 'vitest'
import { SALES_WEEK_EMPTY, salesHowCounted, salesLostReasons, salesWeekHeadline, salesWeekLine, salesWeekRows } from './salesWeek'
import { buildSalesDesk, type SalesDecidedBid, type SalesOpenBid } from './salesDesk'
import { buildBidWins, type BidSent } from '../bidWins'
import { buildEstimateWins } from '../estimateWins'
import { plainWordsFailures } from '../../plainWords'
import { ymdAddDays } from '../../../utils/dateUtils'

const TODAY = '2026-11-09'
const ago = (n: number): string => ymdAddDays(TODAY, -n)
const open = (id: string, asker: string, projectName: string, usd: number, ageDays: number): SalesOpenBid => ({ id, bidNumber: `B-${id}`, projectName, gcBuilderId: null, customerId: asker, usd, sentYmd: ago(ageDays), nextFollowupYmd: null, nextFollowupReason: null, lastContactYmd: null })
let seq = 0
const decided = (asker: string, outcome: 'won' | 'lost', usd: number, paceDays: number, lossCategory: string | null = null): SalesDecidedBid => {
  seq += 1
  return { id: `d${seq}`, gcBuilderId: null, customerId: asker, usd, sentYmd: ago(paceDays + 100), outcome, outcomeYmd: ago(100), lossCategory, lossReason: null, bidNumber: `${400 + seq}`, projectName: `Lot ${seq}` }
}
/** Five decided bids, so the asker reads at their own record, answering in `paceDays`. */
const record = (asker: string, paceDays: number, lossCategory: string | null, usd = 50_000): SalesDecidedBid[] => [decided(asker, 'won', usd, paceDays), ...[1, 2, 3, 4].map(() => decided(asker, 'lost', usd, paceDays, lossCategory))]
const names = new Map([['oak', 'Oak Hollow HOA'], ['cedar', 'Cedar Bend Dental'], ['pine', 'Pine Fork Homes'], ['ridge', 'Ridgeway Builders'], ['elm', 'Elm Court Clinic']])
const openBids = [
  open('o1', 'oak', 'Clubhouse', 212_000, 47),
  open('c1', 'cedar', 'North office', 90_000, 25),
  open('c2', 'cedar', 'South office', 30_000, 40),
  open('p1', 'pine', 'Phase 2', 500_000, 10),
  open('r1', 'ridge', 'Shell', 40_000, 30),
  open('e1', 'elm', 'Fit out', 0, 60),
]
const decidedBids = [...record('oak', 20, 'gc_lost'), ...record('cedar', 15, 'price'), ...record('pine', 30, 'price'), ...record('ridge', 10, null), ...record('elm', 12, 'no_answer', 40_000)]
const desk = buildSalesDesk({ todayYmd: TODAY, openBids, decidedBids, gcNames: names, openEstimates: [], fallbackRate: 0.2, estimateShare: null })
const sent = (usd: number, ageDays: number, outcome: string | null = null): BidSent => ({ sentYmd: ago(ageDays), outcome, usd, hasJob: false, jobUsd: null })

describe('salesWeekHeadline and salesWeekLine (punch list #303)', () => {
  it('says what is out and what it is worth, and nothing until a read lands', () => {
    expect(salesWeekHeadline({ outUsd: 2_900_000, worthUsd: 74_000 })).toBe('$2.9M is out. At our won rates that is about $74k.')
    expect(salesWeekHeadline(null)).toBeNull()
  })

  it('says what we sold a week against the field', () => {
    expect(salesWeekLine({ soldPerWeekUsd: 21_000, fieldPerWeekUsd: 33_000 })).toBe('We sold $21k a week. The field builds $33k.')
    expect(salesWeekLine({ soldPerWeekUsd: 21_000, fieldPerWeekUsd: null })).toBe('We sold $21k a week.')
    expect(salesWeekLine({ soldPerWeekUsd: null, fieldPerWeekUsd: 33_000 })).toBeNull()
  })
})

describe('salesWeekRows', () => {
  it('leads with the two askers past their usual answer, the biggest bid first, each with the door its row has', () => {
    const rows = salesWeekRows(desk, null)
    expect(rows.map((r) => r.title)).toEqual(['Call Oak Hollow HOA', 'Call Cedar Bend Dental'])
    expect(rows[0]!.sub).toBe('$212k bid. 27 days past their usual answer.')
    expect(rows[0]!.press).toEqual({ label: 'Open the bid', to: '/bids?tab=bid-board&bidId=o1' })
    // Cedar Bend has two bids past its answer: the call is about the bigger one.
    expect(rows[1]!.sub).toBe('$90k bid. 10 days past their usual answer.')
    expect(rows[1]!.press.to).toBe('/bids?tab=bid-board&bidId=c1')
    // An asker inside their usual answer is left alone.
    expect(rows.some((r) => r.title.includes('Pine Fork'))).toBe(false)
  })

  it('adds the old bids with no mark as the last row, only when there are any', () => {
    const none = buildBidWins({ todayYmd: TODAY, windowStart: ago(91), bids: [sent(20_000, 30), sent(20_000, 100)] })
    expect(salesWeekRows(desk, none).map((r) => r.kind)).toEqual(['call', 'call'])
    const old = buildBidWins({ todayYmd: TODAY, windowStart: ago(91), bids: [sent(20_000, 181), sent(40_000, 400), sent(20_000, 100)] })
    const rows = salesWeekRows(desk, old)
    expect(rows).toHaveLength(3)
    expect(rows[2]).toEqual({ key: 'mark-old', kind: 'mark', title: 'Mark 2 old bids won or lost', sub: 'The won rates rest on the marks.', press: { label: 'Open the Bid Board', to: '/bids?tab=bid-board' } })
    const one = buildBidWins({ todayYmd: TODAY, windowStart: ago(91), bids: [sent(20_000, 181)] })
    expect(salesWeekRows(null, one).map((r) => r.title)).toEqual(['Mark 1 old bid won or lost'])
  })

  it('reads a bid with no value in words, and one day as one day', () => {
    const lone = buildSalesDesk({ todayYmd: TODAY, openBids: [open('e1', 'elm', 'Fit out', 0, 13)], decidedBids: record('elm', 12, 'price'), gcNames: names, openEstimates: [], fallbackRate: 0.2, estimateShare: null })
    expect(salesWeekRows(lone, null)[0]!.sub).toBe('A bid with no value. 1 day past their usual answer.')
  })

  it('has nothing to say while the reads are in flight', () => {
    expect(salesWeekRows(null, null)).toEqual([])
  })
})

describe('salesLostReasons', () => {
  it('ranks the loss reasons by dollars, leaves Won out, and stops at three', () => {
    const reasons = salesLostReasons(desk.funnel)
    expect(reasons.map((r) => r.label)).toEqual(['Price too high', 'GC lost the project', 'No reason written'])
    expect(reasons.map((r) => [r.usd, r.count])).toEqual([[400_000, 8], [200_000, 4], [200_000, 4]])
    expect(reasons[0]!.door).toBeNull()
    expect(reasons[2]!.door).toEqual({ label: 'Name it on 4 bids', to: '/bids?tab=bid-board' })
    expect(salesLostReasons(desk.funnel, 10).map((r) => r.key)).toEqual(['price', 'gc_lost', 'none', 'no_answer'])
  })

  it('opens the one bid when a single loss has no reason', () => {
    const one = buildSalesDesk({ todayYmd: TODAY, openBids: [], decidedBids: [decided('oak', 'won', 10_000, 20), { ...decided('oak', 'lost', 30_000, 20), id: 'lone' }], gcNames: names, openEstimates: [], fallbackRate: null, estimateShare: null })
    expect(salesLostReasons(one.funnel)).toEqual([{ key: 'none', label: 'No reason written', usd: 30_000, count: 1, door: { label: 'Name it on 1 bid', to: '/bids?tab=bid-board&bidId=lone' } }])
  })
})

describe('salesHowCounted', () => {
  const bidWins = buildBidWins({ todayYmd: TODAY, windowStart: ago(91), bids: [sent(20_000, 300, 'won'), sent(20_000, 300, 'lost'), sent(40_000, 200), { ...sent(9_000, 20), leftOut: true }] })
  const estimateWins = buildEstimateWins({ todayYmd: TODAY, windowStart: ago(91), estimates: [{ sentYmd: ago(30), status: 'customer_accepted', usd: 3_000, customerKey: 'c1' }, { sentYmd: ago(30), status: 'declined', usd: 1_000, customerKey: 'c2' }] })
  const how = salesHowCounted(bidWins, estimateWins)
  const all = [...how, desk.howItReads]

  it('states the rules for a win and a loss', () => {
    expect(how).toContain('A bid counts as won or lost only when it is marked.')
    expect(how).toContain('With no mark it counts as 50% lost after 90 days and 95% lost after 180 days.')
    expect(how).toContain('A bid with no mark counts as out only for the part not yet counted as lost.')
    expect(how).toContain('Each bid is read at the won rate for bids its size.')
    expect(how).toContain('An estimate is lost when the customer declines it or gives no answer for 90 days.')
    expect(how).toContain('It is also lost when the customer passes it over for another at the same address.')
    expect(how).toContain('An estimate still out is read at the won rate for estimates, 75%.')
    expect(how).toContain('1 bid with no mark was sent over 180 days ago.')
    expect(how).toContain('1 sent bid is on what the Bridge leaves out. It is not counted.')
    expect(how).toContain('Only 2 bids are marked won or lost so far, so the rates can swing.')
  })

  it('says plainly that the list behind Every asker ranks by each asker’s own record', () => {
    // The list's own rules come from the desk, and open on that sentence.
    expect(desk.howItReads.startsWith('The list behind Every asker still ranks each asker by their own record.')).toBe(true)
    expect(desk.howItReads).toContain('A job made from a bid does not make it won.')
    expect(desk.howItReads).toContain('A loss with no reason opens on its bid, where Why we lost is written.')
  })

  it('reads while nothing has landed', () => {
    const bare = salesHowCounted(null, null)
    expect(bare).toContain('Estimates have no won rate yet, so the ones still out add nothing.')
    expect(bare).toHaveLength(9)
  })

  it('names no database column', () => {
    for (const s of all) expect(s).not.toMatch(/[a-z]_[a-z]/)
  })

  it('writes every sentence in plain words', () => {
    const rows = [...salesWeekRows(desk, buildBidWins({ todayYmd: TODAY, windowStart: ago(91), bids: [sent(20_000, 181)] }))]
    const written = [...all, ...salesHowCounted(null, null), ...rows.map((r) => r.sub), SALES_WEEK_EMPTY, salesWeekHeadline({ outUsd: 2_900_000, worthUsd: 74_000 }) ?? '', salesWeekLine({ soldPerWeekUsd: 21_000, fieldPerWeekUsd: 33_000 }) ?? '']
    for (const s of written) expect(plainWordsFailures(s), s).toEqual([])
    for (const r of rows) expect(r.title).not.toMatch(/[.—;()·]/)
  })
})
