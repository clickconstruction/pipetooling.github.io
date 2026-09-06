import { describe, expect, it } from 'vitest'

import {
  SCHEDULE_PREVIEW_UNASSIGNED,
  schedulePreviewByPerson,
  schedulePreviewDateLabel,
  schedulePreviewJobLabel,
  schedulePreviewLines,
  schedulePreviewSummary,
  schedulePreviewSummaryLabel,
  type SchedulePreviewBlockRow,
} from './scheduleSharePreview'

function row(over: Partial<SchedulePreviewBlockRow> & { id: string }): SchedulePreviewBlockRow {
  return {
    work_date: '2026-09-02',
    time_start: '07:00:00',
    time_end: '15:30:00',
    note: null,
    assignee_name: 'Paige',
    job_hcp_number: 'J512',
    job_name: 'Smith House Repipe',
    job_address: '123 Main St',
    ...over,
  }
}

describe('scheduleSharePreview', () => {
  it('renders a job row the way the email does: window, person, "number · name"', () => {
    const [line] = schedulePreviewLines([row({ id: 'a' })])
    expect(line).toMatchObject({
      workDate: '2026-09-02',
      dateLabel: 'Wed, Sep 2',
      window: '7:00 AM–3:30 PM',
      person: 'Paige',
      jobLabel: 'J512 · Smith House Repipe',
      address: '123 Main St',
      note: '',
    })
  })

  it('shows bid visits with the RPC\'s B-number fallback — the v2.1624 claim becomes visible', () => {
    const [line] = schedulePreviewLines([
      row({ id: 'b', job_hcp_number: 'B412', job_name: 'Oakmont Clubhouse', job_address: null }),
    ])
    expect(line!.jobLabel).toBe('B412 · Oakmont Clubhouse')
    expect(line!.address).toBe('')
  })

  it('falls back to "— · Job" and "(Unassigned)" exactly like the email', () => {
    expect(schedulePreviewJobLabel({ job_hcp_number: '  ', job_name: null })).toBe('— · Job')
    const [line] = schedulePreviewLines([row({ id: 'c', assignee_name: '   ' })])
    expect(line!.person).toBe(SCHEDULE_PREVIEW_UNASSIGNED)
  })

  it('filters to the share date set (current day + rest of week skips nothing; next-day-only drops today)', () => {
    const rows = [
      row({ id: 'today' }),
      row({ id: 'tomorrow', work_date: '2026-09-03' }),
      row({ id: 'timestamp', work_date: '2026-09-04T00:00:00' }),
    ]
    expect(schedulePreviewLines(rows, ['2026-09-03']).map((l) => l.id)).toEqual(['tomorrow'])
    expect(schedulePreviewLines(rows, ['2026-09-03', '2026-09-04']).map((l) => l.id)).toEqual(['tomorrow', 'timestamp'])
    expect(schedulePreviewLines(rows).map((l) => l.id)).toEqual(['today', 'tomorrow', 'timestamp'])
  })

  it('groups by person in first-seen (RPC) order without re-sorting lines', () => {
    const lines = schedulePreviewLines([
      row({ id: '1', assignee_name: 'Marcus' }),
      row({ id: '2', assignee_name: 'Marcus', time_start: '13:00:00', time_end: '16:00:00' }),
      row({ id: '3', assignee_name: 'Paige' }),
    ])
    const groups = schedulePreviewByPerson(lines)
    expect(groups.map((g) => g.person)).toEqual(['Marcus', 'Paige'])
    expect(groups[0]!.lines.map((l) => l.id)).toEqual(['1', '2'])
  })

  it('summarises blocks · people · days, naming days only for multi-day sends', () => {
    const lines = schedulePreviewLines([
      row({ id: '1', assignee_name: 'Marcus' }),
      row({ id: '2', assignee_name: 'Paige', work_date: '2026-09-03' }),
      row({ id: '3', assignee_name: 'Paige', work_date: '2026-09-03', time_start: '13:00:00' }),
    ])
    const summary = schedulePreviewSummary(lines)
    expect(summary).toEqual({ blockCount: 3, personCount: 2, dayCount: 2 })
    expect(schedulePreviewSummaryLabel(summary, { multiDay: true })).toBe('3 blocks · 2 people · 2 days')
    expect(schedulePreviewSummaryLabel({ blockCount: 1, personCount: 1, dayCount: 1 }, { multiDay: false })).toBe(
      '1 block · 1 person',
    )
  })

  it('says so honestly when nothing is scheduled', () => {
    expect(schedulePreviewSummaryLabel(schedulePreviewSummary([]), { multiDay: true })).toBe(
      'Nothing scheduled — the email will say so.',
    )
  })

  it('leaves an unparseable date alone', () => {
    expect(schedulePreviewDateLabel('not-a-date')).toBe('not-a-date')
  })
})
