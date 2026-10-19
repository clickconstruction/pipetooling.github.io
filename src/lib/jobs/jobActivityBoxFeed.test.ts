import { describe, expect, it } from 'vitest'
import { buildJobActivityBoxFeed, SENT_BY_APP, sentLineBody, stripRedundantStampBody } from './jobActivityBoxFeed'
import type { JobThreadActivityItem } from '../../components/JobThreadNotesPanel'
import type { JobThreadEventActivityItem } from '../jobActivityEvent'
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
  it('numbers chronologically with 1 = oldest and returns chat order — newest last (v2.2062)', () => {
    const feed = buildJobActivityBoxFeed([
      note('n2', '2026-08-10T15:00:00Z', 'Punch list done'),
      note('n1', '2026-08-07T20:00:00Z', 'Bill sent to Charles'),
      note('n3', '2026-08-11T19:10:00Z', 'Emailed Charles to follow up'),
    ])
    expect(feed.map((e) => e.number)).toEqual([1, 2, 3])
    expect(feed[0]).toMatchObject({ number: 1, body: 'Bill sent to Charles' })
    expect(feed[2]).toMatchObject({ number: 3, body: 'Emailed Charles to follow up' })
  })

  it('includes reports in the numbering and labels them', () => {
    const feed = buildJobActivityBoxFeed([
      report('r1', '2026-08-08T12:00:00Z', 'Status Report'),
      note('n1', '2026-08-09T12:00:00Z', 'Arrived at job', 'Malachi'),
    ])
    expect(feed.map((e) => [e.number, e.kind])).toEqual([
      [1, 'report'],
      [2, 'note'],
    ])
    expect(feed[0]).toMatchObject({ body: 'Report: Status Report', authorName: 'Paige' })
  })

  it('excludes schedule/clock/event synthetic items from the feed and the numbering', () => {
    const scheduleItem = { kind: 'schedule', block: {} } as unknown as JobThreadActivityItem
    const feed = buildJobActivityBoxFeed([
      note('n1', '2026-08-09T12:00:00Z', 'first'),
      scheduleItem,
      note('n2', '2026-08-10T12:00:00Z', 'second'),
    ])
    expect(feed).toHaveLength(2)
    expect(feed.map((e) => e.number)).toEqual([1, 2])
  })

  it('empty input → empty feed', () => {
    expect(buildJobActivityBoxFeed([])).toEqual([])
  })

  it('reduces arrive/leave stamp bodies to their phrase (v2.1640)', () => {
    const feed = buildJobActivityBoxFeed([
      note('n1', '2026-08-12T16:58:00Z', 'Abraham · Wed, Aug 12, 2026 at 11:58 AM — Leaving job'),
      note('n2', '2026-08-12T15:58:00Z', 'Abraham · Wed, Aug 12, 2026 at 10:58 AM — Arrived at job'),
    ])
    expect(feed.map((e) => e.body)).toEqual(['Arrived at job', 'Leaving job'])
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

describe('a bill sent to the customer (v2.5633)', () => {
  const event = (id: string, at: string, type: 'invoice_sent' | 'invoice_stripe_email_sent' | 'payment_added', over: Partial<JobThreadEventActivityItem['event']> = {}): JobThreadActivityItem => ({
    kind: 'event',
    event: { dedupeKey: `ev:${id}`, type, occurredAt: at, actorName: null, summary: '', financial: true, ...over },
  })

  it('sits in its place in time with no number, so the notes keep theirs, and other events stay out', () => {
    const feed = buildJobActivityBoxFeed([
      note('n1', '2026-08-07T20:00:00Z', 'Punch list done'),
      event('e-pay', '2026-08-09T15:00:00Z', 'payment_added', { summary: 'Payment $1,200.00 (check)' }),
      event('e-sent', '2026-08-08T21:02:18Z', 'invoice_sent', { summary: 'Invoice sent to customer (stripe)', detail: { channel: 'stripe' } }),
      note('n2', '2026-08-10T15:00:00Z', 'Called about the bill'),
    ])
    expect(feed.map((e) => [e.kind, e.number])).toEqual([
      ['note', 1],
      ['sent', null],
      ['note', 2],
    ])
    expect(feed[1]).toMatchObject({ authorName: SENT_BY_APP, body: 'Bill emailed through Stripe', atIso: '2026-08-08T21:02:18Z' })
  })

  it('names the sender off the row when the event has one', () => {
    const [sent] = buildJobActivityBoxFeed([event('e', '2026-08-08T21:02:18Z', 'invoice_sent', { actorName: 'Taunya', summary: 'Invoice sent to customer (email)' })])
    expect(sent).toMatchObject({ kind: 'sent', authorName: 'Taunya', body: 'Bill emailed to the customer' })
  })

  it('reads the channel from the detail, else the summary, and knows the backfill’s Stripe kind', () => {
    expect(sentLineBody({ type: 'invoice_sent', summary: 'Invoice sent to customer (stripe)', detail: undefined })).toBe('Bill emailed through Stripe')
    expect(sentLineBody({ type: 'invoice_sent', summary: 'Invoice sent to customer', detail: { channel: 'email' } })).toBe('Bill emailed to the customer')
    expect(sentLineBody({ type: 'invoice_sent', summary: 'Invoice sent to customer (mail)', detail: undefined })).toBe('Bill sent to the customer')
    expect(sentLineBody({ type: 'invoice_stripe_email_sent', summary: 'Stripe emailed the invoice', detail: undefined })).toBe('Bill emailed through Stripe')
  })
})
