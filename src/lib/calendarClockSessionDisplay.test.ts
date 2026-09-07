import { describe, expect, it } from 'vitest'
import {
  CALENDAR_SESSION_CHIP_CAP,
  calendarRawToClockSessionRow,
  calendarSessionChipLabel,
  calendarSessionChipTooltip,
  calendarSessionDurationSeconds,
  formatCalendarSessionDurationCompact,
  formatSessionRangeCentral,
  groupActiveClockSessionsByWorkDate,
  isCalendarClockSessionActive,
  type CalendarClockSessionRaw,
} from './calendarClockSessionDisplay'
import type { ClockSessionRow } from '../types/clockSessions'
import { buildLedgerPrefixMap } from './ledgerDisplayPrefixes'

const raw = (over: Partial<CalendarClockSessionRaw> = {}): CalendarClockSessionRaw => ({
  id: 's1',
  user_id: 'u1',
  work_date: '2026-09-07',
  clocked_in_at: '2026-09-07T13:00:00+00:00', // 8:00 AM Central (CDT)
  clocked_out_at: '2026-09-07T17:05:00+00:00', // 12:05 PM Central
  notes: null,
  job_ledger_id: null,
  bid_id: null,
  origin: null,
  rejected_at: null,
  revoked_at: null,
  jobs_ledger: null,
  bids: null,
  ...over,
})
const row = (over: Partial<CalendarClockSessionRaw> = {}): ClockSessionRow => calendarRawToClockSessionRow(raw(over))

const job = { hcp_number: '1234', click_number: null, job_name: 'Mission Hills', job_address: '123 Main St', service_type_id: 'plumb' }
const bid = { bid_number: '77', project_name: 'Oak Ridge Phase 2', address: null, service_type_id: 'plumb', customers: { name: 'Acme Builders' } }
const prefixMap = buildLedgerPrefixMap([{ id: 'plumb', ledger_job_prefix: 'JP', ledger_bid_prefix: 'BP' }])
const defaultMap = buildLedgerPrefixMap([])

// Newer ICU puts a narrow no-break space before AM/PM; the app shows whichever the browser gives.
const plain = (s: string) => s.replace(/ /g, ' ')

describe('calendarRawToClockSessionRow', () => {
  it('lifts the calendar select row to the full session shape, blanking what the calendar does not fetch', () => {
    const r = calendarRawToClockSessionRow(raw({ notes: null, origin: null, job_ledger_id: 'j1', jobs_ledger: job, rejected_at: '2026-09-08T00:00:00Z' }))
    expect(r).toMatchObject({
      id: 's1',
      user_id: 'u1',
      work_date: '2026-09-07',
      clocked_in_at: '2026-09-07T13:00:00+00:00',
      clocked_out_at: '2026-09-07T17:05:00+00:00',
      notes: '', // null notes become an empty string
      origin: undefined, // null origin becomes undefined (user_punch by absence)
      job_ledger_id: 'j1',
      bid_id: null,
      jobs_ledger: job,
      bids: null,
      rejected_at: '2026-09-08T00:00:00Z',
      revoked_at: null,
    })
    // Everything the calendar select leaves out is null, never fabricated.
    for (const k of ['salary_segment_index', 'clock_in_lat', 'clock_out_lng', 'approved_at', 'approved_by', 'rejected_by', 'revoked_by', 'users', 'approved_by_user'] as const) {
      expect(r[k], k).toBeNull()
    }
    expect(calendarRawToClockSessionRow(raw({ notes: 'left early', origin: 'salary_schedule' })).notes).toBe('left early')
    expect(calendarRawToClockSessionRow(raw({ origin: 'salary_schedule' })).origin).toBe('salary_schedule')
  })
})

describe('isCalendarClockSessionActive + groupActiveClockSessionsByWorkDate', () => {
  it('a session is active unless it was rejected or revoked', () => {
    expect(isCalendarClockSessionActive({ rejected_at: null, revoked_at: null })).toBe(true)
    expect(isCalendarClockSessionActive({ rejected_at: '2026-09-08T00:00:00Z', revoked_at: null })).toBe(false)
    expect(isCalendarClockSessionActive({ rejected_at: null, revoked_at: '2026-09-08T00:00:00Z' })).toBe(false)
  })
  it('groups active sessions by work date, earliest clock-in first, and drops the rejected and revoked', () => {
    const grouped = groupActiveClockSessionsByWorkDate([
      row({ id: 'late', clocked_in_at: '2026-09-07T18:00:00Z', clocked_out_at: null }),
      row({ id: 'gone', rejected_at: '2026-09-08T00:00:00Z' }),
      row({ id: 'early', clocked_in_at: '2026-09-07T12:00:00Z' }),
      row({ id: 'next-day', work_date: '2026-09-08', clocked_in_at: '2026-09-08T12:00:00Z' }),
      row({ id: 'pulled', revoked_at: '2026-09-08T00:00:00Z' }),
    ])
    expect(Object.keys(grouped).sort()).toEqual(['2026-09-07', '2026-09-08'])
    expect(grouped['2026-09-07']!.map((s) => s.id)).toEqual(['early', 'late'])
    expect(grouped['2026-09-08']!.map((s) => s.id)).toEqual(['next-day'])
    expect(groupActiveClockSessionsByWorkDate([])).toEqual({})
  })
})

describe('formatSessionRangeCentral', () => {
  it('renders the range in Central time, and an open session as "– open"', () => {
    expect(plain(formatSessionRangeCentral('2026-09-07T13:00:00+00:00', '2026-09-07T17:05:00+00:00'))).toBe('8:00 AM – 12:05 PM')
    expect(plain(formatSessionRangeCentral('2026-09-07T13:00:00+00:00', null))).toBe('8:00 AM – open')
    expect(plain(formatSessionRangeCentral('2026-01-15T15:05:00Z', '2026-01-16T00:30:00Z'))).toBe('9:05 AM – 6:30 PM') // CST in January, crossing UTC midnight
  })
})

describe('session duration', () => {
  const closed = { clocked_in_at: '2026-09-07T13:00:00Z', clocked_out_at: '2026-09-07T15:05:30Z' }
  const open = { clocked_in_at: '2026-09-07T13:00:00Z', clocked_out_at: null }
  const now = Date.parse('2026-09-07T13:45:00Z')
  it('counts whole seconds to the clock-out, or to now for an open session, never below zero', () => {
    expect(calendarSessionDurationSeconds(closed, now)).toBe(2 * 3600 + 5 * 60 + 30)
    expect(calendarSessionDurationSeconds(open, now)).toBe(45 * 60)
    expect(calendarSessionDurationSeconds(open, Date.parse('2026-09-07T12:00:00Z'))).toBe(0) // clock skew: now before clock-in
    expect(calendarSessionDurationSeconds({ clocked_in_at: '2026-09-07T13:00:00Z', clocked_out_at: '2026-09-07T13:00:00.900Z' }, now)).toBe(0)
  })
  it('formats compactly: hours and minutes, minutes only, under a minute, or nothing', () => {
    expect(formatCalendarSessionDurationCompact(closed, now)).toBe('2h 5m')
    expect(formatCalendarSessionDurationCompact(open, now)).toBe('45m')
    expect(formatCalendarSessionDurationCompact({ clocked_in_at: '2026-09-07T13:00:00Z', clocked_out_at: '2026-09-07T14:00:00Z' }, now)).toBe('1h 0m')
    expect(formatCalendarSessionDurationCompact({ clocked_in_at: '2026-09-07T13:00:00Z', clocked_out_at: '2026-09-07T13:00:20Z' }, now)).toBe('<1m')
    expect(formatCalendarSessionDurationCompact({ clocked_in_at: '2026-09-07T13:00:00Z', clocked_out_at: '2026-09-07T13:00:00Z' }, now)).toBe('0m')
  })
})

describe('calendar chips', () => {
  it('shows at most three chips per day cell before the overflow count', () => {
    expect(CALENDAR_SESSION_CHIP_CAP).toBe(3)
  })
  it('labels a chip with the short job or bid line, else Scheduled for a salary block, else No job', () => {
    expect(calendarSessionChipLabel(row({ jobs_ledger: job }), prefixMap)).toBe('JP1234 · Mission Hills')
    expect(calendarSessionChipLabel(row({ jobs_ledger: job }), defaultMap)).toBe('J1234 · Mission Hills')
    expect(calendarSessionChipLabel(row({ jobs_ledger: { ...job, hcp_number: null, click_number: 'C9' } }), defaultMap)).toBe('JC9 · Mission Hills')
    expect(calendarSessionChipLabel(row({ jobs_ledger: { ...job, job_name: '  ' } }), defaultMap)).toBe('J1234 · —')
    expect(calendarSessionChipLabel(row({ bids: bid }), prefixMap)).toBe('BP77 · Oak Ridge Phase 2')
    expect(calendarSessionChipLabel(row({ jobs_ledger: job, bids: bid }), defaultMap)).toBe('J1234 · Mission Hills') // job wins over bid
    expect(calendarSessionChipLabel(row({ origin: 'salary_schedule' }), defaultMap)).toBe('Scheduled')
    expect(calendarSessionChipLabel(row({ origin: 'user_punch' }), defaultMap)).toBe('No job')
    expect(calendarSessionChipLabel(row(), defaultMap)).toBe('No job')
  })
  it('the tooltip carries the full job or bid line and the notes, with long notes cut at 120', () => {
    expect(calendarSessionChipTooltip(row({ jobs_ledger: job, notes: 'left early' }), prefixMap)).toBe('JP1234 · Mission Hills - 123 Main St · left early')
    expect(calendarSessionChipTooltip(row({ jobs_ledger: job }), defaultMap)).toBe('J1234 · Mission Hills - 123 Main St')
    expect(calendarSessionChipTooltip(row({ bids: bid }), defaultMap)).toBe('B77 · Oak Ridge Phase 2 - Acme Builders') // customer name stands in for a missing bid address
    expect(calendarSessionChipTooltip(row({ bids: { ...bid, address: '9 Elm' } }), defaultMap)).toBe('B77 · Oak Ridge Phase 2 - 9 Elm')
    expect(calendarSessionChipTooltip(row({ origin: 'salary_schedule', notes: '  ' }), defaultMap)).toBe('Scheduled (salary)')
    expect(calendarSessionChipTooltip(row({ notes: 'just a note' }), defaultMap)).toBe('just a note')
    expect(calendarSessionChipTooltip(row(), defaultMap)).toBe('Clock session')
    const long = 'x'.repeat(121)
    expect(calendarSessionChipTooltip(row({ notes: long }), defaultMap)).toBe(`${'x'.repeat(117)}…`)
    expect(calendarSessionChipTooltip(row({ notes: 'y'.repeat(120) }), defaultMap)).toBe('y'.repeat(120))
  })
})
