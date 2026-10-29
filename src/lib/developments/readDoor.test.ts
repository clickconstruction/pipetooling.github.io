import { describe, expect, it } from 'vitest'
import { countKeysFor, developmentDoorFor, jobDoorClosedWords, OFFICE_READS_MONEY, parseDevelopmentOverview, stripBidMoney } from './readDoor'
import { bidMoney, headCounts, jobOpenOnBill } from './overview'
import { plainWordsFailures } from '../plainWords'

describe('developmentDoorFor', () => {
  it('sends the roles with a jobs_ledger read in the office door, as the Job window lists them', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'primary'] as const) expect(developmentDoorFor(role)).toBe('office')
  })
  it('sends an estimator, who has no jobs_ledger read, through the overview', () => {
    expect(developmentDoorFor('estimator')).toBe('overview')
  })
  it('sends a role with no jobs read, or no role yet, through the overview, which refuses anyone outside the office team', () => {
    expect(developmentDoorFor('superintendent')).toBe('overview')
    expect(developmentDoorFor('helpers')).toBe('overview')
    expect(developmentDoorFor(null)).toBe('overview')
    expect(developmentDoorFor(undefined)).toBe('overview')
  })
})

describe('countKeysFor', () => {
  it('keeps the two money tiles for the office alone', () => {
    expect(countKeysFor('office')).toEqual(['waiting', 'bids', 'jobs', 'bidUndecided', 'openOnBills'])
    expect(countKeysFor('overview')).toEqual(['waiting', 'bids', 'jobs'])
  })
})

describe('the no-money words', () => {
  it('read in plain words', () => {
    expect(plainWordsFailures(OFFICE_READS_MONEY)).toEqual([])
    expect(plainWordsFailures(jobDoorClosedWords('JP956'))).toEqual([])
  })
})

describe('parseDevelopmentOverview', () => {
  const raw = {
    development: { id: 'd1', name: 'ZZ Test development' },
    bids: [
      { id: 'b1', bid_number: '161', project_name: 'Lot 4', address: '1 Gun Dog Trl', outcome: null, bid_date_sent: '2026-10-01', estimator_id: 'u1', created_at: '2026-09-01T00:00:00Z', development_id: 'd1', notes: 'two phases' },
      { bid_number: 'no id' },
    ],
    jobs: [{ id: 'j1', hcp_number: '956', job_name: 'Lot 4', status: 'billed', bid_id: 'b1', development_id: 'd1', last_work_date: '2026-10-20', created_at: '2026-09-02T00:00:00Z' }],
    status_events: [
      { id: 'e1', job_id: 'j1', changed_at: '2026-10-21T00:00:00Z', from_status: 'working', to_status: 'billed', changed_by_user_id: 'u2' },
      { id: 'e2', job_id: 'j1', changed_at: '2026-10-21T00:00:00Z' },
    ],
    team_members: [{ job_id: 'j1', user_id: 'u3' }, { job_id: 'j1' }],
  }
  it('hands the kernels bids and jobs with every money column null, so no figure can be drawn', () => {
    const out = parseDevelopmentOverview(raw)
    expect(out.bids.map((b) => b.id)).toEqual(['b1'])
    expect(out.bids[0]).toMatchObject({ bid_number: '161', project_name: 'Lot 4', bid_date_sent: '2026-10-01', notes: 'two phases', bid_value: null, agreed_value: null, priced_revenue_usd: null })
    expect(bidMoney(out.bids[0]!)).toBeNull()
    expect(out.jobs[0]).toMatchObject({ hcp_number: '956', status: 'billed', bid_id: 'b1', revenue: null, payments_made: null, last_bill_date: null, pct_complete: null, collections_note: null })
    expect(jobOpenOnBill(out.jobs[0]!)).toBe(0)
    const counts = headCounts({ bids: out.bids, jobs: out.jobs }, [], Date.parse('2026-10-29T12:00:00Z'))
    expect(counts.bids.total).toBe(1)
    expect(counts.jobs.total).toBe(1)
    expect(counts.bidUndecidedUsd).toBe(0)
    expect(counts.openOnBillsUsd).toBe(0)
  })
  it('keeps the stage moves and the crews, dropping a row that lacks its keys', () => {
    const out = parseDevelopmentOverview(raw)
    expect(out.statusEvents).toEqual([{ id: 'e1', job_id: 'j1', changed_at: '2026-10-21T00:00:00Z', from_status: 'working', to_status: 'billed', changed_by_user_id: 'u2' }])
    expect(out.teamMembers).toEqual([{ job_id: 'j1', user_id: 'u3' }])
  })
  it('reads a missing list as empty and refuses an answer that is not an object', () => {
    expect(parseDevelopmentOverview({ development: { id: 'd1', name: 'x' } })).toEqual({ bids: [], jobs: [], statusEvents: [], teamMembers: [] })
    expect(() => parseDevelopmentOverview(null)).toThrow(/did not read/)
    expect(() => parseDevelopmentOverview('[]')).toThrow(/did not read/)
  })
})

describe('stripBidMoney', () => {
  it('nulls the three money columns and keeps the rest', () => {
    const out = stripBidMoney({ id: 'b1', bid_number: '161', bid_value: 1000, agreed_value: 900, priced_revenue_usd: 800 })
    expect(out).toEqual({ id: 'b1', bid_number: '161', bid_value: null, agreed_value: null, priced_revenue_usd: null })
  })
})
