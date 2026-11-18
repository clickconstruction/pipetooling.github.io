/**
 * A follow-up deck card's Pipeline row, the reckoning (the Stages map's step 17): which section draws the job, which
 * of that section's rows are the job's, and the bill detail under the row. Made-up jobs and prices.
 */
import { describe, expect, it } from 'vitest'
import { followupRowBillDetail, followupRowsForJob, followupStageForJob } from './followupStageRow'
import type { StageRow } from '../jobsStagesBoard'

describe('followupStageForJob', () => {
  it('reads the board section off the job’s status', () => {
    expect(followupStageForJob({ status: 'waiting' })).toBe('waiting')
    expect(followupStageForJob({ status: 'working' })).toBe('working')
    expect(followupStageForJob({ status: 'ready_to_bill' })).toBe('ready_to_bill')
    expect(followupStageForJob({ status: 'billed' })).toBe('billed')
  })

  it('a billed job the office flagged sits in Collections, and only a billed one', () => {
    expect(followupStageForJob({ status: 'billed', collections_at: '2026-11-01T18:00:00Z' })).toBe('collections')
    expect(followupStageForJob({ status: 'billed', collections_at: null })).toBe('billed')
    // A stale flag on a job that went back does not move it.
    expect(followupStageForJob({ status: 'ready_to_bill', collections_at: '2026-11-01T18:00:00Z' })).toBe('ready_to_bill')
    expect(followupStageForJob({ status: 'working', collections_at: '2026-11-01T18:00:00Z' })).toBe('working')
  })

  it('a job with no status reads as Working, as on the board', () => {
    expect(followupStageForJob({})).toBe('working')
    expect(followupStageForJob({ status: null })).toBe('working')
  })

  it('Paid in Full and a status the board does not know draw no deck row', () => {
    expect(followupStageForJob({ status: 'paid' })).toBeNull()
    expect(followupStageForJob({ status: 'archived' })).toBeNull()
    expect(followupStageForJob({ status: '' })).toBeNull()
  })
})

describe('followupRowsForJob', () => {
  const row = (jobId: string, tag: string) => ({ kind: 'job', job: { id: jobId }, tag }) as unknown as StageRow
  const lists = {
    readyToBillRows: [row('a', 'rtb-a1'), row('b', 'rtb-b'), row('a', 'rtb-a2')],
    collectionsRows: [row('a', 'col-a'), row('c', 'col-c')],
    billedActiveRows: [row('b', 'bil-b'), row('a', 'bil-a')],
  }
  const tags = (rows: StageRow[]) => rows.map((r) => (r as unknown as { tag: string }).tag)

  it('takes the job’s rows from its own stage’s list, in the list’s order', () => {
    expect(tags(followupRowsForJob('ready_to_bill', lists, 'a'))).toEqual(['rtb-a1', 'rtb-a2'])
    expect(tags(followupRowsForJob('collections', lists, 'a'))).toEqual(['col-a'])
    expect(tags(followupRowsForJob('billed', lists, 'a'))).toEqual(['bil-a'])
    expect(tags(followupRowsForJob('billed', lists, 'b'))).toEqual(['bil-b'])
  })

  it('a job with no row in that stage gets none, whatever the other lists hold', () => {
    expect(followupRowsForJob('collections', lists, 'b')).toEqual([])
    expect(followupRowsForJob('ready_to_bill', lists, 'c')).toEqual([])
    expect(followupRowsForJob('billed', lists, 'c')).toEqual([])
  })
})

describe('followupRowBillDetail', () => {
  const fixture = (name: string | null, sequence_order: number, count: number | string | null, line_unit_price: number | string | null) => ({ name, sequence_order, count, line_unit_price })

  it('lists the named lines in their order, with a count and a price each', () => {
    const d = followupRowBillDetail({
      revenue: 4000,
      fixtures: [fixture('Rough in', 2, 1, 1500), fixture('Underground', 1, 2, 600), fixture('Top out', 3, 1, 900)],
    })
    expect(d.lineItems).toEqual([
      { name: 'Underground', count: 2, unitPrice: 600 },
      { name: 'Rough in', count: 1, unitPrice: 1500 },
      { name: 'Top out', count: 1, unitPrice: 900 },
    ])
    // The Bill tab's Job Total: count times price, summed.
    expect(d.jobTotalDollars).toBe(2 * 600 + 1500 + 900)
    expect(d.bidDollars).toBe(4000)
  })

  it('leaves out a line with no name, from the list and from the total', () => {
    const d = followupRowBillDetail({ revenue: 100, fixtures: [fixture('', 1, 1, 999), fixture('   ', 2, 1, 999), fixture(null, 3, 1, 999), fixture('Trim', 4, 1, 250)] })
    expect(d.lineItems).toEqual([{ name: 'Trim', count: 1, unitPrice: 250 }])
    expect(d.jobTotalDollars).toBe(250)
  })

  it('a missing count is one, a missing price is no price and adds nothing, and numbers kept as text still count', () => {
    const d = followupRowBillDetail({ revenue: '1200', fixtures: [fixture('A', 1, null, 100), fixture('B', 2, 3, null), fixture('C', 3, '2', '50')] })
    expect(d.lineItems).toEqual([
      { name: 'A', count: 1, unitPrice: 100 },
      { name: 'B', count: 3, unitPrice: null },
      { name: 'C', count: 2, unitPrice: 50 },
    ])
    expect(d.jobTotalDollars).toBe(100 + 2 * 50)
    expect(d.bidDollars).toBe(1200)
  })

  it('a job with no lines and no bid is all zeros', () => {
    expect(followupRowBillDetail({})).toEqual({ lineItems: [], jobTotalDollars: 0, bidDollars: 0 })
    expect(followupRowBillDetail({ fixtures: null, revenue: null })).toEqual({ lineItems: [], jobTotalDollars: 0, bidDollars: 0 })
  })

  it('does not reorder the job’s own list of lines', () => {
    const fixtures = [fixture('Second', 2, 1, 1), fixture('First', 1, 1, 1)]
    followupRowBillDetail({ fixtures })
    expect(fixtures.map((f) => f.name)).toEqual(['Second', 'First'])
  })
})
