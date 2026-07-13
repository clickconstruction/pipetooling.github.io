import { describe, expect, it } from 'vitest'
import type { Database } from '../types/database'
import { getSalaryScheduleWindowsUtc, getSalarySyntheticClockInIso } from './salaryOnShift'

type TemplateRow = Database['public']['Tables']['salary_work_schedule_templates']['Row']
type OverrideRow = Database['public']['Tables']['salary_work_schedule_day_overrides']['Row']
type TimeOffRow = Database['public']['Tables']['user_time_off']['Row']

const TZ = 'America/Chicago'
const MONDAY = '2026-07-06' // CDT (UTC-5)

function template(partial: Partial<TemplateRow>): TemplateRow {
  return {
    mode: 'continuous',
    segment_a_start_local: '08:00:00',
    segment_a_duration_minutes: 480,
    segment_b_start_local: null,
    segment_b_duration_minutes: null,
    timezone: TZ,
    exclude_weekends: true,
    ...partial,
  } as TemplateRow
}

function override(partial: Partial<OverrideRow>): OverrideRow {
  return { mode: null, segment_a_start_local: null, ...partial } as OverrideRow
}

const utc = (iso: string) => new Date(iso).getTime()

describe('getSalaryScheduleWindowsUtc', () => {
  it('continuous mode yields one 8-hour window at the local start (CDT = UTC-5)', () => {
    const w = getSalaryScheduleWindowsUtc(MONDAY, template({}), null)
    expect(w).toEqual([{ start: utc('2026-07-06T13:00:00Z'), end: utc('2026-07-06T21:00:00Z') }])
  })

  it('a meaningful day override replaces the template start', () => {
    const w = getSalaryScheduleWindowsUtc(
      MONDAY,
      template({}),
      override({ segment_a_start_local: '10:00:00' }),
    )
    expect(w?.[0]?.start).toBe(utc('2026-07-06T15:00:00Z'))
  })

  it('split mode yields two windows; degenerate B start (same as A) is remapped to A end', () => {
    const w = getSalaryScheduleWindowsUtc(
      MONDAY,
      template({
        mode: 'split',
        segment_a_duration_minutes: 240,
        segment_b_start_local: '08:00:00',
        segment_b_duration_minutes: 240,
      }),
      null,
    )
    expect(w).toEqual([
      { start: utc('2026-07-06T13:00:00Z'), end: utc('2026-07-06T17:00:00Z') },
      { start: utc('2026-07-06T17:00:00Z'), end: utc('2026-07-06T21:00:00Z') },
    ])
  })
})

describe('getSalarySyntheticClockInIso', () => {
  const tmpl = template({})

  it('returns the block start while inside the scheduled window', () => {
    const iso = getSalarySyntheticClockInIso({
      workDateYmd: MONDAY,
      nowMs: utc('2026-07-06T15:00:00Z'),
      timeOffRows: [],
      template: tmpl,
      overrideForDate: null,
    })
    expect(iso).toBe('2026-07-06T13:00:00.000Z')
  })

  it('returns null outside the window', () => {
    const iso = getSalarySyntheticClockInIso({
      workDateYmd: MONDAY,
      nowMs: utc('2026-07-06T22:00:00Z'),
      timeOffRows: [],
      template: tmpl,
      overrideForDate: null,
    })
    expect(iso).toBeNull()
  })

  it('returns null on a time-off day even inside the window', () => {
    const off = { start_date: MONDAY, end_date: MONDAY, note: null } as TimeOffRow
    const iso = getSalarySyntheticClockInIso({
      workDateYmd: MONDAY,
      nowMs: utc('2026-07-06T15:00:00Z'),
      timeOffRows: [off],
      template: tmpl,
      overrideForDate: null,
    })
    expect(iso).toBeNull()
  })

  it('returns null on excluded weekends without an override', () => {
    const iso = getSalarySyntheticClockInIso({
      workDateYmd: '2026-07-04', // Saturday
      nowMs: utc('2026-07-04T15:00:00Z'),
      timeOffRows: [],
      template: tmpl,
      overrideForDate: null,
    })
    expect(iso).toBeNull()
  })
})
