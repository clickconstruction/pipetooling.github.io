import { describe, expect, it } from 'vitest'
import {
  buildJobClockSummaries,
  buildQuickfillCompleteNoBillList,
  jobHasNoTotalBill,
  quickfillCompleteNoBillCandidates,
} from './quickfillCompleteNoBill'

function job(partial: Partial<Parameters<typeof buildQuickfillCompleteNoBillList>[0][number]> = {}) {
  return {
    id: 'j1',
    status: 'working',
    revenue: null,
    hcp_number: '900',
    pct_complete: null,
    invoices: [],
    ...partial,
  }
}

describe('jobHasNoTotalBill', () => {
  it('is true for null and zero, false for a positive amount', () => {
    expect(jobHasNoTotalBill(null)).toBe(true)
    expect(jobHasNoTotalBill(0)).toBe(true)
    expect(jobHasNoTotalBill(1500)).toBe(false)
  })
})

describe('quickfillCompleteNoBillCandidates', () => {
  it('keeps non-paid jobs with no Total Bill at or above the HCP threshold', () => {
    const jobs = [
      job({ id: 'a', status: 'working' }),
      job({ id: 'b', status: 'billed' }),
      job({ id: 'c', status: 'paid' }),
      job({ id: 'd', revenue: 2500 }),
      job({ id: 'e', hcp_number: '100' }),
    ]
    expect(quickfillCompleteNoBillCandidates(jobs, 406).map((j) => j.id)).toEqual(['a', 'b'])
  })
  it('keeps jobs with a non-numeric HCP # (Click-number-only jobs)', () => {
    expect(quickfillCompleteNoBillCandidates([job({ hcp_number: '' })], 406)).toHaveLength(1)
    expect(quickfillCompleteNoBillCandidates([job({ hcp_number: null })], 406)).toHaveLength(1)
  })
})

describe('buildQuickfillCompleteNoBillList', () => {
  it('keeps jobs whose latest report says 100%', () => {
    const list = buildQuickfillCompleteNoBillList(
      [job({ id: 'a' }), job({ id: 'b' })],
      new Map([
        ['a', 100],
        ['b', 80],
      ]),
      406,
    )
    expect(list.map((j) => j.id)).toEqual(['a'])
  })
  it('falls back to pct_complete=100 when no report percent exists', () => {
    const list = buildQuickfillCompleteNoBillList(
      [job({ id: 'a', pct_complete: 100 }), job({ id: 'b', pct_complete: 60 })],
      new Map(),
      406,
    )
    expect(list.map((j) => j.id)).toEqual(['a'])
  })
  it('report percent beats a pct_complete of 100 (same rule as the % column)', () => {
    const list = buildQuickfillCompleteNoBillList(
      [job({ id: 'a', pct_complete: 100 })],
      new Map([['a', 60]]),
      406,
    )
    expect(list).toEqual([])
  })
  it('all-paid invoices with amount force 100% even without report or field', () => {
    const list = buildQuickfillCompleteNoBillList(
      [job({ id: 'a', invoices: [{ status: 'paid', amount: 200 }] })],
      new Map(),
      406,
    )
    expect(list.map((j) => j.id)).toEqual(['a'])
  })
  it('excludes jobs with no completion signal at all', () => {
    expect(buildQuickfillCompleteNoBillList([job()], new Map(), 406)).toEqual([])
  })
})

describe('buildJobClockSummaries', () => {
  it('rolls sessions into first-clock-in, count, closed-hours, and distinct work dates', () => {
    const map = buildJobClockSummaries([
      {
        job_ledger_id: 'a',
        clocked_in_at: '2026-06-03T14:00:00Z',
        clocked_out_at: '2026-06-03T18:00:00Z',
        work_date: '2026-06-03',
      },
      {
        job_ledger_id: 'a',
        clocked_in_at: '2026-06-01T13:00:00Z',
        clocked_out_at: '2026-06-01T15:30:00Z',
        work_date: '2026-06-01',
      },
      {
        job_ledger_id: 'a',
        clocked_in_at: '2026-06-03T19:00:00Z',
        clocked_out_at: '2026-06-03T20:00:00Z',
        work_date: '2026-06-03',
      },
    ])
    const a = map.get('a')
    expect(a?.firstClockInAt).toBe('2026-06-01T13:00:00Z')
    expect(a?.sessionCount).toBe(3)
    expect(a?.totalHours).toBeCloseTo(7.5, 5)
    expect(a?.workDates).toEqual(['2026-06-01', '2026-06-03'])
    expect(a?.hasOpenSession).toBe(false)
  })
  it('marks open sessions without counting their hours, and falls back to the clock-in date', () => {
    const map = buildJobClockSummaries([
      {
        job_ledger_id: 'b',
        clocked_in_at: '2026-06-05T14:00:00Z',
        clocked_out_at: null,
        work_date: null,
      },
    ])
    const b = map.get('b')
    expect(b?.hasOpenSession).toBe(true)
    expect(b?.totalHours).toBe(0)
    expect(b?.sessionCount).toBe(1)
    expect(b?.workDates).toEqual(['2026-06-05'])
  })
  it('groups by job and skips rows without a job id', () => {
    const map = buildJobClockSummaries([
      { job_ledger_id: 'a', clocked_in_at: '2026-06-01T13:00:00Z', clocked_out_at: '2026-06-01T14:00:00Z', work_date: '2026-06-01' },
      { job_ledger_id: 'c', clocked_in_at: '2026-06-02T13:00:00Z', clocked_out_at: '2026-06-02T14:00:00Z', work_date: '2026-06-02' },
      { job_ledger_id: null, clocked_in_at: '2026-06-02T13:00:00Z', clocked_out_at: null, work_date: null },
    ])
    expect([...map.keys()].sort()).toEqual(['a', 'c'])
  })
})
