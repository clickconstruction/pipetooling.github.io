import { describe, expect, it } from 'vitest'
import {
  buildJobActivityLines,
  compactChicagoClockTime,
  filterJobActivityLines,
  groupJobActivityLinesByDay,
} from './jobActivityLine'
import type { JobThreadActivityItem, JobThreadNoteRow } from '../../components/JobThreadNotesPanel'

const note = (id: string, at: string, body: string, author: string | null = 'Roxi'): JobThreadActivityItem => ({
  kind: 'note',
  note: {
    id,
    created_at: at,
    body,
    author: author ? { name: author } : null,
  } as unknown as JobThreadNoteRow,
})

const report = (id: string, at: string, template: string, by = 'Abraham'): JobThreadActivityItem => ({
  kind: 'report',
  report: {
    id,
    template_name: template,
    job_display_name: '',
    created_at: at,
    created_by_name: by,
    field_values: {
      'How complete is the job?': '100%',
      'What is the status of the job?': 'Front cleanout is broken; a pinpoint could not be completed.',
    },
  } as unknown as Extract<JobThreadActivityItem, { kind: 'report' }>['report'],
})

const clock = (
  key: string,
  at: string,
  person: string,
  opts: { out?: string | null; hours?: number | null; pending?: boolean; note?: string } = {},
): JobThreadActivityItem => ({
  kind: 'clock_session',
  clock: {
    dedupeKey: key,
    sortAt: at,
    personName: person,
    clockedInAt: at,
    clockedOutAt: opts.out ?? null,
    durationHours: opts.hours ?? null,
    status: opts.pending ? 'pending' : 'approved',
    note: opts.note ?? '',
  },
})

const schedule = (key: string, at: string, assignees: string, blockNote = ''): JobThreadActivityItem => ({
  kind: 'schedule_block',
  schedule: {
    dedupeKey: key,
    sortAt: at,
    work_date: '2026-08-12',
    time_start: '08:00',
    time_end: '12:00',
    note: blockNote,
    assigneeLabels: assignees,
  },
})

const statusEvent = (key: string, at: string, summary: string, actor: string | null = 'Abraham'): JobThreadActivityItem => ({
  kind: 'event',
  event: {
    dedupeKey: key,
    type: 'status_change',
    occurredAt: at,
    actorName: actor,
    summary,
    financial: false,
  },
})

describe('compactChicagoClockTime', () => {
  it('drops the space and shortens the meridiem', () => {
    // 14:47 UTC = 9:47 AM Chicago (CDT)
    expect(compactChicagoClockTime('2026-08-12T14:47:00Z')).toBe('9:47a')
    // 19:47 UTC = 2:47 PM Chicago
    expect(compactChicagoClockTime('2026-08-12T19:47:00Z')).toBe('2:47p')
  })
})

describe('buildJobActivityLines', () => {
  it('numbers notes and reports oldest-first and leaves texture unnumbered', () => {
    const lines = buildJobActivityLines([
      statusEvent('e1', '2026-08-12T14:58:00Z', 'Working → Ready to Bill'),
      note('n1', '2026-08-12T14:45:00Z', 'Arrived 9am end 9:20', 'Abraham'),
      report('r1', '2026-08-12T14:57:00Z', 'Status Report'),
      note('n2', '2026-08-14T16:53:00Z', 'Still Pending Pinpoint-DRF'),
    ])
    expect(lines.map((l) => [l.kind, l.number])).toEqual([
      ['note', 1],
      ['report', 2],
      ['event', null],
      ['note', 3],
    ])
  })

  it('numbers every line when asked, without reordering anything', () => {
    const lines = buildJobActivityLines(
      [
        note('n1', '2026-08-12T14:45:00Z', 'first'),
        statusEvent('e1', '2026-08-12T14:58:00Z', 'Working → Ready to Bill'),
        note('n2', '2026-08-14T16:53:00Z', 'second'),
      ],
      { numberEveryLine: true },
    )
    expect(lines.map((l) => l.number)).toEqual([1, 2, 3])
  })

  it('matches the preview box numbering: 1 is the oldest note, ties keep input order', () => {
    const lines = buildJobActivityLines([
      note('n-b', '2026-08-12T14:45:00Z', 'Arrived at job', 'Abraham'),
      note('n-c', '2026-08-12T14:45:00Z', 'Leaving job', 'Abraham'),
    ])
    expect(lines.map((l) => [l.body, l.number])).toEqual([
      ['Arrived at job', 1],
      ['Leaving job', 2],
    ])
  })

  it('folds a report to its template name and moves every answer into detail', () => {
    const [line] = buildJobActivityLines([report('r1', '2026-08-12T14:57:00Z', 'Status Report')])
    expect(line).toMatchObject({ kind: 'report', kindLabel: 'Report', who: 'Abraham', body: 'Status Report' })
    expect(line!.detail.length).toBeGreaterThan(0)
    // The long prose is behind the fold, never on the line itself.
    expect(line!.body).not.toContain('cleanout')
  })

  it('reduces a stamp note to its phrase so the line does not repeat the meta', () => {
    const [line] = buildJobActivityLines([
      note('n1', '2026-08-12T14:45:00Z', 'Abraham · Wed, Aug 12, 2026 at 9:45 AM — Leaving job', 'Abraham'),
    ])
    expect(line).toMatchObject({ body: 'Leaving job', kindLabel: '' })
  })

  it('summarises a closed clock session and flags a pending one', () => {
    const lines = buildJobActivityLines([
      clock('c1', '2026-08-12T12:26:00Z', 'Paige', { out: '2026-08-12T19:47:00Z', hours: 7.35, pending: true, note: 'Work' }),
      clock('c2', '2026-08-12T13:00:00Z', 'Abraham'),
    ])
    expect(lines[0]).toMatchObject({ kindLabel: 'Clock', who: 'Paige', body: '7:26a → 2:47p · 7h 21m', pending: true })
    expect(lines[0]!.detail).toEqual([{ value: 'Work' }])
    expect(lines[1]).toMatchObject({ body: '8:00a → still on the clock', pending: false })
  })

  it('puts schedule assignees in the body because the row has no actor', () => {
    const [line] = buildJobActivityLines([schedule('s1', '2026-08-11T19:50:00Z', 'Abraham, Paige', 'pinpoint')])
    expect(line).toMatchObject({ kindLabel: 'Sched', who: '' })
    expect(line!.body).toContain('Abraham, Paige')
    expect(line!.detail).toEqual([{ value: 'pinpoint' }])
  })

  it('labels events from the shared render registry and falls back to System', () => {
    const lines = buildJobActivityLines([statusEvent('e1', '2026-08-12T14:58:00Z', 'Working → Ready to Bill', null)])
    expect(lines[0]).toMatchObject({ kindLabel: 'Status', who: 'System', body: 'Working → Ready to Bill' })
  })
})

describe('filterJobActivityLines', () => {
  const lines = buildJobActivityLines([
    note('n1', '2026-08-12T14:45:00Z', 'Arrived 9am end 9:20', 'Abraham'),
    report('r1', '2026-08-12T14:57:00Z', 'Status Report'),
    statusEvent('e1', '2026-08-12T14:58:00Z', 'Working → Ready to Bill'),
    note('n2', '2026-08-14T16:53:00Z', 'Still Pending Pinpoint-DRF'),
  ])

  it('returns everything for all', () => {
    expect(filterJobActivityLines(lines, 'all')).toHaveLength(4)
  })

  it('keeps numbers stable across filters — they were assigned pre-filter', () => {
    expect(filterJobActivityLines(lines, 'notes').map((l) => l.number)).toEqual([1, 3])
  })
})

describe('groupJobActivityLinesByDay', () => {
  const now = new Date('2026-08-15T18:00:00Z')

  it('groups by Chicago day with the date and the age on the header', () => {
    const groups = groupJobActivityLinesByDay(
      buildJobActivityLines([
        note('n1', '2026-08-12T14:45:00Z', 'first', 'Abraham'),
        note('n2', '2026-08-12T20:00:00Z', 'second', 'Abraham'),
        note('n3', '2026-08-14T16:53:00Z', 'third'),
      ]),
      now,
    )
    expect(groups.map((g) => [g.label, g.agoLabel, g.lines.length])).toEqual([
      ['Wed, Aug 12', '3d ago', 2],
      ['Fri, Aug 14', '1d ago', 1],
    ])
    expect(groups.every((g) => g.isToday === false)).toBe(true)
  })

  it('marks the current Chicago day', () => {
    const groups = groupJobActivityLinesByDay(
      buildJobActivityLines([note('n1', '2026-08-15T16:00:00Z', 'today note')]),
      now,
    )
    expect(groups[0]).toMatchObject({ isToday: true, agoLabel: 'today' })
  })

  it('splits on the Chicago midnight, not UTC — 23:30 vs 01:30 Chicago land on two days', () => {
    const groups = groupJobActivityLinesByDay(
      buildJobActivityLines([
        // 04:30Z = 23:30 Chicago the PREVIOUS day; 06:30Z = 01:30 Chicago same UTC day.
        note('n1', '2026-08-13T04:30:00Z', 'late note'),
        note('n2', '2026-08-13T06:30:00Z', 'early note'),
      ]),
      now,
    )
    expect(groups.map((g) => g.dayKey)).toEqual(['2026-08-12', '2026-08-13'])
  })

  it('empty input → no groups; unparseable timestamps fall into a "—" group', () => {
    expect(groupJobActivityLinesByDay([], now)).toEqual([])
    const groups = groupJobActivityLinesByDay(buildJobActivityLines([note('n1', 'not-a-date', 'mystery note')]), now)
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ dayKey: '', label: '—', agoLabel: '', isToday: false })
  })
})
