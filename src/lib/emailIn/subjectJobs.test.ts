import { describe, expect, it } from 'vitest'
import { buildLedgerPrefixMap } from '../ledgerDisplayPrefixes'
import { jobKey } from '../messages/load'
import { jobInSubject } from './jobInSubject'
import { subjectJobs, subjectNumbers } from './subjectJobs'

const prefixes = buildLedgerPrefixMap([{ id: 'st-plumb', ledger_job_prefix: 'JP', ledger_bid_prefix: 'BP' }])

describe('subjectNumbers', () => {
  it("reads each token that may be a job's number, once", () => {
    expect(subjectNumbers('Re: BP523 rev 1, #42 and JP1077 (C88), BP523 again')).toEqual(['523', '42', '1077', '88'])
    expect(subjectNumbers('Lot 7, 3 units')).toEqual([])
    expect(subjectNumbers('Invoice 2026-114')).toEqual(['2026', '114'])
  })
})

describe('subjectJobs', () => {
  const rows = {
    bids: [
      { id: 'b1', bid_number: '523', project_name: 'Boerne Retail Shell', service_type_id: 'st-plumb' },
      { id: 'b2', bid_number: '524', project_name: 'Other', service_type_id: null },
    ],
    projects: [{ id: 'p1', project_number: '42', name: 'Stone Oak Pharmacy' }],
    pipeline: [
      { id: 'j1', hcp_number: '1077', click_number: 'C88', job_name: 'Fair Oaks Shops, Building D', service_type_id: 'st-plumb' },
      { id: 'j2', hcp_number: null, click_number: '90', job_name: 'No HCP', service_type_id: null },
    ],
    prefixes,
  }

  it('labels each job as the app shows its number, and marks the sender\'s own', () => {
    expect(subjectJobs(rows, new Set(['bid:b1', 'pipeline:j1']))).toEqual([
      { key: 'bid:b1', labels: ['BP523'], name: 'Boerne Retail Shell', mine: true },
      { key: 'bid:b2', labels: ['B524'], name: 'Other', mine: false },
      { key: 'project:p1', labels: ['#42'], name: 'Stone Oak Pharmacy', mine: false },
      { key: 'pipeline:j1', labels: ['JP1077', 'C88'], name: 'Fair Oaks Shops, Building D', mine: true },
      { key: 'pipeline:j2', labels: [], name: 'No HCP', mine: false },
    ])
  })

  it("keys jobs as messages/load's jobKey does, and feeds jobInSubject", () => {
    const jobs = subjectJobs(rows, new Set())
    expect(jobs.map((j) => j.key)).toEqual([
      jobKey({ kind: 'bid', id: 'b1' }),
      jobKey({ kind: 'bid', id: 'b2' }),
      jobKey({ kind: 'project', id: 'p1' }),
      jobKey({ kind: 'pipeline', id: 'j1' }),
      jobKey({ kind: 'pipeline', id: 'j2' }),
    ])
    expect(jobInSubject('Hillside sitework BP523', jobs)).toBe('bid:b1')
    expect(jobInSubject('Pay app, C88', jobs)).toBe('pipeline:j1')
  })

  it('lists a job read twice once', () => {
    expect(subjectJobs({ ...rows, bids: [rows.bids[0]!, rows.bids[0]!], projects: [], pipeline: [] }, new Set())).toHaveLength(1)
  })
})
