/**
 * The About picker's order, words and groups (v2.6205). Harlow Ranch's made-up pieces; nothing is real.
 */
import { describe, expect, it } from 'vitest'
import { aboutGroups, aboutKeyOf, aboutKeyOfPiece, aboutRows, aboutRowsOf } from './aboutPicker'
import type { MemberBid, MemberJob } from './overview'

function job(p: Partial<MemberJob> & { id: string; hcp_number: string }): MemberJob {
  return { click_number: null, job_name: null, job_address: null, customer_id: null, customer_name: null, gc_customer_id: null, development_id: 'd1', bid_id: null, status: 'waiting', revenue: null, payments_made: null, last_work_date: null, last_bill_date: null, job_plans_link: null, created_at: null, updated_at: null, ...p } as MemberJob
}
function bid(p: Partial<MemberBid> & { id: string; bid_number: string }): MemberBid {
  return { project_name: null, address: null, customer_id: null, estimator_id: null, account_manager_id: null, development_id: 'd1', outcome: null, outcome_at: null, bid_value: null, agreed_value: null, bid_date_sent: null, working_board_archived_at: null, ...p } as MemberBid
}
const INPUT = {
  development: { name: 'Harlow Ranch' },
  customer: { id: 'c1', name: 'Harlow Ranch LLC' },
  jobs: [job({ id: 'j957', hcp_number: '957', job_name: 'Mobilizations', status: 'waiting' }), job({ id: 'j568', hcp_number: '568', job_name: 'Lot 14', status: 'billed' }), job({ id: 'j958', hcp_number: '958', job_name: 'Crew weeks', status: 'working' })],
  bids: [bid({ id: 'b556', bid_number: '556', project_name: 'Bunker & Lodge', bid_date_sent: '2026-10-01' }), bid({ id: 'b600', bid_number: '600', project_name: 'Pool house' })],
  jobLabel: (j: MemberJob) => `JP${j.hcp_number}`,
  bidLabel: (b: MemberBid) => `BP${b.bid_number}`,
}

describe('aboutRows', () => {
  it('puts the site first, then jobs and bids newest number first with their stage or status, then the customer', () => {
    const rows = aboutRows(INPUT)
    expect(rows.map((r) => r.key)).toEqual(['site', 'job:j958', 'job:j957', 'job:j568', 'bid:b600', 'bid:b556', 'customer'])
    expect(rows.map((r) => r.label)).toEqual(['Harlow Ranch', 'JP958 Crew weeks', 'JP957 Mobilizations', 'JP568 Lot 14', 'BP600 Pool house', 'BP556 Bunker & Lodge', 'Harlow Ranch LLC'])
    expect(rows.map((r) => r.meta)).toEqual([null, 'Working', 'Waiting', 'Billed Awaiting Payment', 'working', 'sent', null])
    expect(rows.find((r) => r.key === 'job:j957')?.search).toBe('JP957 Mobilizations')
  })
  it('leaves the customer out when the development has none', () => {
    expect(aboutRows({ ...INPUT, customer: null }).map((r) => r.group)).not.toContain('customer')
  })
})

describe('aboutGroups', () => {
  const rows = aboutRows(INPUT)
  it('lists the pieces written about last under the site, newest line first, each once, never the site itself', () => {
    const entries = [
      { about: { kind: 'job' as const, id: 'j568' }, happenedAt: '2026-10-28T10:00:00Z' },
      { about: { kind: 'site' as const }, happenedAt: '2026-10-30T10:00:00Z' },
      { about: { kind: 'bid' as const, id: 'b556' }, happenedAt: '2026-10-29T10:00:00Z' },
      { about: { kind: 'job' as const, id: 'j568' }, happenedAt: '2026-10-30T09:00:00Z' },
      { about: { kind: 'job' as const, id: 'gone' }, happenedAt: '2026-10-30T11:00:00Z' },
    ]
    const groups = aboutGroups(rows, entries)
    expect(groups.map((g) => g.group)).toEqual(['site', 'recent', 'jobs', 'bids', 'customer'])
    expect(groups[1]!.rows.map((r) => r.key)).toEqual(['job:j568', 'bid:b556'])
    expect(groups[1]!.label).toBe('Written about last')
  })
  it('caps the recent group and leaves it out with no lines', () => {
    const many = ['j957', 'j568', 'j958'].map((id, i) => ({ about: { kind: 'job' as const, id }, happenedAt: `2026-10-2${i}T10:00:00Z` }))
    expect(aboutGroups(rows, many, 2)[1]!.rows.map((r) => r.key)).toEqual(['job:j958', 'job:j568'])
    expect(aboutGroups(rows, []).map((g) => g.group)).toEqual(['site', 'jobs', 'bids', 'customer'])
  })
  it('aboutRowsOf names every row once in picker order', () => {
    const groups = aboutGroups(rows, [{ about: { kind: 'job' as const, id: 'j568' }, happenedAt: '2026-10-28T10:00:00Z' }])
    expect(aboutRowsOf(groups).map((r) => r.key)).toEqual(['site', 'job:j568', 'job:j958', 'job:j957', 'bid:b600', 'bid:b556', 'customer'])
  })
})

describe('keys', () => {
  it('aboutKeyOf and aboutKeyOfPiece agree on a piece', () => {
    expect(aboutKeyOf({ kind: 'site' })).toBe('site')
    expect(aboutKeyOf({ kind: 'customer', id: 'c1' })).toBe('customer')
    expect(aboutKeyOf({ kind: 'job', id: 'j1' })).toBe('job:j1')
    expect(aboutKeyOfPiece({ jobId: 'j1', bidId: null, label: 'JP1' })).toBe('job:j1')
    expect(aboutKeyOfPiece({ jobId: null, bidId: 'b1', label: 'BP1' })).toBe('bid:b1')
    expect(aboutKeyOfPiece(null)).toBeNull()
  })
})
