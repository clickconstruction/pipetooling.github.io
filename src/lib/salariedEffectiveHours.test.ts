import { describe, expect, it } from 'vitest'
import {
  canEditRecordedHours,
  effectiveHoursForCost,
  effectiveHoursForDisplay,
  salariedFlatDayHours,
} from './salariedEffectiveHours'

const HOURLY = { is_salary: false, record_hours_but_salary: false }
const SALARIED = { is_salary: true, record_hours_but_salary: false }
const SALARIED_RECORDING = { is_salary: true, record_hours_but_salary: true }

describe('salariedFlatDayHours', () => {
  it('credits 8 hours Monday through Friday', () => {
    // 2026-07-06 is a Monday
    expect(salariedFlatDayHours('2026-07-06')).toBe(8)
    expect(salariedFlatDayHours('2026-07-07')).toBe(8)
    expect(salariedFlatDayHours('2026-07-08')).toBe(8)
    expect(salariedFlatDayHours('2026-07-09')).toBe(8)
    expect(salariedFlatDayHours('2026-07-10')).toBe(8)
  })

  it('credits 0 hours on weekends', () => {
    expect(salariedFlatDayHours('2026-07-04')).toBe(0) // Saturday
    expect(salariedFlatDayHours('2026-07-05')).toBe(0) // Sunday
  })

  it('is stable across DST transition dates (noon anchor)', () => {
    expect(salariedFlatDayHours('2026-03-08')).toBe(0) // Sunday, US spring-forward
    expect(salariedFlatDayHours('2026-03-09')).toBe(8) // Monday after
    expect(salariedFlatDayHours('2026-11-01')).toBe(0) // Sunday, US fall-back
    expect(salariedFlatDayHours('2026-11-02')).toBe(8) // Monday after
  })
})

describe('effectiveHoursForCost', () => {
  it('hourly people cost their recorded hours', () => {
    expect(effectiveHoursForCost(HOURLY, '2026-07-06', 6.5)).toBe(6.5)
    expect(effectiveHoursForCost(undefined, '2026-07-06', 6.5)).toBe(6.5)
  })

  it('salaried people cost flat 8/0 regardless of recorded hours', () => {
    expect(effectiveHoursForCost(SALARIED, '2026-07-06', 3)).toBe(8)
    expect(effectiveHoursForCost(SALARIED, '2026-07-04', 3)).toBe(0)
  })

  it('record_hours_but_salary does NOT change costing — still flat 8/0', () => {
    expect(effectiveHoursForCost(SALARIED_RECORDING, '2026-07-06', 3)).toBe(8)
    expect(effectiveHoursForCost(SALARIED_RECORDING, '2026-07-04', 11)).toBe(0)
  })
})

describe('effectiveHoursForDisplay', () => {
  it('hourly people display their recorded hours', () => {
    expect(effectiveHoursForDisplay(HOURLY, '2026-07-06', 6.5)).toBe(6.5)
    expect(effectiveHoursForDisplay(undefined, '2026-07-06', 0)).toBe(0)
  })

  it('plain salaried people display flat 8/0', () => {
    expect(effectiveHoursForDisplay(SALARIED, '2026-07-06', 3)).toBe(8)
    expect(effectiveHoursForDisplay(SALARIED, '2026-07-05', 3)).toBe(0)
  })

  it('record_hours_but_salary people display their recorded hours, including weekends and zero', () => {
    expect(effectiveHoursForDisplay(SALARIED_RECORDING, '2026-07-06', 3)).toBe(3)
    expect(effectiveHoursForDisplay(SALARIED_RECORDING, '2026-07-04', 11)).toBe(11)
    expect(effectiveHoursForDisplay(SALARIED_RECORDING, '2026-07-06', 0)).toBe(0)
  })
})

describe('canEditRecordedHours', () => {
  it('hourly people (and missing config) can edit', () => {
    expect(canEditRecordedHours(HOURLY)).toBe(true)
    expect(canEditRecordedHours(undefined)).toBe(true)
  })

  it('plain salaried people cannot edit', () => {
    expect(canEditRecordedHours(SALARIED)).toBe(false)
  })

  it('salaried people with record_hours_but_salary can edit', () => {
    expect(canEditRecordedHours(SALARIED_RECORDING)).toBe(true)
  })
})
