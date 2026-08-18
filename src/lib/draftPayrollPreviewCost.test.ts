import { describe, expect, it } from 'vitest'
import {
  draftPayrollPreviewDayCost,
  draftPayrollRowCashDue,
} from './draftPayrollPreviewCost'
import type { DayBucketHours } from './officeJobRateSplit'

const DUAL_CFG = { hourly_wage: 50, office_hourly_wage: 35, is_salary: false }

function buckets(entries: Record<string, DayBucketHours>): Map<string, DayBucketHours> {
  return new Map(Object.entries(entries))
}

describe('draftPayrollPreviewDayCost', () => {
  it('prices single-rate people at flat wage × hours', () => {
    const cost = draftPayrollPreviewDayCost({
      cfg: { hourly_wage: 40, office_hourly_wage: null, is_salary: false },
      hours: 8,
      workDate: '2026-08-11',
      bucketsByDate: buckets({}),
    })
    expect(cost).toBe(320)
  })

  it('prices an all-office day at the office rate (Bryan repro: 6h × $35 = $210, not 6h × $50)', () => {
    const cost = draftPayrollPreviewDayCost({
      cfg: DUAL_CFG,
      hours: 6,
      workDate: '2026-08-11',
      bucketsByDate: buckets({ '2026-08-11': { officeHours: 6, jobHours: 0 } }),
    })
    expect(cost).toBe(210)
  })

  it('splits a mixed day by the session fraction and prices each bucket', () => {
    // 8 authoritative hours, sessions say half office half field: 4×35 + 4×50 = 340.
    const cost = draftPayrollPreviewDayCost({
      cfg: DUAL_CFG,
      hours: 8,
      workDate: '2026-08-12',
      bucketsByDate: buckets({ '2026-08-12': { officeHours: 2, jobHours: 2 } }),
    })
    expect(cost).toBe(340)
  })

  it('prices a day with no attributable sessions as all office (unassigned => office)', () => {
    const cost = draftPayrollPreviewDayCost({
      cfg: DUAL_CFG,
      hours: 5,
      workDate: '2026-08-13',
      bucketsByDate: buckets({}),
    })
    expect(cost).toBe(175)
  })

  it('falls back to flat field wage when bucketsByDate is undefined (no unique login user)', () => {
    const cost = draftPayrollPreviewDayCost({
      cfg: DUAL_CFG,
      hours: 6,
      workDate: '2026-08-11',
      bucketsByDate: undefined,
    })
    expect(cost).toBe(300)
  })

  it('ignores the office rate for salaried people (dual rate is hourly-only)', () => {
    const cost = draftPayrollPreviewDayCost({
      cfg: { hourly_wage: 50, office_hourly_wage: 35, is_salary: true },
      hours: 8,
      workDate: '2026-08-11',
      bucketsByDate: buckets({ '2026-08-11': { officeHours: 8, jobHours: 0 } }),
    })
    expect(cost).toBe(400)
  })

  it('returns 0 for missing config or zero hours', () => {
    expect(
      draftPayrollPreviewDayCost({ cfg: undefined, hours: 8, workDate: '2026-08-11', bucketsByDate: undefined }),
    ).toBe(0)
    expect(
      draftPayrollPreviewDayCost({ cfg: DUAL_CFG, hours: 0, workDate: '2026-08-11', bucketsByDate: buckets({}) }),
    ).toBe(0)
  })
})

describe('draftPayrollRowCashDue', () => {
  it('prefers the generated report gross when a stub exists', () => {
    expect(draftPayrollRowCashDue(450.1, 642.7)).toBe(450.1)
  })

  it('keeps a legitimate $0 stub gross (does not fall through to the estimate)', () => {
    expect(draftPayrollRowCashDue(0, 642.7)).toBe(0)
  })

  it('uses the estimate when no stub exists', () => {
    expect(draftPayrollRowCashDue(null, 642.7)).toBe(642.7)
    expect(draftPayrollRowCashDue(undefined, 642.7)).toBe(642.7)
  })
})
