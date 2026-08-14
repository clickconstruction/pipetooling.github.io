import { describe, expect, it } from 'vitest'
import {
  buildJobActivityBoxFeed,
  buildJobActivityModalItems,
  filterJobActivityModalItems,
  groupJobActivityModalItemsByDay,
  stripRedundantStampBody,
} from './jobActivityBoxFeed'
import type { JobThreadActivityItem } from '../../components/JobThreadNotesPanel'
import type { JobThreadNoteRow } from '../../components/JobThreadNotesPanel'

const note = (id: string, at: string, body: string, author: string | null = 'Roxi'): JobThreadActivityItem => ({
  kind: 'note',
  note: {
    id,
    created_at: at,
    body,
    author: author ? { name: author } : null,
  } as unknown as JobThreadNoteRow,
})

const report = (id: string, at: string, template: string, by = 'Paige'): JobThreadActivityItem => ({
  kind: 'report',
  report: {
    id,
    template_name: template,
    job_display_name: '',
    created_at: at,
    created_by_name: by,
  },
})

describe('buildJobActivityBoxFeed', () => {
  it('numbers chronologically with 1 = oldest and returns newest first', () => {
    const feed = buildJobActivityBoxFeed([
      note('n2', '2026-08-10T15:00:00Z', 'Punch list done'),
      note('n1', '2026-08-07T20:00:00Z', 'Bill sent to Charles'),
      note('n3', '2026-08-11T19:10:00Z', 'Emailed Charles to follow up'),
    ])
    expect(feed.map((e) => e.number)).toEqual([3, 2, 1])
    expect(feed[0]).toMatchObject({ number: 3, body: 'Emailed Charles to follow up' })
    expect(feed[2]).toMatchObject({ number: 1, body: 'Bill sent to Charles' })
  })

  it('includes reports in the numbering and labels them', () => {
    const feed = buildJobActivityBoxFeed([
      report('r1', '2026-08-08T12:00:00Z', 'Status Report'),
      note('n1', '2026-08-09T12:00:00Z', 'Arrived at job', 'Malachi'),
    ])
    expect(feed.map((e) => [e.number, e.kind])).toEqual([
      [2, 'note'],
      [1, 'report'],
    ])
    expect(feed[1]).toMatchObject({ body: 'Report: Status Report', authorName: 'Paige' })
  })

  it('excludes schedule/clock/event synthetic items from the feed and the numbering', () => {
    const scheduleItem = { kind: 'schedule', block: {} } as unknown as JobThreadActivityItem
    const feed = buildJobActivityBoxFeed([
      note('n1', '2026-08-09T12:00:00Z', 'first'),
      scheduleItem,
      note('n2', '2026-08-10T12:00:00Z', 'second'),
    ])
    expect(feed).toHaveLength(2)
    expect(feed.map((e) => e.number)).toEqual([2, 1])
  })

  it('empty input → empty feed', () => {
    expect(buildJobActivityBoxFeed([])).toEqual([])
  })

  it('reduces arrive/leave stamp bodies to their phrase (v2.1640)', () => {
    const feed = buildJobActivityBoxFeed([
      note('n1', '2026-08-12T16:58:00Z', 'Abraham · Wed, Aug 12, 2026 at 11:58 AM — Leaving job'),
      note('n2', '2026-08-12T15:58:00Z', 'Abraham · Wed, Aug 12, 2026 at 10:58 AM — Arrived at job'),
    ])
    expect(feed.map((e) => e.body)).toEqual(['Leaving job', 'Arrived at job'])
  })
})

const eventItem = (dedupeKey: string, at: string, type: string, summary: string): JobThreadActivityItem =>
  ({
    kind: 'event',
    event: { dedupeKey, occurredAt: at, type, summary, actorName: 'System' },
  }) as unknown as JobThreadActivityItem

describe('buildJobActivityModalItems', () => {
  it('interleaves all kinds chronologically; only notes/reports get numbers, matching the box exactly', () => {
    const items = [
      note('n1', '2026-08-12T14:45:00Z', 'Arrived at job', 'Abraham'),
      eventItem('ev1', '2026-08-12T15:00:00Z', 'status_change', 'Status: waiting → working'),
      note('n2', '2026-08-14T16:53:00Z', 'Still Pending Pinpoint-DRF', 'Roxi'),
    ]
    const modal = buildJobActivityModalItems(items)
    expect(modal.map((i) => i.kind)).toEqual(['entry', 'timeline', 'entry'])
    expect(modal.filter((i) => i.kind === 'entry').map((i) => (i.kind === 'entry' ? i.entry.number : -1))).toEqual([1, 2])
    // Numbers match the box's own feed for the same input.
    const boxNums = buildJobActivityBoxFeed(items).map((e) => [e.number, e.body])
    expect(boxNums).toEqual([
      [2, 'Still Pending Pinpoint-DRF'],
      [1, 'Arrived at job'],
    ])
  })

  it('filter narrows by bucket but numbering stays stable (assigned pre-filter)', () => {
    const items = [
      note('n1', '2026-08-12T14:45:00Z', 'first note'),
      eventItem('ev1', '2026-08-12T15:00:00Z', 'status_change', 'Status: waiting → working'),
      note('n2', '2026-08-12T16:00:00Z', 'second note'),
    ]
    const modal = buildJobActivityModalItems(items)
    const notesOnly = filterJobActivityModalItems(modal, 'notes')
    expect(notesOnly.map((i) => (i.kind === 'entry' ? i.entry.number : -1))).toEqual([1, 2])
    const statusOnly = filterJobActivityModalItems(modal, 'status')
    expect(statusOnly).toHaveLength(1)
    expect(statusOnly[0]!.kind).toBe('timeline')
    expect(filterJobActivityModalItems(modal, 'all')).toHaveLength(3)
  })
})

describe('groupJobActivityModalItemsByDay', () => {
  it('groups by Chicago calendar day, oldest day first, with the Today flag', () => {
    const modal = buildJobActivityModalItems([
      // 2026-08-12 14:45Z = Wed Aug 12 09:45 Chicago; 2026-08-14 16:53Z = Fri Aug 14 11:53 Chicago.
      note('n1', '2026-08-12T14:45:00Z', 'Arrived at job', 'Abraham'),
      note('n2', '2026-08-12T14:57:00Z', 'Leaving job', 'Abraham'),
      note('n3', '2026-08-14T16:53:00Z', 'Still Pending Pinpoint-DRF', 'Roxi'),
    ])
    const groups = groupJobActivityModalItemsByDay(modal, new Date('2026-08-14T18:00:00Z'))
    expect(groups.map((g) => g.dayKey)).toEqual(['2026-08-12', '2026-08-14'])
    expect(groups[0]!.label).toBe('Wed, Aug 12')
    expect(groups[0]!.isToday).toBe(false)
    expect(groups[0]!.items).toHaveLength(2)
    expect(groups[1]!.label).toBe('Fri, Aug 14')
    expect(groups[1]!.isToday).toBe(true)
  })

  it('splits on the Chicago midnight, not UTC — a 23:30 vs 01:30 Chicago pair lands on two days', () => {
    const modal = buildJobActivityModalItems([
      // 04:30Z = 23:30 Chicago the PREVIOUS day; 06:30Z = 01:30 Chicago same UTC day.
      note('n1', '2026-08-13T04:30:00Z', 'late note'),
      note('n2', '2026-08-13T06:30:00Z', 'early note'),
    ])
    const groups = groupJobActivityModalItemsByDay(modal, new Date('2026-08-14T18:00:00Z'))
    expect(groups.map((g) => g.dayKey)).toEqual(['2026-08-12', '2026-08-13'])
  })

  it('empty input → no groups; unparseable timestamps fall into a "—" group', () => {
    expect(groupJobActivityModalItemsByDay([], new Date('2026-08-14T18:00:00Z'))).toEqual([])
    const modal = buildJobActivityModalItems([note('n1', 'not-a-date', 'mystery note')])
    const groups = groupJobActivityModalItemsByDay(modal, new Date('2026-08-14T18:00:00Z'))
    expect(groups).toHaveLength(1)
    expect(groups[0]!.dayKey).toBe('')
    expect(groups[0]!.label).toBe('—')
    expect(groups[0]!.isToday).toBe(false)
  })
})

describe('stripRedundantStampBody', () => {
  it('strips the exact stamp shape', () => {
    expect(stripRedundantStampBody('Abraham · Wed, Aug 12, 2026 at 11:58 AM — Leaving job')).toBe('Leaving job')
    expect(stripRedundantStampBody('Someone · Thu, Aug 13, 2026 at 9:05 AM — Arrived at job')).toBe('Arrived at job')
  })

  it('leaves manual notes and near-misses untouched', () => {
    expect(stripRedundantStampBody('Arrived at 11:20 am')).toBe('Arrived at 11:20 am')
    expect(stripRedundantStampBody('Leaving job')).toBe('Leaving job')
    expect(stripRedundantStampBody('Talked to GC — Leaving job site was muddy')).toBe(
      'Talked to GC — Leaving job site was muddy',
    )
    expect(stripRedundantStampBody('As we all like to say, “take the win”')).toBe(
      'As we all like to say, “take the win”',
    )
  })
})
