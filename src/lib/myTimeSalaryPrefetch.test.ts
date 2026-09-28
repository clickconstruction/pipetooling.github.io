import { describe, expect, it } from 'vitest'
import {
  emptyDayLine,
  salaryPrefetchKey,
  salaryPrefetchOutcome,
  shouldPrefetchSalaryDay,
  type SalaryPrefetchGateInput,
} from './myTimeSalaryPrefetch'

/** A self-fetched day that came back empty, inside the editable window. */
const base: SalaryPrefetchGateInput = {
  enabled: true,
  sessionsControlledByParent: false,
  sessionsLoading: false,
  fetchedCount: 0,
  inSaveableRange: true,
  hasSubjectUser: true,
}

describe('shouldPrefetchSalaryDay', () => {
  it('asks the schedule when the editor’s own fetch came back empty', () => {
    expect(shouldPrefetchSalaryDay(base)).toBe(true)
  })

  it.each([
    ['the mount did not ask for it', { enabled: false }],
    ['the parent owns the sessions', { sessionsControlledByParent: true }],
    ['the day is still loading', { sessionsLoading: true }],
    ['the fetch has not answered yet', { fetchedCount: null }],
    ['the day has sessions', { fetchedCount: 2 }],
    ['the day is outside the editable window', { inSaveableRange: false }],
    ['there is no person', { hasSubjectUser: false }],
  ] as const)('does not when %s', (_label, over) => {
    expect(shouldPrefetchSalaryDay({ ...base, ...over })).toBe(false)
  })
})

describe('salaryPrefetchKey', () => {
  it('is one key per person and day', () => {
    expect(salaryPrefetchKey('u1', '2026-01-05')).toBe('u1|2026-01-05')
    expect(salaryPrefetchKey('u1', '2026-01-05')).not.toBe(salaryPrefetchKey('u1', '2026-01-06'))
    expect(salaryPrefetchKey('u1', '2026-01-05')).not.toBe(salaryPrefetchKey('u2', '2026-01-05'))
  })
})

describe('salaryPrefetchOutcome', () => {
  it('time off explains the empty day, in the time off’s own words', () => {
    expect(salaryPrefetchOutcome({ kind: 'time_off', kindLabel: 'Paid time off', note: null })).toEqual({
      action: 'hint',
      hint: 'time_off',
      timeOffLabel: 'Paid time off',
    })
  })

  it('a day with no shift explains the empty day', () => {
    expect(salaryPrefetchOutcome({ kind: 'none' })).toEqual({ action: 'hint', hint: 'no_work' })
  })

  it('a scheduled day has its sessions made', () => {
    expect(
      salaryPrefetchOutcome({ kind: 'scheduled', source: 'template', blocks: [{ label: '8:00 AM – 5:00 PM CST' }] })
    ).toEqual({ action: 'sync' })
  })
})

describe('emptyDayLine', () => {
  it('says why the day is empty when the schedule knows', () => {
    expect(emptyDayLine('time_off', 'Unpaid time off')).toBe('No sessions this day — Unpaid time off.')
    expect(emptyDayLine('no_work', 'Unpaid time off')).toBe(
      'No scheduled work this day (e.g. weekend or no shift blocks).'
    )
  })

  it('says only that it is empty otherwise', () => {
    expect(emptyDayLine(null, 'Unpaid time off')).toBe('No sessions this day.')
  })
})
