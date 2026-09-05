import { describe, expect, it } from 'vitest'
import {
  MIDNIGHT_CAPPED_CHIP,
  SALARY_FLAT_HOURS_CHIP,
  cellApprovalChips,
  isMidnightCappedClockOut,
  isSalaryFlatHoursPerson,
  sessionApprovalChips,
} from './approvalsSessionChips'

// 2026-09-01 23:59:59.999 America/Chicago (CDT, UTC-5) = 2026-09-02T04:59:59.999Z — what the EOD cron writes (ms precision).
const CAPPED_OUT = '2026-09-02T04:59:59.999Z'
// 2026-09-01 16:30 Central — an ordinary clock-out.
const NORMAL_OUT = '2026-09-01T21:30:00Z'

describe('isSalaryFlatHoursPerson', () => {
  it('flags either salaried flavour, never hourly', () => {
    expect(isSalaryFlatHoursPerson({ is_salary: true, record_hours_but_salary: true })).toBe(true)
    expect(isSalaryFlatHoursPerson({ is_salary: true, record_hours_but_salary: false })).toBe(true)
    expect(isSalaryFlatHoursPerson({ is_salary: false })).toBe(false)
    expect(isSalaryFlatHoursPerson(undefined)).toBe(false)
    expect(isSalaryFlatHoursPerson(null)).toBe(false)
  })
})

describe('isMidnightCappedClockOut', () => {
  it('recognises the EOD auto-cap on the company wall clock', () => {
    expect(isMidnightCappedClockOut(CAPPED_OUT)).toBe(true)
    // Same instant in winter (CST, UTC-6): 2026-01-15 23:59:59.999 Central
    expect(isMidnightCappedClockOut('2026-01-16T05:59:59.999Z')).toBe(true)
  })

  it('leaves ordinary clock-outs, open sessions and garbage alone', () => {
    expect(isMidnightCappedClockOut(NORMAL_OUT)).toBe(false)
    // 23:59 UTC is 6:59 PM Central — not a cap
    expect(isMidnightCappedClockOut('2026-09-01T23:59:00Z')).toBe(false)
    expect(isMidnightCappedClockOut(null)).toBe(false)
    expect(isMidnightCappedClockOut(undefined)).toBe(false)
    expect(isMidnightCappedClockOut('not a date')).toBe(false)
  })
})

describe('sessionApprovalChips / cellApprovalChips', () => {
  it('names salary first, then midnight; nothing for an hourly ordinary session', () => {
    expect(sessionApprovalChips({ payConfig: { is_salary: true, record_hours_but_salary: true }, clockedOutAt: CAPPED_OUT }).map((c) => c.label)).toEqual([
      SALARY_FLAT_HOURS_CHIP,
      MIDNIGHT_CAPPED_CHIP,
    ])
    expect(sessionApprovalChips({ payConfig: { is_salary: false }, clockedOutAt: CAPPED_OUT }).map((c) => c.label)).toEqual([MIDNIGHT_CAPPED_CHIP])
    expect(sessionApprovalChips({ payConfig: undefined, clockedOutAt: NORMAL_OUT })).toEqual([])
  })

  it('a cell wears the midnight chip once when any of its sessions was capped', () => {
    const chips = cellApprovalChips({
      payConfig: { is_salary: false },
      sessions: [{ clocked_out_at: NORMAL_OUT }, { clocked_out_at: CAPPED_OUT }, { clocked_out_at: null }],
    })
    expect(chips.map((c) => c.label)).toEqual([MIDNIGHT_CAPPED_CHIP])
    expect(cellApprovalChips({ payConfig: { is_salary: false }, sessions: [{ clocked_out_at: NORMAL_OUT }] })).toEqual([])
  })

  it('every chip carries a title that explains itself', () => {
    for (const c of sessionApprovalChips({ payConfig: { is_salary: true }, clockedOutAt: CAPPED_OUT })) {
      expect(c.title.length).toBeGreaterThan(20)
    }
  })
})
