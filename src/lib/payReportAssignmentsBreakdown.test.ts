import { describe, expect, it } from 'vitest'
import { computePayReportAssignmentsBreakdown } from './payReportAssignmentsBreakdown'

/** The pay report's per-day job / bid lines — payroll money, pinned (v2.3874, the People map's Stage A). */
const jobs = { j1: { hcp_number: '4021', job_name: 'Kitchen rough-in', job_address: '12 Oak St' }, j2: { hcp_number: '', job_name: '', job_address: '9 Elm' } }
const bids = { b1: { bid_number: 'B482', project_name: 'Galloway Park', address: '' }, b2: { bid_number: '', project_name: '', address: '' } }

describe('computePayReportAssignmentsBreakdown', () => {
  it('splits a day’s hours across its job and bid assignments by percent, two decimals, in one line', () => {
    const out = computePayReportAssignmentsBreakdown(
      'Ana',
      [{ work_date: '2026-09-21', hours: 8 }],
      { '2026-09-21:Ana': { job_assignments: [{ job_id: 'j1', pct: 75 }] } },
      { '2026-09-21:Ana': { bid_assignments: [{ bid_id: 'b1', pct: 25 }] } },
      jobs,
      bids,
    )
    expect(out).toEqual([{ date: '2026-09-21', hours: 8, jobsText: 'Job 4021 (Kitchen rough-in) 6.00 hrs, Bid B482 (Galloway Park) 2.00 hrs' }])
  })

  it('labels fall back: number or name, then the address, then the id’s first eight characters', () => {
    const out = computePayReportAssignmentsBreakdown(
      'Ana',
      [{ work_date: '2026-09-22', hours: 4 }],
      { '2026-09-22:Ana': { job_assignments: [{ job_id: 'j2', pct: 50 }, { job_id: 'unknown-job-id', pct: 50 }] } },
      { '2026-09-22:Ana': { bid_assignments: [{ bid_id: 'b2', pct: 100 }] } },
      jobs,
      bids,
    )
    expect(out[0]?.jobsText).toBe('9 Elm 2.00 hrs, unknown- 2.00 hrs, b2 4.00 hrs')
  })

  it('a day with no assignments reads a dash; another person’s assignments never count', () => {
    const out = computePayReportAssignmentsBreakdown(
      'Ana',
      [{ work_date: '2026-09-23', hours: 8 }, { work_date: '2026-09-24', hours: 0 }],
      { '2026-09-23:Bob': { job_assignments: [{ job_id: 'j1', pct: 100 }] } },
      {},
      jobs,
      bids,
    )
    expect(out).toEqual([
      { date: '2026-09-23', hours: 8, jobsText: '—' },
      { date: '2026-09-24', hours: 0, jobsText: '—' },
    ])
  })
})
