import { describe, expect, it } from 'vitest'
import {
  bidFallbackLabel,
  bidLabelsForIds,
  jobFallbackLabel,
  jobLabelsForIds,
  missingJobBidLabelIds,
  type MyTimeBidLabelRow,
  type MyTimeJobLabelRow,
} from './myTimeJobBidLabels'
import { formatBidLedgerSummaryLine, formatJobLedgerSummaryLine } from './ledgerDisplayPrefixes'

const JOB_A = 'aaaaaaaa-1111-4111-8111-111111111111'
const JOB_B = 'bbbbbbbb-2222-4222-8222-222222222222'
const BID_C = 'cccccccc-3333-4333-8333-333333333333'

const s = (job_ledger_id: string | null, bid_id: string | null) => ({ job_ledger_id, bid_id })

describe('missingJobBidLabelIds', () => {
  it('asks for each job and bid once, in the order the day meets them', () => {
    const out = missingJobBidLabelIds([s(JOB_B, null), s(JOB_A, null), s(JOB_B, null), s(null, BID_C)], {}, {})
    expect(out).toEqual({ needJobs: [JOB_B, JOB_A], needBids: [BID_C] })
  })

  it('skips what already has a label, and sessions with no job or bid', () => {
    const out = missingJobBidLabelIds(
      [s(JOB_A, null), s(JOB_B, null), s(null, BID_C), s(null, null)],
      { [JOB_A]: 'J1 · Known - 1 Main' },
      { [BID_C]: 'B7 · Known - 2 Oak' }
    )
    expect(out).toEqual({ needJobs: [JOB_B], needBids: [] })
  })

  it('an empty label counts as no label', () => {
    expect(missingJobBidLabelIds([s(JOB_A, null)], { [JOB_A]: '' }, {}).needJobs).toEqual([JOB_A])
  })

  it('an empty day asks for nothing', () => {
    expect(missingJobBidLabelIds([], {}, {})).toEqual({ needJobs: [], needBids: [] })
  })
})

describe('the fallback labels', () => {
  it('name the kind and the first eight characters of the id', () => {
    expect(jobFallbackLabel(JOB_A)).toBe('Job aaaaaaaa…')
    expect(bidFallbackLabel(BID_C)).toBe('Bid cccccccc…')
  })
})

describe('jobLabelsForIds', () => {
  const row: MyTimeJobLabelRow = {
    id: JOB_A,
    hcp_number: '523',
    click_number: '',
    job_name: 'Mission Hills',
    job_address: '123 Main',
    service_type_id: null,
  }

  it('labels a loaded job with its ledger summary line', () => {
    const out = jobLabelsForIds([JOB_A], [row], {})
    expect(out).toEqual({
      [JOB_A]: formatJobLedgerSummaryLine({}, null, '523', 'Mission Hills', '123 Main', ''),
    })
    expect(out[JOB_A]).toContain('Mission Hills - 123 Main')
  })

  it('labels a job whose row did not come back by its id', () => {
    expect(jobLabelsForIds([JOB_A, JOB_B], [row], {})[JOB_B]).toBe('Job bbbbbbbb…')
  })

  it('answers only the ids it was asked for', () => {
    expect(Object.keys(jobLabelsForIds([JOB_B], [row], {}))).toEqual([JOB_B])
    expect(jobLabelsForIds([], [row], {})).toEqual({})
  })
})

describe('bidLabelsForIds', () => {
  const row: MyTimeBidLabelRow = {
    id: BID_C,
    bid_number: '12',
    project_name: 'Oak Ridge',
    address: '9 Oak',
    service_type_id: null,
  }

  it('labels a loaded bid with its ledger summary line, and a missing one by its id', () => {
    const out = bidLabelsForIds([BID_C, JOB_A], [row], {})
    expect(out[BID_C]).toBe(formatBidLedgerSummaryLine({}, null, '12', 'Oak Ridge', '9 Oak'))
    expect(out[BID_C]).toContain('Oak Ridge - 9 Oak')
    expect(out[JOB_A]).toBe('Bid aaaaaaaa…')
  })
})
