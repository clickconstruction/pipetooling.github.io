import { describe, expect, it } from 'vitest'
import {
  composeWriteupsTimeline,
  LATE_TEMPLATE_SORT_KEY,
  NCNS_TEMPLATE_SORT_KEY,
  WRITEUPS_SHOW_ATTENDANCE_DEFAULT,
  writeupsTimelineIncludesRecords,
  type WriteupsTimelineFilters,
} from './writeupsTimeline'

const writeup = (over: Record<string, unknown> = {}) => ({
  id: 'w1',
  subject_name: 'Hal Sample',
  template_id: 't-tardy',
  template_name: 'Tardiness',
  status: 'submitted',
  disclosure: 'discussed_with_subject',
  created_at: '2026-10-20T15:00:00Z',
  ...over,
})
const ncns = (over: Record<string, unknown> = {}) => ({ id: 'n1', subject_name: 'Pat Sample', work_date: '2026-10-25', created_at: '2026-10-25T20:00:00Z', ...over })
const late = (over: Record<string, unknown> = {}) => ({ user_id: 'u-hal', subject_name: 'Hal Sample', work_date: '2026-10-28', label: 'Late 35m', ...over })

const ALL: WriteupsTimelineFilters = { subject: '', templateId: '', status: 'all', disclosure: 'all' }

const kinds = (rows: Array<{ kind: string }>) => rows.map((r) => r.kind)

describe('composeWriteupsTimeline', () => {
  const input = { writeups: [writeup()], ncnsRows: [ncns()], lateEntries: [late(), late({ work_date: '2026-10-29', label: 'Late 20m' })] }

  it('opens without the lates: Show attendance (derived) is off by default', () => {
    expect(WRITEUPS_SHOW_ATTENDANCE_DEFAULT).toBe(false)
    const rows = composeWriteupsTimeline({ ...input, showAttendance: WRITEUPS_SHOW_ATTENDANCE_DEFAULT, filters: ALL, sortKey: 'created_at' })
    expect(kinds(rows)).toEqual(['ncns', 'writeup'])
  })

  it('with the box ticked the lates join the list, newest first by date', () => {
    const rows = composeWriteupsTimeline({ ...input, showAttendance: true, filters: ALL, sortKey: 'created_at' })
    expect(kinds(rows)).toEqual(['late', 'late', 'ncns', 'writeup'])
    expect(rows[0]!.kind === 'late' && rows[0]!.late.work_date).toBe('2026-10-29')
  })

  it('the subject search holds every kind, inside the name and case folded', () => {
    const rows = composeWriteupsTimeline({ ...input, showAttendance: true, filters: { ...ALL, subject: 'hal' }, sortKey: 'created_at' })
    expect(kinds(rows)).toEqual(['late', 'late', 'writeup'])
    const pat = composeWriteupsTimeline({ ...input, showAttendance: true, filters: { ...ALL, subject: 'PAT' }, sortKey: 'created_at' })
    expect(kinds(pat)).toEqual(['ncns'])
  })

  it('a template, status or disclosure filter is a write-up filter: it hides the no-shows and the lates', () => {
    expect(writeupsTimelineIncludesRecords(ALL)).toBe(true)
    expect(writeupsTimelineIncludesRecords({ ...ALL, templateId: 't-tardy' })).toBe(false)
    expect(writeupsTimelineIncludesRecords({ ...ALL, status: 'draft' })).toBe(false)
    expect(writeupsTimelineIncludesRecords({ ...ALL, disclosure: 'withheld_from_subject' })).toBe(false)
    expect(kinds(composeWriteupsTimeline({ ...input, showAttendance: true, filters: { ...ALL, templateId: 't-tardy' }, sortKey: 'created_at' }))).toEqual(['writeup'])
    expect(kinds(composeWriteupsTimeline({ ...input, showAttendance: true, filters: { ...ALL, status: 'draft' }, sortKey: 'created_at' }))).toEqual([])
    expect(kinds(composeWriteupsTimeline({ ...input, showAttendance: true, filters: { ...ALL, disclosure: 'discussed_with_subject' }, sortKey: 'created_at' }))).toEqual(['writeup'])
  })

  it('sorts by subject with the newest first inside a name, and by template with the records under their own keys', () => {
    const bySubject = composeWriteupsTimeline({ ...input, showAttendance: true, filters: ALL, sortKey: 'subject' })
    expect(kinds(bySubject)).toEqual(['late', 'late', 'writeup', 'ncns'])
    const byTemplate = composeWriteupsTimeline({ ...input, showAttendance: true, filters: ALL, sortKey: 'template' })
    expect(kinds(byTemplate)).toEqual(['late', 'late', 'ncns', 'writeup'])
    expect(LATE_TEMPLATE_SORT_KEY.localeCompare(NCNS_TEMPLATE_SORT_KEY)).toBeLessThan(0)
    expect(NCNS_TEMPLATE_SORT_KEY.localeCompare('Tardiness')).toBeLessThan(0)
  })

  it('with nothing on file the list is empty, ticked or not', () => {
    expect(composeWriteupsTimeline({ writeups: [], ncnsRows: [], lateEntries: [], showAttendance: true, filters: ALL, sortKey: 'created_at' })).toEqual([])
  })
})
