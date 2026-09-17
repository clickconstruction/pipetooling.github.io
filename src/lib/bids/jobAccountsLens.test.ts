import { describe, expect, it } from 'vitest'
import type { BidJobAccountRow } from '../../hooks/useBidJobAccountStrip'
import { askRepLabel, buildJobAccountsLens, daysUntil, describeStart, emailableRows, lensRollup, startTone, type JobAccountsLensBid } from './jobAccountsLens'

const today = new Date('2026-09-17T15:00:00')

function row(over: Partial<BidJobAccountRow>): BidJobAccountRow {
  return {
    bid_id: 'b398', job_id: 'j1018', job_hcp_number: '1018', job_click_number: null, job_name: 'Pondhill Building 2', job_address: '4114 Pond Hill Rd',
    supply_house_id: 'h-ferg', house_name: 'Ferguson', policy: 'expects', quoted: false, status: null, account_ref: null,
    opened_via: null, opened_at: null, requested_at: null, rep_contact_id: 'c-curly', rep_name: 'Curly Conley', rep_phone: null, rep_email: 'curly@ferguson.com',
    ...over,
  }
}
function bid(over: Partial<JobAccountsLensBid>): JobAccountsLensBid {
  return { id: 'b398', label: 'b398', projectName: 'Pondhill Building 2', gcName: 'H & I Construction', address: null, estimatorName: 'Tristen', estimatorUserId: 'u-tristen', accountManagerUserId: null, startDate: '2026-09-18', wonDate: '2026-09-08', ...over }
}

describe('buildJobAccountsLens', () => {
  const byBid = new Map<string, BidJobAccountRow[]>([
    // Pondhill: Moore open, Ferguson none, Reece none → two rows
    ['b398', [row({ supply_house_id: 'h-moore', house_name: 'Moore Supply', status: 'open' }), row({}), row({ supply_house_id: 'h-reece', house_name: 'Reece', rep_contact_id: null, rep_name: null, rep_email: null })]],
    // SpaceX: Ferguson requested → one row, not emailable
    ['b375', [row({ bid_id: 'b375', job_id: 'j1007', job_hcp_number: '1007', job_name: 'SpaceX BA-02N', status: 'requested', requested_at: '2026-09-12T10:00:00Z' })]],
    // Vaughn: Ferguson none, no rep on the row
    ['b412', [row({ bid_id: 'b412', job_id: 'j990', job_hcp_number: '990', job_name: 'Vaughn residence', rep_contact_id: null, rep_name: null, rep_email: null })]],
    // Take 5: won, no job → the quoted house, job null
    ['b402', [row({ bid_id: 'b402', job_id: null, job_hcp_number: null, job_name: null, job_address: null, quoted: true })]],
    // Done: everything open → no rows
    ['b300', [row({ bid_id: 'b300', job_id: 'j900', status: 'open' })]],
  ])
  const bids = [
    bid({}),
    bid({ id: 'b375', label: 'b375', projectName: 'SpaceX BA-02N', gcName: 'Structura', startDate: '2026-10-07' }),
    bid({ id: 'b412', label: 'b412', projectName: 'Vaughn residence', gcName: 'Dudley Mason', estimatorName: 'Bill', estimatorUserId: 'u-bill', startDate: '2026-09-24' }),
    bid({ id: 'b402', label: 'b402', projectName: 'Take 5 · Buda', gcName: 'Summit GC', estimatorName: 'Wendi', estimatorUserId: 'u-wendi', startDate: null, wonDate: '2026-09-13' }),
    bid({ id: 'b300', label: 'b300', projectName: 'Done job' }),
    bid({ id: 'b999', label: 'b999', projectName: 'Not on the strip' }),
  ]

  it('groups the missing houses by house, biggest first, and counts jobs and no-job bids', () => {
    const lens = buildJobAccountsLens(bids, byBid, { authUserId: 'u-tristen', today })
    expect(lens.groups.map((g) => [g.houseName, g.rows.length])).toEqual([['Ferguson', 4], ['Reece', 1]])
    expect(lens.jobsMissing).toBe(3)
    expect(lens.bidsWithoutJob).toBe(1)
    expect(lens.rows).toBe(5)
    expect(lensRollup(lens)).toBe('3 jobs · 2 houses · 1 won bid with no job yet')
  })

  it('sorts a house’s rows soonest first parts run first, no date last', () => {
    const lens = buildJobAccountsLens(bids, byBid, { authUserId: null, today })
    const ferguson = lens.groups[0]!
    expect(ferguson.rows.map((r) => r.bidLabel)).toEqual(['b398', 'b412', 'b375', 'b402'])
    expect(ferguson.rows.map((r) => r.daysUntilStart)).toEqual([1, 7, 20, null])
    expect(ferguson.rep).toEqual({ id: 'c-curly', name: 'Curly Conley', email: 'curly@ferguson.com', phone: null })
    expect(lens.groups[1]!.rep).toBeNull()
  })

  it('keeps the state and the job on the row, and a won bid with no job has job null', () => {
    const lens = buildJobAccountsLens(bids, byBid, { authUserId: null, today })
    const rows = lens.groups[0]!.rows
    expect(rows.find((r) => r.bidId === 'b375')?.state).toBe('requested')
    expect(rows.find((r) => r.bidId === 'b398')?.job?.hcpNumber).toBe('1018')
    const take5 = rows.find((r) => r.bidId === 'b402')!
    expect(take5.job).toBeNull()
    expect(take5.quoted).toBe(true)
    expect(take5.projectName).toBe('Take 5 · Buda')
  })

  it('an email to the house covers rows with a job that nobody has asked about yet', () => {
    const lens = buildJobAccountsLens(bids, byBid, { authUserId: null, today })
    expect(emailableRows(lens.groups[0]!).map((r) => r.bidId)).toEqual(['b398', 'b412'])
  })

  it('Only my bids keeps the rows I estimate or manage', () => {
    const lens = buildJobAccountsLens(bids, byBid, { authUserId: 'u-tristen', today, onlyMine: true })
    expect(lens.groups.map((g) => [g.houseName, g.rows.map((r) => r.bidId)])).toEqual([['Ferguson', ['b398', 'b375']], ['Reece', ['b398']]])
    expect(lens.jobsMissing).toBe(2)
    expect(lens.bidsWithoutJob).toBe(0)
  })
})

describe('the words', () => {
  it('days until the start, and how the row says it', () => {
    expect(daysUntil('2026-09-18', today)).toBe(1)
    expect(daysUntil('2026-09-17', today)).toBe(0)
    expect(daysUntil('2026-09-10', today)).toBe(-7)
    expect(daysUntil(null, today)).toBeNull()
    expect(daysUntil('not a date', today)).toBeNull()
    expect(describeStart(1)).toBe('in 1 day')
    expect(describeStart(0)).toBe('today')
    expect(describeStart(-7)).toBe('7 days ago')
    expect(describeStart(20)).toBe('in 20 days')
    expect(describeStart(null)).toBe('no date')
  })
  it('tone: red inside three days or past, amber inside ten', () => {
    expect(startTone(-2)).toBe('red')
    expect(startTone(3)).toBe('red')
    expect(startTone(7)).toBe('amber')
    expect(startTone(11)).toBeNull()
    expect(startTone(null)).toBeNull()
  })
  it('the ask button names the rep and the count', () => {
    expect(askRepLabel('Curly Conley', 1)).toBe('Ask Curly')
    expect(askRepLabel('Curly Conley', 2)).toBe('Ask Curly for both')
    expect(askRepLabel('Curly Conley', 3)).toBe('Ask Curly for all three')
    expect(askRepLabel(null, 2)).toBe('Ask the rep for both')
  })
})
