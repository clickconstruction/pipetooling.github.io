import { describe, expect, it } from 'vitest'
import type { Database } from '../types/database'
import {
  PAID_TIME_OFF_LABEL,
  UNPAID_TIME_OFF_LABEL,
  overrideIsMeaningful,
  resolveCalendarWorkday,
  timeOffKindLabel,
} from './resolveCalendarWorkday'

type TemplateRow = Database['public']['Tables']['salary_work_schedule_templates']['Row']
type OverrideRow = Database['public']['Tables']['salary_work_schedule_day_overrides']['Row']
type TimeOffRow = Database['public']['Tables']['user_time_off']['Row']

const template = (p: Partial<TemplateRow> = {}): TemplateRow =>
  ({
    mode: 'continuous',
    segment_a_start_local: '08:00:00',
    segment_a_duration_minutes: 480,
    segment_b_start_local: null,
    segment_b_duration_minutes: null,
    timezone: 'America/Chicago',
    exclude_weekends: true,
    ...p,
  }) as unknown as TemplateRow

const override = (p: Partial<OverrideRow> = {}): OverrideRow =>
  ({
    mode: null,
    segment_a_start_local: null,
    segment_a_duration_minutes: null,
    segment_b_start_local: null,
    segment_b_duration_minutes: null,
    timezone: null,
    ...p,
  }) as unknown as OverrideRow

const timeOff = (start: string, end: string, kind: string, note: string | null = null): TimeOffRow =>
  ({ start_date: start, end_date: end, kind, note }) as unknown as TimeOffRow

const THU = '2026-09-10' // a September weekday → CDT
const SAT = '2026-09-12'
const JAN_MON = '2026-01-12' // → CST

describe('timeOffKindLabel / overrideIsMeaningful', () => {
  it('labels paid vs everything else', () => {
    expect(timeOffKindLabel('paid')).toBe(PAID_TIME_OFF_LABEL)
    expect(timeOffKindLabel('unpaid')).toBe(UNPAID_TIME_OFF_LABEL)
    expect(timeOffKindLabel('')).toBe(UNPAID_TIME_OFF_LABEL)
  })
  it('an override counts only when it sets a mode or a start time', () => {
    expect(overrideIsMeaningful(null)).toBe(false)
    expect(overrideIsMeaningful(override())).toBe(false)
    expect(overrideIsMeaningful(override({ mode: 'continuous' }))).toBe(true)
    expect(overrideIsMeaningful(override({ segment_a_start_local: '06:00:00' }))).toBe(true)
  })
})

describe('resolveCalendarWorkday', () => {
  it('time off wins over everything, inclusive of both end dates', () => {
    const rows = [timeOff('2026-09-09', '2026-09-10', 'paid', 'dentist')]
    expect(resolveCalendarWorkday({ workDateYmd: THU, timeOffRows: rows, template: template(), overrideForDate: override({ mode: 'split' }) })).toEqual({
      kind: 'time_off',
      kindLabel: PAID_TIME_OFF_LABEL,
      note: 'dentist',
    })
    expect(resolveCalendarWorkday({ workDateYmd: '2026-09-11', timeOffRows: rows, template: template(), overrideForDate: null }).kind).toBe('scheduled')
  })

  it('a continuous template gives one block with the wall-clock range and zone', () => {
    const r = resolveCalendarWorkday({ workDateYmd: THU, timeOffRows: [], template: template(), overrideForDate: null })
    expect(r).toEqual({ kind: 'scheduled', source: 'template', blocks: [{ label: '8:00 AM–4:00 PM CDT' }] })
  })

  it('shows CST for a winter date and falls back to the company zone when the template has none', () => {
    const r = resolveCalendarWorkday({ workDateYmd: JAN_MON, timeOffRows: [], template: template({ timezone: '' }), overrideForDate: null })
    expect(r).toEqual({ kind: 'scheduled', source: 'template', blocks: [{ label: '8:00 AM–4:00 PM CST' }] })
  })

  it('a split template gives two numbered blocks; a split with no segment B collapses to one', () => {
    const split = template({ mode: 'split', segment_a_duration_minutes: 240, segment_b_start_local: '13:30:00', segment_b_duration_minutes: 240 })
    expect(resolveCalendarWorkday({ workDateYmd: THU, timeOffRows: [], template: split, overrideForDate: null })).toEqual({
      kind: 'scheduled',
      source: 'template',
      blocks: [
        { label: '8:00 AM–12:00 PM CDT', segmentIndex: 1 },
        { label: '1:30 PM–5:30 PM CDT', segmentIndex: 2 },
      ],
    })
    const halfSplit = template({ mode: 'split', segment_a_duration_minutes: 240 })
    expect(resolveCalendarWorkday({ workDateYmd: THU, timeOffRows: [], template: halfSplit, overrideForDate: null })).toEqual({
      kind: 'scheduled',
      source: 'template',
      blocks: [{ label: '8:00 AM–12:00 PM CDT' }],
    })
  })

  it('weekends are off when the template excludes them, unless an override says otherwise', () => {
    expect(resolveCalendarWorkday({ workDateYmd: SAT, timeOffRows: [], template: template(), overrideForDate: null })).toEqual({ kind: 'none' })
    expect(resolveCalendarWorkday({ workDateYmd: SAT, timeOffRows: [], template: template({ exclude_weekends: false }), overrideForDate: null }).kind).toBe('scheduled')
    const r = resolveCalendarWorkday({ workDateYmd: SAT, timeOffRows: [], template: template(), overrideForDate: override({ segment_a_start_local: '06:00:00', segment_a_duration_minutes: 240 }) })
    expect(r).toEqual({ kind: 'scheduled', source: 'override', blocks: [{ label: '6:00 AM–10:00 AM CDT' }] })
  })

  it('an override fills in only what it sets; the template supplies the rest', () => {
    const r = resolveCalendarWorkday({
      workDateYmd: THU,
      timeOffRows: [],
      template: template({ timezone: 'America/Chicago' }),
      overrideForDate: override({ mode: 'continuous', segment_a_start_local: '10:00:00', timezone: 'America/New_York' }),
    })
    // start from the override, duration (480) from the template, zone from the override
    expect(r).toEqual({ kind: 'scheduled', source: 'override', blocks: [{ label: '10:00 AM–6:00 PM EDT' }] })
  })

  it('an override with no template still schedules using the built-in 8 h default', () => {
    const r = resolveCalendarWorkday({ workDateYmd: THU, timeOffRows: [], template: null, overrideForDate: override({ mode: 'continuous' }) })
    expect(r).toEqual({ kind: 'scheduled', source: 'override', blocks: [{ label: '8:00 AM–4:00 PM CDT' }] })
  })

  it('a range crossing midnight wraps the end label instead of overflowing', () => {
    const r = resolveCalendarWorkday({ workDateYmd: THU, timeOffRows: [], template: template({ segment_a_start_local: '22:00:00', segment_a_duration_minutes: 240 }), overrideForDate: null })
    expect(r.kind === 'scheduled' && r.blocks[0]?.label).toBe('10:00 PM–2:00 AM CDT')
  })

  it('nothing scheduled at all reads as none', () => {
    expect(resolveCalendarWorkday({ workDateYmd: THU, timeOffRows: [], template: null, overrideForDate: null })).toEqual({ kind: 'none' })
    expect(resolveCalendarWorkday({ workDateYmd: THU, timeOffRows: [], template: null, overrideForDate: override() })).toEqual({ kind: 'none' })
  })
})
