import { describe, expect, it } from 'vitest'
import {
  BID_FLOW_STEP_DEFS,
  EMPTY_BID_FLOW_FACTS,
  bidFlowSegments,
  bidFlowSummary,
  deriveBidFlow,
  type BidFlowFacts,
  type BidFlowSource,
} from './bidFlow'

/**
 * Fixtures follow three real bids from the 2026-09-09 board walk: a bid that just
 * arrived (only the folder link), Galloway Park mid-flow (counted, taken off,
 * priced, letter next), and a sent bid from before the RFQ desk existed.
 */

const ALL_FALSE: BidFlowFacts = { hasRfq: false, hasCounts: false, hasTakeoffLines: false, hasPriceAssignments: false, hasRoom: false }

function bid(over: Partial<BidFlowSource> = {}): BidFlowSource {
  return {
    drive_link: null,
    plans_link: null,
    count_tooling_link: null,
    count_tooling_plans_link: null,
    bid_value: null,
    bid_date_sent: null,
    bid_submission_link: null,
    outcome: null,
    ...over,
  }
}

const states = (src: BidFlowSource, facts?: BidFlowFacts) => deriveBidFlow(src, facts).steps.map((s) => s.state)

describe("deriveBidFlow — the poster's twelve steps as the app's ten", () => {
  it("has ten steps in the poster's order, with both Intake steps around Send RFQ", () => {
    expect(BID_FLOW_STEP_DEFS.map((d) => d.key)).toEqual(['drive', 'rfq', 'tooling', 'count', 'takeoffs', 'price', 'review', 'letter', 'filed', 'sent'])
    expect(BID_FLOW_STEP_DEFS.map((d) => d.phase)).toEqual(['Intake', 'Ask', 'Intake', 'Count', 'Build', 'Build', 'Review', 'Letter', 'Letter', 'Send'])
  })

  it('a bid that just arrived: folder filed, RFQ is next, review untracked without the column', () => {
    const flow = deriveBidFlow(bid({ drive_link: 'https://drive/x' }), ALL_FALSE)
    expect(flow.steps.map((s) => s.state)).toEqual(['done', 'next', 'todo', 'todo', 'todo', 'todo', 'untracked', 'todo', 'todo', 'todo'])
    expect(flow.doneCount).toBe(1)
    expect(flow.trackedCount).toBe(9)
    expect(bidFlowSummary(flow)).toBe('1 of 9 done · next: Send RFQ')
  })

  it('Galloway Park mid-flow: counted, taken off, priced — Cover letter is next', () => {
    const facts: BidFlowFacts = { hasRfq: true, hasCounts: true, hasTakeoffLines: true, hasPriceAssignments: true, hasRoom: false }
    const flow = deriveBidFlow(bid({ drive_link: 'd', plans_link: 'p', count_tooling_plans_link: 'ct', bid_value: 412900 }), facts)
    expect(flow.steps.map((s) => s.state)).toEqual(['done', 'done', 'done', 'done', 'done', 'done', 'untracked', 'next', 'todo', 'todo'])
    expect(bidFlowSummary(flow)).toBe('6 of 9 done · next: Cover letter')
  })

  it('"next" is the first gap after the furthest finished step — an old bid with no RFQ on record is not nagged about it', () => {
    const facts: BidFlowFacts = { ...ALL_FALSE, hasCounts: true, hasTakeoffLines: true }
    const flow = deriveBidFlow(bid({ drive_link: 'd', bid_value: 50000, bid_submission_link: 's', bid_date_sent: '2026-08-01' }), facts)
    // rfq and tooling are unfinished but behind the furthest done step (sent) → plain "todo", no ring
    expect(flow.steps.find((s) => s.key === 'rfq')?.state).toBe('todo')
    expect(flow.steps.find((s) => s.key === 'tooling')?.state).toBe('todo')
    expect(flow.next).toBeNull()
    expect(bidFlowSummary(flow)).toBe('7 of 9 done · waiting on the GC')
  })

  it('a sent bid counts Cover letter and Sent as done off the one sent date', () => {
    const flow = deriveBidFlow(bid({ bid_date_sent: '2026-09-01' }), ALL_FALSE)
    expect(flow.steps.find((s) => s.key === 'letter')?.state).toBe('done')
    expect(flow.steps.find((s) => s.key === 'sent')?.state).toBe('done')
  })

  it('a decided bid goes quiet: nothing is "next" even with gaps', () => {
    const flow = deriveBidFlow(bid({ bid_date_sent: '2026-09-01', outcome: 'won' }), ALL_FALSE)
    expect(flow.decided).toBe(true)
    expect(flow.next).toBeNull()
    expect(flow.steps.some((s) => s.state === 'next')).toBe(false)
    expect(bidFlowSummary(flow)).toBe('2 of 9 done · decided')
  })

  it('facts not loaded yet read as loading, never as "not done"', () => {
    const flow = deriveBidFlow(bid({ drive_link: 'd' }), EMPTY_BID_FLOW_FACTS)
    expect(flow.loading).toBe(true)
    expect(flow.steps.find((s) => s.key === 'rfq')?.state).toBe('loading')
    expect(flow.steps.find((s) => s.key === 'count')?.state).toBe('loading')
    expect(bidFlowSummary(flow)).toBe('reading the bid…')
  })

  it('price reads a positive bid value OR price-book assignments; zero is not priced', () => {
    expect(states(bid({ bid_value: 0 }), ALL_FALSE)[5]).toBe('todo')
    expect(states(bid({ bid_value: 100 }), ALL_FALSE)[5]).toBe('done')
    expect(states(bid(), { ...ALL_FALSE, hasPriceAssignments: true })[5]).toBe('done')
  })

  it('review: no key → untracked; null → not yet; a stamp → done', () => {
    expect(states(bid(), ALL_FALSE)[6]).toBe('untracked')
    expect(states(bid({ reviewed_at: null }), ALL_FALSE)[6]).toBe('todo')
    expect(states(bid({ reviewed_at: '2026-09-09T20:00:00Z' }), ALL_FALSE)[6]).toBe('done')
    // with the column present the review counts as tracked
    expect(deriveBidFlow(bid({ reviewed_at: null }), ALL_FALSE).trackedCount).toBe(10)
  })

  it('blank strings are not links', () => {
    expect(states(bid({ drive_link: '   ' }), ALL_FALSE)[0]).toBe('next')
    expect(states(bid({ count_tooling_link: 'legacy' }), ALL_FALSE)[2]).toBe('done')
  })
})

describe('bidFlowSegments — the hairline', () => {
  it('splits into eight runs in poster order and rolls each run up', () => {
    const facts: BidFlowFacts = { hasRfq: true, hasCounts: true, hasTakeoffLines: true, hasPriceAssignments: true, hasRoom: false }
    const segs = bidFlowSegments(deriveBidFlow(bid({ drive_link: 'd', count_tooling_plans_link: 'ct', bid_value: 1 }), facts))
    expect(segs.map((s) => s.phase)).toEqual(['Intake', 'Ask', 'Intake', 'Count', 'Build', 'Review', 'Letter', 'Send'])
    expect(segs.map((s) => s.state)).toEqual(['done', 'done', 'done', 'done', 'done', 'untracked', 'next', 'todo'])
    expect(segs.map((s) => s.steps.length)).toEqual([1, 1, 1, 1, 2, 1, 2, 1])
  })

  it('a run with one of two steps done is not done', () => {
    const facts: BidFlowFacts = { ...ALL_FALSE, hasTakeoffLines: true }
    const build = bidFlowSegments(deriveBidFlow(bid(), facts)).find((s) => s.phase === 'Build')
    expect(build?.state).toBe('next')
  })
})
