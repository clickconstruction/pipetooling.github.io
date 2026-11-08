import { describe, expect, it } from 'vitest'
import {
  buildJobClockSummaries,
  buildQuickfillCompleteNoBillList,
  completeBillGaps,
  completeBillListed,
  completeNoBillRows,
  jobHasNoTotalBill,
  jobHasOtherCharges,
  jobHasSpecificWork,
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
    // A filled-in bill by default (v2.6750): the old cases are about the Total Bill alone.
    fixtures: [{ name: 'Water heater', count: 1 }],
    materials: [{ amount: 120 }],
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

describe('buildJobClockSummaries · a clock-in with no work date keeps its Central day (v2.4472)', () => {
  it('reads an evening clock-in as its own day', () => {
    // 00:30 UTC on Jun 4 is 7:30 pm CDT on Jun 3; 00:30 UTC on Dec 2 is 6:30 pm CST on Dec 1.
    const map = buildJobClockSummaries([
      { job_ledger_id: 'a', clocked_in_at: '2026-06-04T00:30:00Z', clocked_out_at: '2026-06-04T02:00:00Z', work_date: null },
      { job_ledger_id: 'a', clocked_in_at: '2026-12-02T00:30:00+00:00', clocked_out_at: null, work_date: null },
      { job_ledger_id: 'a', clocked_in_at: '2026-06-05T12:00:00Z', clocked_out_at: '2026-06-05T14:00:00Z', work_date: null },
    ])
    expect(map.get('a')?.workDates).toEqual(['2026-06-03', '2026-06-05', '2026-12-01'])
  })
})

describe('the three checks (v2.6750, punch list #176, decision 4: Jobs Billing folded into Complete, no Total Bill)', () => {
  it('reads a Specific Work line as a named fixture with a count, and an Other job charge as a material with an amount', () => {
    expect(jobHasSpecificWork([{ name: 'Water heater', count: 1 }])).toBe(true)
    expect(jobHasSpecificWork([{ name: ' ', count: 1 }, { name: 'Lav', count: 0 }, { name: 'Lav', count: '0' }])).toBe(false)
    expect(jobHasSpecificWork([{ name: 'Lav', count: '2' }])).toBe(true)
    expect(jobHasSpecificWork(undefined)).toBe(false)
    expect(jobHasOtherCharges([{ amount: 0 }, { amount: null }])).toBe(false)
    expect(jobHasOtherCharges([{ amount: '45.50' }])).toBe(true)
    expect(jobHasOtherCharges([{ amount: -20 }])).toBe(true)
    expect(jobHasOtherCharges(undefined)).toBe(false)
  })

  it('lists the gaps worst first, and judges the Total Bill alone while the bill lines are unknown', () => {
    expect(completeBillGaps({ revenue: null, fixtures: [], materials: [] })).toEqual(['total', 'work', 'charges'])
    expect(completeBillGaps({ revenue: 2500, fixtures: [], materials: [{ amount: 10 }] })).toEqual(['work'])
    expect(completeBillGaps({ revenue: 2500, fixtures: [{ name: 'Lav', count: 1 }], materials: [] })).toEqual(['charges'])
    expect(completeBillGaps({ revenue: 2500, fixtures: [{ name: 'Lav', count: 1 }], materials: [{ amount: 10 }] })).toEqual([])
    // The jobs cache has not laid fixtures and materials over the rows yet: an empty line is not a gap.
    expect(completeBillGaps({ revenue: null, fixtures: [], materials: [] }, false)).toEqual(['total'])
    expect(completeBillGaps({ revenue: 2500, fixtures: [], materials: [] }, false)).toEqual([])
  })

  it('no Total Bill or no Specific Work lists a finished job; no Other job charges alone is a note, not a row', () => {
    expect(completeBillListed(['total'])).toBe(true)
    expect(completeBillListed(['work', 'charges'])).toBe(true)
    expect(completeBillListed(['charges'])).toBe(false)
    expect(completeBillListed([])).toBe(false)
    const jobs = [
      job({ id: 'lines-missing', revenue: 2500, fixtures: [], materials: [], pct_complete: 100 }),
      job({ id: 'filled', revenue: 2500, pct_complete: 100 }),
      // A pre-test or a service visit: the work and the total are there, nothing else to charge (40 such on 2026-11-08).
      job({ id: 'no-charges', revenue: 450, materials: [], pct_complete: 100 }),
      job({ id: 'not-done', revenue: 2500, fixtures: [], pct_complete: 40 }),
      job({ id: 'paid', status: 'paid', revenue: null, fixtures: [], materials: [] }),
    ]
    expect(quickfillCompleteNoBillCandidates(jobs, 406).map((j) => j.id)).toEqual(['lines-missing', 'not-done'])
    expect(quickfillCompleteNoBillCandidates(jobs, 406, false)).toEqual([])
    expect(completeNoBillRows(jobs, new Map(), 406)).toEqual([{ job: jobs[0], gaps: ['work', 'charges'] }])
  })

  it('orders the rows no Total Bill first, then the lowest number as the row shows it (the Click number when there is no HCP number)', () => {
    const jobs = [
      job({ id: 'c', hcp_number: '1200', revenue: 900, materials: [], pct_complete: 100 }),
      job({ id: 'b', hcp_number: '1100', revenue: null, pct_complete: 100 }),
      job({ id: 'a', hcp_number: '995', revenue: 900, fixtures: [], pct_complete: 100 }),
      job({ id: 'd', hcp_number: '1010', revenue: 0, fixtures: [], materials: [], pct_complete: 100 }),
      job({ id: 'e', hcp_number: null, click_number: '1003', revenue: 900, fixtures: [], pct_complete: 100 }),
    ]
    const rows = completeNoBillRows(jobs, new Map(), 406)
    expect(rows.map((r) => `${r.job.id}:${r.gaps.join('+')}`)).toEqual(['d:total+work+charges', 'b:total', 'a:work', 'e:work'])
    expect(buildQuickfillCompleteNoBillList(jobs, new Map(), 406).map((j) => j.id)).toEqual(['d', 'b', 'a', 'e'])
  })
})
