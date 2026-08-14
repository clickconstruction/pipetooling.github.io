import { describe, expect, it } from 'vitest'
import { buildJobActivityBoxFeed, stripRedundantStampBody } from './jobActivityBoxFeed'
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
