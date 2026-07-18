import { describe, expect, it } from 'vitest'
import {
  formatTimeSince,
  subcontractorAssignedJobStageDisplay,
  subcontractorLastActivityBlock,
  subcontractorLastActivityTypeLine,
} from './dashboardJobRowActivity'

const NOW = new Date('2026-07-17T12:00:00Z')

describe('formatTimeSince', () => {
  it('returns em dash for null', () => {
    expect(formatTimeSince(null, NOW)).toBe('—')
  })

  it('returns "just now" under a minute', () => {
    expect(formatTimeSince('2026-07-17T11:59:30Z', NOW)).toBe('just now')
  })

  it('formats minutes with singular/plural', () => {
    expect(formatTimeSince('2026-07-17T11:59:00Z', NOW)).toBe('1 minute')
    expect(formatTimeSince('2026-07-17T11:15:00Z', NOW)).toBe('45 minutes')
  })

  it('formats hours under a day', () => {
    expect(formatTimeSince('2026-07-17T11:00:00Z', NOW)).toBe('1 hour')
    expect(formatTimeSince('2026-07-16T13:00:00Z', NOW)).toBe('23 hours')
  })

  it('formats days under a week', () => {
    expect(formatTimeSince('2026-07-16T11:00:00Z', NOW)).toBe('1 day')
    expect(formatTimeSince('2026-07-11T12:00:00Z', NOW)).toBe('6 days')
  })

  it('formats weeks under ~a month', () => {
    expect(formatTimeSince('2026-07-10T12:00:00Z', NOW)).toBe('1 week')
    expect(formatTimeSince('2026-06-24T12:00:00Z', NOW)).toBe('3 weeks')
  })

  it('formats months under a year (30-day months)', () => {
    expect(formatTimeSince('2026-06-15T12:00:00Z', NOW)).toBe('1 month')
    expect(formatTimeSince('2025-09-17T12:00:00Z', NOW)).toBe('10 months')
  })

  it('formats years past 12 30-day months', () => {
    expect(formatTimeSince('2025-07-10T12:00:00Z', NOW)).toBe('1 year')
    expect(formatTimeSince('2023-07-01T12:00:00Z', NOW)).toBe('3 years')
  })
})

describe('subcontractorAssignedJobStageDisplay', () => {
  it('shows the trimmed stage name when present', () => {
    expect(
      subcontractorAssignedJobStageDisplay({ in_progress_stage_name: ' Rough-in ', project_id: 'p1' }),
    ).toEqual({ line: 'Stage: Rough-in', title: undefined })
  })

  it('shows the em-dash placeholder with tooltip when only a project exists', () => {
    expect(subcontractorAssignedJobStageDisplay({ in_progress_stage_name: '  ', project_id: 'p1' })).toEqual({
      line: 'Stage: —',
      title: 'No step is currently in progress for this project',
    })
  })

  it('returns null with neither stage nor project', () => {
    expect(subcontractorAssignedJobStageDisplay({ in_progress_stage_name: null, project_id: null })).toBeNull()
  })
})

describe('subcontractorLastActivityTypeLine', () => {
  const base = {
    last_job_activity_at: '2026-07-17T10:00:00Z',
    last_thread_note_at: null,
    last_report_at: null,
    last_clock_activity_at: null,
    last_schedule_activity_at: null,
  }

  it('falls back to "Activity" when there is no winner timestamp', () => {
    expect(subcontractorLastActivityTypeLine({ ...base, last_job_activity_at: null })).toBe('Activity')
    expect(subcontractorLastActivityTypeLine({ ...base, last_job_activity_at: 'not-a-date' })).toBe('Activity')
    expect(subcontractorLastActivityTypeLine(base)).toBe('Activity')
  })

  it('labels the single matching source', () => {
    expect(
      subcontractorLastActivityTypeLine({ ...base, last_report_at: '2026-07-17T10:00:00Z' }),
    ).toBe('Field report')
    expect(
      subcontractorLastActivityTypeLine({ ...base, last_schedule_activity_at: '2026-07-17T10:00:00Z' }),
    ).toBe('Schedule')
  })

  it('comma-joins ms ties in fixed source order', () => {
    expect(
      subcontractorLastActivityTypeLine({
        ...base,
        last_clock_activity_at: '2026-07-17T10:00:00Z',
        last_thread_note_at: '2026-07-17T10:00:00Z',
      }),
    ).toBe('Thread note, Clock session')
  })

  it('ignores sources older than the winning instant', () => {
    expect(
      subcontractorLastActivityTypeLine({
        ...base,
        last_thread_note_at: '2026-07-17T09:00:00Z',
        last_clock_activity_at: '2026-07-17T10:00:00Z',
      }),
    ).toBe('Clock session')
  })
})

describe('subcontractorLastActivityBlock', () => {
  const base = {
    last_job_activity_at: null,
    last_thread_note_at: null,
    last_report_at: null,
    last_clock_activity_at: null,
    last_schedule_activity_at: null,
  }

  it('returns the no-activity block without a line3', () => {
    const b = subcontractorLastActivityBlock(base, NOW)
    expect(b.line1).toBe('Last activity:')
    expect(b.line2).toBe('No activity yet')
    expect(b.line3).toBeUndefined()
    expect(b.title).toBe('No thread notes, field reports, work sessions, or schedule activity on this job yet')
  })

  it('renders "Just now" (capitalized) for fresh activity', () => {
    const b = subcontractorLastActivityBlock(
      { ...base, last_job_activity_at: '2026-07-17T11:59:45Z', last_report_at: '2026-07-17T11:59:45Z' },
      NOW,
    )
    expect(b.line2).toBe('Just now')
    expect(b.line3).toBe('Field report')
  })

  it('renders a relative "ago" line and the type line for older activity', () => {
    const b = subcontractorLastActivityBlock(
      { ...base, last_job_activity_at: '2026-07-17T09:00:00Z', last_clock_activity_at: '2026-07-17T09:00:00Z' },
      NOW,
    )
    expect(b.line2).toBe('3 hours ago')
    expect(b.line3).toBe('Clock session')
    expect(b.title.startsWith('Latest activity: ')).toBe(true)
  })
})
