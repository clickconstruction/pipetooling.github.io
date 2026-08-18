import { describe, expect, it } from 'vitest'
import {
  FIELD_PCT_STEPS,
  applyFieldPctStep,
  fieldPctDeltaLabel,
  fieldPctStartValue,
  isScheduleBlockEnded,
} from './fieldPctUpdate'

describe('applyFieldPctStep', () => {
  it('steps by each chip value', () => {
    expect(applyFieldPctStep(45, 20)).toBe(65)
    expect(applyFieldPctStep(45, -5)).toBe(40)
    expect(applyFieldPctStep(45, 1)).toBe(46)
  })

  it('clamps at both bounds', () => {
    expect(applyFieldPctStep(95, 20)).toBe(100)
    expect(applyFieldPctStep(100, 1)).toBe(100)
    expect(applyFieldPctStep(10, -20)).toBe(0)
    expect(applyFieldPctStep(0, -1)).toBe(0)
  })

  it('exposes the six chips in render order', () => {
    expect([...FIELD_PCT_STEPS]).toEqual([-20, -5, -1, 1, 5, 20])
  })
})

describe('fieldPctStartValue', () => {
  it('uses the recorded pct when present', () => {
    expect(fieldPctStartValue(45, 'working')).toBe(45)
    expect(fieldPctStartValue(45, 'paid')).toBe(45)
  })

  it('synthesizes the card display for null: 0, or 100 when paid', () => {
    expect(fieldPctStartValue(null, 'working')).toBe(0)
    expect(fieldPctStartValue(null, 'paid')).toBe(100)
  })
})

describe('fieldPctDeltaLabel', () => {
  it('labels gains, drops, and no change', () => {
    expect(fieldPctDeltaLabel(45, 65)).toEqual({ label: '▲ 20', tone: 'up' })
    expect(fieldPctDeltaLabel(45, 40)).toEqual({ label: '▼ 5', tone: 'down' })
    expect(fieldPctDeltaLabel(45, 45)).toEqual({ label: 'no change', tone: 'none' })
  })
})

describe('isScheduleBlockEnded', () => {
  it('is false before the end time on the block day', () => {
    expect(isScheduleBlockEnded('2026-08-18', '16:00', '2026-08-18', '12:30')).toBe(false)
  })

  it('flips true once the end time passes (inclusive)', () => {
    expect(isScheduleBlockEnded('2026-08-18', '16:00', '2026-08-18', '16:00')).toBe(true)
    expect(isScheduleBlockEnded('2026-08-18', '16:00', '2026-08-18', '17:05')).toBe(true)
  })

  it('handles HH:MM:SS column values', () => {
    expect(isScheduleBlockEnded('2026-08-18', '16:00:00', '2026-08-18', '16:30')).toBe(true)
  })

  it('past days are ended, future days are not', () => {
    expect(isScheduleBlockEnded('2026-08-17', '16:00', '2026-08-18', '08:00')).toBe(true)
    expect(isScheduleBlockEnded('2026-08-19', '16:00', '2026-08-18', '08:00')).toBe(false)
  })

  it('missing day or end time never reads as ended', () => {
    expect(isScheduleBlockEnded(null, '16:00', '2026-08-18', '17:00')).toBe(false)
    expect(isScheduleBlockEnded('2026-08-18', null, '2026-08-18', '17:00')).toBe(false)
    expect(isScheduleBlockEnded('2026-08-18', '', '2026-08-18', '17:00')).toBe(false)
  })
})
