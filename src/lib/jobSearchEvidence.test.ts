import { describe, expect, it } from 'vitest'
import { bidSearchStatusChip, jobSearchEvidenceModeForRole, mergeJobSearchEvidence } from './jobSearchEvidence'
import type { DupJobEnrichment } from './duplicateJobAddressGroups'

describe('jobSearchEvidenceModeForRole', () => {
  it('gives office roles money mode', () => {
    for (const r of ['dev', 'master_technician', 'assistant', 'controller', 'primary']) {
      expect(jobSearchEvidenceModeForRole(r)).toBe('money')
    }
  })

  it('gives field and estimating roles lines-only (and unknown/null defaults there too)', () => {
    for (const r of ['subcontractor', 'helpers', 'superintendent', 'estimator', '', null, undefined, 'nonsense']) {
      expect(jobSearchEvidenceModeForRole(r)).toBe('lines-only')
    }
  })
})

describe('mergeJobSearchEvidence', () => {
  const enrichment: DupJobEnrichment = {
    lineCount: 2,
    lineRevenue: 4850,
    lineSummary: 'Water heater, Expansion tank',
    paidTotal: 4850,
    lastPaidDaysAgo: 12,
  }

  it('attaches status and per-job block counts to enrichments', () => {
    const out = mergeJobSearchEvidence(
      ['j1'],
      new Map([['j1', enrichment]]),
      [{ id: 'j1', status: 'ready_to_bill' }],
      [{ job_id: 'j1' }, { job_id: 'j1' }],
    )
    expect(out.get('j1')).toEqual({ ...enrichment, status: 'ready_to_bill', blocksThisWeek: 2, revenue: null, lastBillDate: null, collectionsAt: null })
  })

  it('creates an entry for a lineless job that has status or blocks', () => {
    const out = mergeJobSearchEvidence(['j2'], new Map(), [{ id: 'j2', status: 'working' }], [])
    expect(out.get('j2')).toEqual({
      lineCount: 0,
      lineRevenue: 0,
      lineSummary: '',
      paidTotal: 0,
      lastPaidDaysAgo: null,
      status: 'working',
      blocksThisWeek: 0,
      revenue: null,
      lastBillDate: null,
      collectionsAt: null,
    })
  })

  it('carries the ledger extras the money rail reads (v2.3183): revenue, last bill date, collections flag', () => {
    const out = mergeJobSearchEvidence(
      ['j5'],
      new Map(),
      [{ id: 'j5', status: 'billed', revenue: 4200, last_bill_date: '2026-07-23', collections_at: '2026-09-01T00:00:00Z' }],
      [],
    )
    expect(out.get('j5')).toMatchObject({ status: 'billed', revenue: 4200, lastBillDate: '2026-07-23', collectionsAt: '2026-09-01T00:00:00Z' })
  })

  it('skips ids with no signal at all and normalizes blank status to null', () => {
    const out = mergeJobSearchEvidence(
      ['j3', 'j4'],
      new Map(),
      [{ id: 'j4', status: '  ' }],
      [{ job_id: 'j4' }],
    )
    expect(out.has('j3')).toBe(false)
    expect(out.get('j4')).toMatchObject({ status: null, blocksThisWeek: 1 })
  })
})

describe('bidSearchStatusChip', () => {
  it('maps outcomes: won, started, lost, sent-pending, unsent', () => {
    expect(bidSearchStatusChip('won', null).label).toBe('Won')
    expect(bidSearchStatusChip('started_or_complete', null).label).toBe('Started')
    expect(bidSearchStatusChip('lost', '2026-03-01').label).toBe('Lost')
    expect(bidSearchStatusChip(null, '2026-03-01').label).toBe('Pending')
    expect(bidSearchStatusChip(null, null).label).toBe('Unsent')
    expect(bidSearchStatusChip('', '  ').label).toBe('Unsent')
  })
})
