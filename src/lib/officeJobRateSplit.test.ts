import { describe, it, expect } from 'vitest'
import {
  bucketSessionHoursByDay,
  buildDayRateSplitsForPeriod,
  rateBucketForSession,
  shouldUseDualRate,
  splitDayHoursByRate,
  summarizeRateSplits,
  type RateSplitSessionRow,
} from './officeJobRateSplit'

const OFFICE = 'office-job-uuid'
const FIELD = 'field-job-uuid'

function session(partial: Partial<RateSplitSessionRow>): RateSplitSessionRow {
  return {
    work_date: '2026-06-01',
    job_ledger_id: null,
    bid_id: null,
    clocked_in_at: '2026-06-01T08:00:00Z',
    clocked_out_at: '2026-06-01T16:00:00Z', // 8h closed
    approved_at: '2026-06-01T17:00:00Z',
    rejected_at: null,
    revoked_at: null,
    ...partial,
  }
}

describe('shouldUseDualRate', () => {
  it('false when null/undefined config', () => {
    expect(shouldUseDualRate(undefined)).toBe(false)
    expect(shouldUseDualRate(null)).toBe(false)
  })
  it('false when no office rate set', () => {
    expect(shouldUseDualRate({ is_salary: false, office_hourly_wage: null })).toBe(false)
  })
  it('false for salaried even with an office rate', () => {
    expect(shouldUseDualRate({ is_salary: true, office_hourly_wage: 20 })).toBe(false)
  })
  it('true for hourly with an office rate (incl. 0)', () => {
    expect(shouldUseDualRate({ is_salary: false, office_hourly_wage: 20 })).toBe(true)
    expect(shouldUseDualRate({ is_salary: false, office_hourly_wage: 0 })).toBe(true)
  })
})

describe('rateBucketForSession', () => {
  it('bid (no job) => office', () => {
    expect(rateBucketForSession({ job_ledger_id: null, bid_id: 'b1' }, OFFICE)).toBe('office')
  })
  it('office job => office', () => {
    expect(rateBucketForSession({ job_ledger_id: OFFICE, bid_id: null }, OFFICE)).toBe('office')
  })
  it('unassigned (both null) => office', () => {
    expect(rateBucketForSession({ job_ledger_id: null, bid_id: null }, OFFICE)).toBe('office')
  })
  it('real field job => job', () => {
    expect(rateBucketForSession({ job_ledger_id: FIELD, bid_id: null }, OFFICE)).toBe('job')
  })
  it('field job with no configured office job => job', () => {
    expect(rateBucketForSession({ job_ledger_id: FIELD, bid_id: null }, null)).toBe('job')
  })
  it('unassigned with no configured office job => office', () => {
    expect(rateBucketForSession({ job_ledger_id: null, bid_id: null }, null)).toBe('office')
  })
})

describe('bucketSessionHoursByDay', () => {
  it('excludes rejected / revoked / unapproved / open sessions', () => {
    const sessions = [
      session({ job_ledger_id: FIELD }), // 8h job (valid)
      session({ job_ledger_id: FIELD, rejected_at: '2026-06-01T18:00:00Z' }),
      session({ job_ledger_id: FIELD, revoked_at: '2026-06-01T18:00:00Z' }),
      session({ job_ledger_id: FIELD, approved_at: null }),
      session({ job_ledger_id: FIELD, clocked_out_at: null }), // open
    ]
    const map = bucketSessionHoursByDay(sessions, OFFICE)
    expect(map.get('2026-06-01')).toEqual({ officeHours: 0, jobHours: 8 })
  })

  it('aggregates office vs job per day independently', () => {
    const sessions = [
      session({ work_date: '2026-06-01', bid_id: 'b1', clocked_out_at: '2026-06-01T12:00:00Z' }), // 4h office
      session({ work_date: '2026-06-01', job_ledger_id: FIELD, clocked_in_at: '2026-06-01T12:00:00Z', clocked_out_at: '2026-06-01T16:00:00Z' }), // 4h job
      session({ work_date: '2026-06-02', job_ledger_id: OFFICE, clocked_in_at: '2026-06-02T08:00:00Z', clocked_out_at: '2026-06-02T16:00:00Z' }), // 8h office
    ]
    const map = bucketSessionHoursByDay(sessions, OFFICE)
    expect(map.get('2026-06-01')).toEqual({ officeHours: 4, jobHours: 4 })
    expect(map.get('2026-06-02')).toEqual({ officeHours: 8, jobHours: 0 })
  })
})

describe('splitDayHoursByRate', () => {
  const wages = { officeWage: 20, jobWage: 30 }

  it('zero total => all zeros', () => {
    const r = splitDayHoursByRate({ workDate: 'd', totalHours: 0, ...wages })
    expect(r).toMatchObject({ totalHours: 0, officeHours: 0, jobHours: 0, paidAmount: 0, blendedRate: 0 })
  })

  it('no sessions => all office', () => {
    const r = splitDayHoursByRate({ workDate: 'd', totalHours: 8, ...wages })
    expect(r.officeHours).toBe(8)
    expect(r.jobHours).toBe(0)
    expect(r.paidAmount).toBe(160) // 8 * 20
    expect(r.blendedRate).toBe(20)
  })

  it('50/50 session split applied to authoritative total', () => {
    const r = splitDayHoursByRate({
      workDate: 'd',
      totalHours: 8,
      bucketHours: { officeHours: 4, jobHours: 4 },
      ...wages,
    })
    expect(r.officeHours).toBe(4)
    expect(r.jobHours).toBe(4)
    expect(r.officePaid).toBe(80) // 4*20
    expect(r.jobPaid).toBe(120) // 4*30
    expect(r.paidAmount).toBe(200)
    expect(r.blendedRate).toBe(25)
  })

  it('INVARIANT: session sum != people_hours total => fraction from sessions, total from people_hours', () => {
    // Sessions imply 6h (3 office / 3 job => 50% office) but people_hours says 8h.
    const r = splitDayHoursByRate({
      workDate: 'd',
      totalHours: 8,
      bucketHours: { officeHours: 3, jobHours: 3 },
      ...wages,
    })
    expect(r.officeHours).toBe(4) // 50% of authoritative 8
    expect(r.jobHours).toBe(4)
    expect(r.officeHours + r.jobHours).toBe(8)
  })

  it('rounding re-sums to total (1.00h, office 1s / job 2s)', () => {
    const r = splitDayHoursByRate({
      workDate: 'd',
      totalHours: 1,
      bucketHours: { officeHours: 1 / 3600, jobHours: 2 / 3600 },
      ...wages,
    })
    expect(r.officeHours + r.jobHours).toBe(1)
    expect(r.officeHours).toBeCloseTo(0.33, 2)
    expect(r.jobHours).toBeCloseTo(0.67, 2)
  })

  it('equal wages => blended equals the single rate', () => {
    const r = splitDayHoursByRate({
      workDate: 'd',
      totalHours: 8,
      bucketHours: { officeHours: 5, jobHours: 3 },
      officeWage: 30,
      jobWage: 30,
    })
    expect(r.paidAmount).toBe(240)
    expect(r.blendedRate).toBe(30)
  })

  it('office-only day => blended equals office rate; job-only => job rate', () => {
    const officeOnly = splitDayHoursByRate({
      workDate: 'd',
      totalHours: 8,
      bucketHours: { officeHours: 8, jobHours: 0 },
      ...wages,
    })
    expect(officeOnly.blendedRate).toBe(20)
    const jobOnly = splitDayHoursByRate({
      workDate: 'd',
      totalHours: 8,
      bucketHours: { officeHours: 0, jobHours: 8 },
      ...wages,
    })
    expect(jobOnly.blendedRate).toBe(30)
  })

  it('hours>0 but all sessions zero-duration => all office', () => {
    const r = splitDayHoursByRate({
      workDate: 'd',
      totalHours: 8,
      bucketHours: { officeHours: 0, jobHours: 0 },
      ...wages,
    })
    expect(r.officeHours).toBe(8)
    expect(r.jobHours).toBe(0)
  })
})

describe('buildDayRateSplitsForPeriod', () => {
  it('day in range with no hours => zero split (present, not undefined)', () => {
    const map = buildDayRateSplitsForPeriod({
      daysInRange: ['2026-06-01', '2026-06-02'],
      hoursByDate: new Map([['2026-06-01', 8]]),
      sessions: [session({ work_date: '2026-06-01', job_ledger_id: FIELD })],
      officeJobLedgerId: OFFICE,
      officeWage: 20,
      jobWage: 30,
    })
    expect(map.get('2026-06-02')).toMatchObject({ totalHours: 0, paidAmount: 0 })
  })

  it('sum of paidAmount equals a hand-computed gross', () => {
    // Day 1: 8h, half office (bid 4h) half field (4h): 4*20 + 4*30 = 200
    // Day 2: 8h, all field job: 8*30 = 240
    const sessions = [
      session({ work_date: '2026-06-01', bid_id: 'b1', clocked_out_at: '2026-06-01T12:00:00Z' }),
      session({ work_date: '2026-06-01', job_ledger_id: FIELD, clocked_in_at: '2026-06-01T12:00:00Z', clocked_out_at: '2026-06-01T16:00:00Z' }),
      session({ work_date: '2026-06-02', job_ledger_id: FIELD, clocked_out_at: '2026-06-02T16:00:00Z' }),
    ]
    const map = buildDayRateSplitsForPeriod({
      daysInRange: ['2026-06-01', '2026-06-02'],
      hoursByDate: new Map([['2026-06-01', 8], ['2026-06-02', 8]]),
      sessions,
      officeJobLedgerId: OFFICE,
      officeWage: 20,
      jobWage: 30,
    })
    const gross = [...map.values()].reduce((s, d) => s + d.paidAmount, 0)
    expect(gross).toBe(440)
  })
})

describe('summarizeRateSplits', () => {
  it('sums office/field hours and paid across days', () => {
    const map = buildDayRateSplitsForPeriod({
      daysInRange: ['2026-06-01', '2026-06-02'],
      hoursByDate: new Map([['2026-06-01', 8], ['2026-06-02', 8]]),
      sessions: [
        session({ work_date: '2026-06-01', bid_id: 'b1', clocked_out_at: '2026-06-01T12:00:00Z' }),
        session({ work_date: '2026-06-01', job_ledger_id: FIELD, clocked_in_at: '2026-06-01T12:00:00Z', clocked_out_at: '2026-06-01T16:00:00Z' }),
        session({ work_date: '2026-06-02', job_ledger_id: FIELD, clocked_out_at: '2026-06-02T16:00:00Z' }),
      ],
      officeJobLedgerId: OFFICE,
      officeWage: 20,
      jobWage: 30,
    })
    const sum = summarizeRateSplits(map.values(), 20, 30)
    expect(sum.officeHours).toBe(4)
    expect(sum.jobHours).toBe(12)
    expect(sum.officePaid).toBe(80)
    expect(sum.jobPaid).toBe(360)
  })
})
