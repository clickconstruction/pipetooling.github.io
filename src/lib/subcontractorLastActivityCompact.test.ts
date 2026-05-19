import { describe, expect, it } from 'vitest'
import {
  compactTimeAgo,
  longTimeAgoPhrase,
  subcontractorLastActivityMobileLine,
  subcontractorLastActivitySourceLine,
} from './subcontractorLastActivityCompact'

const NOW = new Date('2026-05-19T12:00:00.000Z')

function isoMinutesAgo(min: number): string {
  return new Date(NOW.getTime() - min * 60_000).toISOString()
}

function isoHoursAgo(h: number): string {
  return new Date(NOW.getTime() - h * 3_600_000).toISOString()
}

function isoDaysAgo(d: number): string {
  return new Date(NOW.getTime() - d * 86_400_000).toISOString()
}

describe('compactTimeAgo', () => {
  it('returns em-dash for null / blank / invalid ISO', () => {
    expect(compactTimeAgo(null, NOW)).toBe('—')
    expect(compactTimeAgo(undefined, NOW)).toBe('—')
    expect(compactTimeAgo('', NOW)).toBe('—')
    expect(compactTimeAgo('   ', NOW)).toBe('—')
    expect(compactTimeAgo('not-a-date', NOW)).toBe('—')
  })

  it('collapses <1m and future instants to "just now"', () => {
    expect(compactTimeAgo(NOW.toISOString(), NOW)).toBe('just now')
    expect(compactTimeAgo(isoMinutesAgo(0.5), NOW)).toBe('just now')
    expect(compactTimeAgo(new Date(NOW.getTime() + 60_000).toISOString(), NOW)).toBe('just now')
  })

  it('formats minutes as "Nm ago"', () => {
    expect(compactTimeAgo(isoMinutesAgo(1), NOW)).toBe('1m ago')
    expect(compactTimeAgo(isoMinutesAgo(5), NOW)).toBe('5m ago')
    expect(compactTimeAgo(isoMinutesAgo(59), NOW)).toBe('59m ago')
  })

  it('formats hours as "Nh ago"', () => {
    expect(compactTimeAgo(isoHoursAgo(1), NOW)).toBe('1h ago')
    expect(compactTimeAgo(isoHoursAgo(23), NOW)).toBe('23h ago')
  })

  it('formats days as "Nd ago" (1-6 days)', () => {
    expect(compactTimeAgo(isoDaysAgo(1), NOW)).toBe('1d ago')
    expect(compactTimeAgo(isoDaysAgo(6), NOW)).toBe('6d ago')
  })

  it('formats weeks as "Nw ago" (7-27 days)', () => {
    expect(compactTimeAgo(isoDaysAgo(7), NOW)).toBe('1w ago')
    expect(compactTimeAgo(isoDaysAgo(21), NOW)).toBe('3w ago')
    expect(compactTimeAgo(isoDaysAgo(27), NOW)).toBe('3w ago')
  })

  it('formats months as "Nmo ago" (28 days through ~12 months)', () => {
    // 30-day month boundary kicks in at ~30d (2592000000 ms / 30d)
    expect(compactTimeAgo(isoDaysAgo(30), NOW)).toBe('1mo ago')
    expect(compactTimeAgo(isoDaysAgo(120), NOW)).toBe('4mo ago')
  })

  it('formats years as "Ny ago" (>=12 30-day months)', () => {
    expect(compactTimeAgo(isoDaysAgo(365), NOW)).toBe('1y ago')
    expect(compactTimeAgo(isoDaysAgo(365 * 3), NOW)).toBe('3y ago')
  })
})

describe('longTimeAgoPhrase', () => {
  it('returns "No activity yet" for blank / invalid', () => {
    expect(longTimeAgoPhrase(null, NOW)).toBe('No activity yet')
    expect(longTimeAgoPhrase('', NOW)).toBe('No activity yet')
    expect(longTimeAgoPhrase('garbage', NOW)).toBe('No activity yet')
  })

  it('returns "Just now" within the first minute', () => {
    expect(longTimeAgoPhrase(NOW.toISOString(), NOW)).toBe('Just now')
    expect(longTimeAgoPhrase(isoMinutesAgo(0.5), NOW)).toBe('Just now')
  })

  it('pluralizes correctly', () => {
    expect(longTimeAgoPhrase(isoMinutesAgo(1), NOW)).toBe('1 minute ago')
    expect(longTimeAgoPhrase(isoMinutesAgo(5), NOW)).toBe('5 minutes ago')
    expect(longTimeAgoPhrase(isoHoursAgo(1), NOW)).toBe('1 hour ago')
    expect(longTimeAgoPhrase(isoHoursAgo(23), NOW)).toBe('23 hours ago')
    expect(longTimeAgoPhrase(isoDaysAgo(1), NOW)).toBe('1 day ago')
    expect(longTimeAgoPhrase(isoDaysAgo(2), NOW)).toBe('2 days ago')
  })
})

describe('subcontractorLastActivitySourceLine', () => {
  it('returns null when there is no activity', () => {
    expect(
      subcontractorLastActivitySourceLine({
        last_job_activity_at: null,
      }),
    ).toBeNull()
    expect(
      subcontractorLastActivitySourceLine({
        last_job_activity_at: '   ',
      }),
    ).toBeNull()
  })

  it('returns single label when one source matches', () => {
    const ts = isoHoursAgo(23)
    expect(
      subcontractorLastActivitySourceLine({
        last_job_activity_at: ts,
        last_report_at: ts,
      }),
    ).toBe('Field report')
    expect(
      subcontractorLastActivitySourceLine({
        last_job_activity_at: ts,
        last_thread_note_at: ts,
      }),
    ).toBe('Thread note')
    expect(
      subcontractorLastActivitySourceLine({
        last_job_activity_at: ts,
        last_clock_activity_at: ts,
      }),
    ).toBe('Clock session')
    expect(
      subcontractorLastActivitySourceLine({
        last_job_activity_at: ts,
        last_schedule_activity_at: ts,
      }),
    ).toBe('Schedule')
  })

  it('comma-joins ties in fixed source order (thread_note, field_report, clock, schedule)', () => {
    const ts = isoHoursAgo(2)
    expect(
      subcontractorLastActivitySourceLine({
        last_job_activity_at: ts,
        // Provided out of order on purpose - output order is fixed.
        last_schedule_activity_at: ts,
        last_clock_activity_at: ts,
        last_report_at: ts,
        last_thread_note_at: ts,
      }),
    ).toBe('Thread note, Field report, Clock session, Schedule')
  })

  it('returns null when no source aligns with the activity instant', () => {
    expect(
      subcontractorLastActivitySourceLine({
        last_job_activity_at: isoHoursAgo(2),
        last_report_at: isoHoursAgo(3),
        last_thread_note_at: isoHoursAgo(5),
      }),
    ).toBeNull()
  })
})

describe('subcontractorLastActivityMobileLine', () => {
  const TITLE_STUB = (iso: string) => `FIXED(${iso})`

  it('happy path: "Last Activity <rel>: <source>"', () => {
    const ts = isoHoursAgo(23)
    const result = subcontractorLastActivityMobileLine(
      {
        last_job_activity_at: ts,
        last_report_at: ts,
      },
      { now: NOW, formatTitle: TITLE_STUB },
    )
    expect(result.text).toBe('Last Activity 23h ago: Field report')
    expect(result.clickable).toBe(true)
    expect(result.title).toBe(`Latest activity: FIXED(${ts})`)
    expect(result.aria).toBe('Last activity: 23 hours ago, Field report')
  })

  it('just-now: "Last Activity just now: <source>" (no "ago")', () => {
    const ts = NOW.toISOString()
    const result = subcontractorLastActivityMobileLine(
      {
        last_job_activity_at: ts,
        last_thread_note_at: ts,
      },
      { now: NOW, formatTitle: TITLE_STUB },
    )
    expect(result.text).toBe('Last Activity just now: Thread note')
    expect(result.clickable).toBe(true)
    expect(result.aria).toBe('Last activity: Just now, Thread note')
  })

  it('ms-tie: comma-joins source labels into the single line', () => {
    const ts = isoHoursAgo(2)
    const result = subcontractorLastActivityMobileLine(
      {
        last_job_activity_at: ts,
        last_thread_note_at: ts,
        last_report_at: ts,
      },
      { now: NOW, formatTitle: TITLE_STUB },
    )
    expect(result.text).toBe('Last Activity 2h ago: Thread note, Field report')
    expect(result.aria).toBe('Last activity: 2 hours ago, Thread note, Field report')
  })

  it('activity ms with no aligned source: drops trailing colon, still clickable', () => {
    const result = subcontractorLastActivityMobileLine(
      {
        last_job_activity_at: isoHoursAgo(5),
        last_report_at: isoHoursAgo(6),
      },
      { now: NOW, formatTitle: TITLE_STUB },
    )
    expect(result.text).toBe('Last Activity 5h ago')
    expect(result.clickable).toBe(true)
    expect(result.aria).toBe('Last activity: 5 hours ago')
  })

  it('no activity: "Last Activity: No activity yet", not clickable, long explainer title', () => {
    const result = subcontractorLastActivityMobileLine(
      { last_job_activity_at: null },
      { now: NOW, formatTitle: TITLE_STUB },
    )
    expect(result.text).toBe('Last Activity: No activity yet')
    expect(result.clickable).toBe(false)
    expect(result.title).toBe(
      'No thread notes, field reports, work sessions, or schedule activity on this job yet',
    )
    expect(result.aria).toBe('Last activity: No activity yet')
  })

  it('invalid ISO is treated as no activity', () => {
    const result = subcontractorLastActivityMobileLine(
      { last_job_activity_at: 'not-a-date' },
      { now: NOW, formatTitle: TITLE_STUB },
    )
    expect(result.clickable).toBe(false)
    expect(result.text).toBe('Last Activity: No activity yet')
  })

  it('defaults formatTitle to passthrough so the lib has no locale dependency', () => {
    const ts = isoHoursAgo(1)
    const result = subcontractorLastActivityMobileLine(
      { last_job_activity_at: ts, last_thread_note_at: ts },
      { now: NOW },
    )
    expect(result.title).toBe(`Latest activity: ${ts}`)
  })
})
