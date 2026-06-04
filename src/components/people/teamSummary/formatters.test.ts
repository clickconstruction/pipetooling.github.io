import { describe, expect, it } from 'vitest'
import { enrichTeamSummaryRowsForInline } from './formatters'
import type { TeamSummaryRow } from './types'

// Minimal valid TeamSummaryRow factory — the breakdowns are empty shells
// because these tests only exercise the derived overhead fields. The 2nd
// arg to enrichTeamSummaryRowsForInline is the parts rate ($/field hr).
function makeRow(overrides: Partial<TeamSummaryRow>): TeamSummaryRow {
  return {
    personName: 'Test Person',
    profit: 0,
    gross: 0,
    revPerHour: 0,
    profitPerHour: 0,
    totalHours: 0,
    overheadHours: 0,
    officeHours: 0,
    bidHours: 0,
    fieldHours: 0,
    hourlyWage: 0,
    overheadLaborCost: 0,
    hoursBreakdown: {
      source: 'hourly',
      onlyPaidJobs: false,
      dailyRows: [],
      subLaborRows: [],
      totals: { daily: 0, crew: 0, subLabor: 0, totalHours: 0 },
    },
    grossBreakdown: { jobs: [], total: 0 },
    netBreakdown: { jobs: [], total: 0 },
    profitBreakdown: {
      jobs: [],
      totalNet: 0,
      totalHours: 0,
      fieldHours: 0,
      overheadHours: 0,
      unaccountedHours: 0,
    },
    overheadSessions: [],
    ...overrides,
  }
}

describe('enrichTeamSummaryRowsForInline — split overhead model', () => {
  it('overheadBurden = −(field hours × parts rate), stored negative as a cost', () => {
    const rows = [makeRow({ fieldHours: 30, totalHours: 40 })]
    const out = enrichTeamSummaryRowsForInline(rows, 2, () => 'hourly')[0]!
    expect(out.overheadBurden).toBe(-60) // −(30 field hrs × $2 parts rate)
  })

  it('burden uses FIELD hours, not total hours', () => {
    // totalHours 40 = 30 field + 10 overhead. The parts burden charges only
    // the 30 field hours, so −60 — NOT −80 (40 × 2).
    const rows = [makeRow({ fieldHours: 30, overheadHours: 10, totalHours: 40 })]
    const out = enrichTeamSummaryRowsForInline(rows, 2, () => 'hourly')[0]!
    expect(out.overheadBurden).toBe(-60)
    expect(out.overheadBurden).not.toBe(-80)
  })

  it('profit = net − own overhead labor − overhead burden', () => {
    // net 1000, own overhead labor −80 (stored negative), parts burden −60.
    const rows = [makeRow({ profit: 1000, overheadLaborCost: -80, fieldHours: 30, totalHours: 40 })]
    const out = enrichTeamSummaryRowsForInline(rows, 2, () => 'hourly')[0]!
    expect(out.overheadBurden).toBe(-60)
    expect(out.profitAfterOverhead).toBe(860) // 1000 − 80 − 60
  })

  it('office/bid-heavy person (no field hours) is charged only their own overhead labor', () => {
    // 0 field hrs → no parts burden; profit = net − own overhead labor.
    const rows = [makeRow({ profit: 0, overheadLaborCost: -47, fieldHours: 0, overheadHours: 4, totalHours: 4 })]
    const out = enrichTeamSummaryRowsForInline(rows, 2, () => 'hourly')[0]!
    expect(out.overheadBurden).toBeCloseTo(0) // 0 field hrs × rate
    expect(out.profitAfterOverhead).toBe(-47) // 0 − 47 − 0
  })

  it('is null when the parts rate is not loaded', () => {
    const rows = [makeRow({ fieldHours: 30, totalHours: 40 })]
    const out = enrichTeamSummaryRowsForInline(rows, null, () => 'hourly')[0]!
    expect(out.overheadBurden).toBeNull()
    expect(out.profitAfterOverhead).toBeNull()
  })
})
