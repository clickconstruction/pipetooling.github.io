import { describe, expect, it } from 'vitest'
import { missedClockInNotes, missedClockInProblem, missedDayOptions, missedSpan, missedSpanHours, parseTimeInput } from './missedClockIn'

// Friday, September 25, 2026 in the company's zone (Central, UTC-5 in September).
const FRI = '2026-09-25'
const NOW = Date.parse('2026-09-30T17:00:00Z')

describe('missedDayOptions', () => {
  it('lists last week through today, newest first', () => {
    const days = missedDayOptions('2026-09-20', '2026-09-30')
    expect(days).toHaveLength(11)
    expect(days[0]).toEqual({ ymd: '2026-09-30', label: expect.stringContaining('Today') })
    expect(days[10]?.ymd).toBe('2026-09-20')
    expect(days.find((d) => d.ymd === FRI)?.label).toContain('Fri')
  })
  it('is empty when the range is ahead of today', () => {
    expect(missedDayOptions('2026-10-04', '2026-09-30')).toEqual([])
  })
})

describe('parseTimeInput', () => {
  it('reads a time box', () => {
    expect(parseTimeInput('10:00')).toEqual({ h: 10, m: 0 })
    expect(parseTimeInput('7:05')).toEqual({ h: 7, m: 5 })
    expect(parseTimeInput('24:00')).toBeNull()
    expect(parseTimeInput('10:75')).toBeNull()
    expect(parseTimeInput('')).toBeNull()
  })
})

describe('missedSpan', () => {
  it('turns the day and two times into instants in the company zone', () => {
    const span = missedSpan(FRI, '10:00', '21:00')
    expect(span).toEqual({ inMs: Date.parse('2026-09-25T15:00:00Z'), outMs: Date.parse('2026-09-26T02:00:00Z'), endsNextDay: false })
    expect(span && missedSpanHours(span)).toBe(11)
  })
  it('reads a stop at or before the start as the next day', () => {
    const span = missedSpan(FRI, '22:00', '03:00')
    expect(span?.endsNextDay).toBe(true)
    expect(span && missedSpanHours(span)).toBe(5)
  })
  it('is null until both times are entered', () => {
    expect(missedSpan(FRI, '10:00', '')).toBeNull()
    expect(missedSpan(FRI, '', '21:00')).toBeNull()
  })
})

describe('missedClockInProblem', () => {
  const span = missedSpan(FRI, '10:00', '21:00')
  const ok = { span, reason: 'App would not let me clock in', nowMs: NOW, existing: [] }

  it('passes the day the worker texted about', () => {
    expect(missedClockInProblem(ok)).toBeNull()
  })
  it('asks for both times', () => {
    expect(missedClockInProblem({ ...ok, span: null })).toBe('Enter the time you started and the time you stopped.')
  })
  it('refuses more than sixteen hours', () => {
    expect(missedClockInProblem({ ...ok, span: missedSpan(FRI, '04:00', '21:00') })).toContain('more than 16 hours')
  })
  it('refuses a stop time that has not happened', () => {
    expect(missedClockInProblem({ ...ok, span: missedSpan('2026-09-30', '08:00', '18:00') })).toContain('has not happened yet')
  })
  it('refuses time the clock already has, closed or still running', () => {
    const punched = [{ startMs: Date.parse('2026-09-25T12:00:00Z'), endMs: Date.parse('2026-09-25T15:30:00Z') }]
    expect(missedClockInProblem({ ...ok, existing: punched })).toContain('already have clocked time')
    // touching is not overlapping
    expect(missedClockInProblem({ ...ok, existing: [{ startMs: Date.parse('2026-09-25T12:00:00Z'), endMs: Date.parse('2026-09-25T15:00:00Z') }] })).toBeNull()
    const open = [{ startMs: Date.parse('2026-09-26T01:00:00Z'), endMs: null }]
    expect(missedClockInProblem({ ...ok, existing: open })).toContain('already have clocked time')
  })
  it('wants to know what happened', () => {
    expect(missedClockInProblem({ ...ok, reason: '  ' })).toContain('Say what happened')
  })
  it('refuses a stop time equal to the start a day later as too long, not as zero', () => {
    expect(missedClockInProblem({ ...ok, span: missedSpan(FRI, '10:00', '10:00') })).toContain('more than 16 hours')
  })
})

describe('missedClockInNotes', () => {
  it('leads with what it is', () => {
    expect(missedClockInNotes('  App would not let me clock in ')).toBe('Clock missed it — App would not let me clock in')
  })
})
