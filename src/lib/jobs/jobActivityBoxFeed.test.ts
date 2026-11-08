import { describe, expect, it } from 'vitest'
import { activityBoxTeaser, buildJobActivityBoxFeed, SENT_BY_APP, sentLineBody, stripRedundantStampBody } from './jobActivityBoxFeed'
import type { JobActivityMessage } from './jobActivityMessages'
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

describe('the papers that follow a bill (v2.5636)', () => {
  const event = (id: string, at: string, type: JobThreadEventActivityItem['event']['type'], over: Partial<JobThreadEventActivityItem['event']> = {}): JobThreadActivityItem => ({
    kind: 'event',
    event: { dedupeKey: `ev:${id}`, type, occurredAt: at, actorName: null, summary: '', financial: true, ...over },
  })

  it('a paper resend, a demand letter and a notice come in unnumbered, each in its words; a contract reminder stays out', () => {
    const feed = buildJobActivityBoxFeed([
      note('n1', '2026-10-01T15:00:00Z', 'Bill out'),
      event('e-resent', '2026-10-05T15:00:00Z', 'invoice_resent', { actorName: 'Kim', summary: 'Invoice emailed again to pat@example.test' }),
      event('e-remind', '2026-10-06T15:00:00Z', 'contract_reminded', { summary: 'Contract reminder 1 emailed to pat@example.test — Service agreement' }),
      event('e-demand', '2026-10-12T19:30:00Z', 'demand_letter_sent', { actorName: 'Kim', summary: 'Demand letter sent to Pat Example by certified mail — $4,720.00' }),
      event('e-notice', '2026-10-15T20:00:00Z', 'lien_notice_sent', { actorName: 'Lee', detail: { kind: 'notice_53_056' } }),
      event('e-retainage', '2026-10-16T20:00:00Z', 'lien_notice_sent', { detail: { kind: 'retainage_53_057' } }),
      note('n2', '2026-10-17T15:00:00Z', 'They called back'),
    ])
    expect(feed.map((e) => [e.kind, e.number, e.body])).toEqual([
      ['note', 1, 'Bill out'],
      ['sent', null, 'Bill emailed again'],
      ['sent', null, 'Demand letter sent'],
      ['sent', null, 'Lien notice sent'],
      ['sent', null, 'Retainage notice sent'],
      ['note', 2, 'They called back'],
    ])
    expect(feed.map((e) => e.authorName)).toEqual(['Roxi', 'Kim', 'Kim', 'Lee', SENT_BY_APP, 'Roxi'])
  })

  it('names each send by its type before reading a channel', () => {
    expect(sentLineBody({ type: 'invoice_resent', summary: 'Invoice emailed again to x (stripe)', detail: { channel: 'physical' } })).toBe('Bill emailed again')
    expect(sentLineBody({ type: 'demand_letter_sent', summary: 'Demand letter sent to x by email — $1.00', detail: { sent_method: 'email' } })).toBe('Demand letter sent')
    expect(sentLineBody({ type: 'lien_notice_sent', summary: 'Lien notice sent — $75.00', detail: undefined })).toBe('Lien notice sent')
  })
})

describe('the customer’s conversation in the box (v2.6689, punch list #125)', () => {
  const line = (id: string, at: string, over: Partial<JobActivityMessage> = {}): JobActivityMessage => ({
    id,
    contactId: 'c-dana',
    contact: { name: 'Dana Whitfield', goesBy: null, kind: 'customer' },
    channel: 'text',
    direction: 'in',
    at,
    who: '',
    body: 'Can you do Thursday after 10 instead?',
    tied: true,
    ...over,
  })

  it('a line sits in its place in time with no number under its channel’s tag, and the notes keep their numbers', () => {
    const feed = buildJobActivityBoxFeed(
      [note('n5', '2026-10-05T20:12:00Z', 'Rough-in done.', 'Marcus'), note('n6', '2026-10-06T14:02:00Z', 'Inspector confirmed. Gate code is 4471.', 'Rosa')],
      {
        lines: [
          line('m-out', '2026-10-05T21:40:00Z', { direction: 'out', who: 'Tanya Ortiz', body: 'Dana, the city set your inspection for Thursday 8 to 10.' }),
          line('m-in', '2026-10-06T23:15:00Z'),
        ],
      },
    )
    expect(feed.map((e) => [e.kind, e.number])).toEqual([
      ['note', 1],
      ['line', null],
      ['note', 2],
      ['line', null],
    ])
    expect(feed[1]).toMatchObject({ authorName: 'Tanya Ortiz', line: { tag: 'Text', fromThem: false, customer: true, waiting: false, channelWord: 'text' } })
    expect(feed[3]).toMatchObject({ authorName: 'Dana', body: 'Can you do Thursday after 10 instead?', line: { tag: 'Text', fromThem: true, customer: true, waiting: false } })
  })

  it('tags each channel in one word, reads an email’s subject first and a call’s summary, and leaves a note out', () => {
    const feed = buildJobActivityBoxFeed([], {
      lines: [
        line('m-call', '2026-10-01T12:00:00Z', { channel: 'call', durationSeconds: 192, summary: 'Dana asked about the permit.', body: 'Call.', who: 'answered on the company number' }),
        line('m-missed', '2026-10-01T12:01:00Z', { channel: 'missed', body: '' }),
        line('m-vm', '2026-10-01T12:02:00Z', { channel: 'voicemail', transcript: 'Call me back about Thursday.', body: '' }),
        line('m-email', '2026-10-01T12:03:00Z', { channel: 'email', subject: 'Inspection', body: 'Thursday works for me.' }),
        line('m-portal', '2026-10-01T12:04:00Z', { channel: 'portal', body: 'Paid on the page.' }),
        line('m-note', '2026-10-01T12:05:00Z', { channel: 'note', direction: 'team', who: 'Rosa', body: 'Texts after 5.' }),
      ],
    })
    expect(feed.map((e) => e.line?.tag)).toEqual(['Call', 'Missed', 'Voicemail', 'Email', 'Portal'])
    expect(feed[0]).toMatchObject({ body: 'Dana asked about the permit.', line: { channelWord: 'call · 3:12' } })
    expect(feed[1]!.body).toBe('No voicemail.')
    expect(feed[2]!.body).toBe('Call me back about Thursday.')
    expect(feed[3]!.body).toBe('Inspection · Thursday works for me.')
  })

  it('a trade’s line tied to the job reads plain, not orange', () => {
    const feed = buildJobActivityBoxFeed([], { lines: [line('m-hector', '2026-10-01T12:00:00Z', { contactId: 'c-hector', contact: { name: 'Hector Ruiz', goesBy: null, kind: 'trade' }, body: 'Trencher on site at 7.' })] })
    expect(feed[0]).toMatchObject({ authorName: 'Hector', line: { customer: false, fromThem: true } })
  })

  it('while nobody has answered, the customer’s newest line carries the words and no other does', () => {
    const feed = buildJobActivityBoxFeed([], {
      lines: [line('m-1', '2026-10-01T12:00:00Z'), line('m-2', '2026-10-02T12:00:00Z'), line('m-3', '2026-10-03T12:00:00Z', { direction: 'out', who: 'Tanya' })],
      waiting: true,
    })
    expect(feed.map((e) => e.line?.waiting)).toEqual([false, true, false])
    expect(buildJobActivityBoxFeed([], { lines: [line('m-1', '2026-10-01T12:00:00Z')] })[0]!.line!.waiting).toBe(false)
  })

  describe('activityBoxTeaser', () => {
    const stat = {
      last_note_at: '2026-10-06T14:02:00Z',
      last_note_body: 'Inspector confirmed. Gate code is 4471.',
      last_note_author_name: 'Rosa',
      last_report_at: '2026-10-05T12:00:00Z',
      last_report_author_name: 'Marcus',
      last_report_template_name: 'Status Report',
      last_report_preview: 'I think the job is 60% complete',
    }

    it('takes the newest of the note, the report and the line', () => {
      expect(activityBoxTeaser(stat, [line('m-in', '2026-10-06T23:15:00Z')], true)).toMatchObject({ kind: 'line', authorName: 'Dana', line: { tag: 'Text', waiting: true } })
      expect(activityBoxTeaser(stat, [line('m-in', '2026-10-06T10:00:00Z')])).toMatchObject({ kind: 'note', authorName: 'Rosa', body: 'Inspector confirmed. Gate code is 4471.' })
      expect(activityBoxTeaser({ ...stat, last_note_at: null, last_note_body: null }, [])).toMatchObject({ kind: 'report', body: 'I think the job is 60% complete' })
      expect(activityBoxTeaser(undefined, [line('m-in', '2026-10-06T10:00:00Z')])).toMatchObject({ kind: 'line' })
    })

    it('is null with nothing on the job', () => {
      expect(activityBoxTeaser(undefined, [])).toBeNull()
      expect(activityBoxTeaser({ ...stat, last_note_at: null, last_report_at: null }, undefined)).toBeNull()
    })
  })
})

describe('every event the customer got or did (v2.6690, punch list #125)', () => {
  const ev = (key: string, at: string, type: JobThreadEventActivityItem['event']['type'], summary: string, actor: string | null = null): JobThreadActivityItem => ({
    kind: 'event',
    event: { dedupeKey: key, type, occurredAt: at, actorName: actor, summary, financial: true },
  })

  it('comes in unnumbered under its tag, in its words, with the customer named on what they did', () => {
    const feed = buildJobActivityBoxFeed([
      note('n1', '2026-08-10T12:00:00Z', 'older note'),
      ev('e1', '2026-08-11T12:00:00Z', 'contract_sent', 'Contract sent to dana@example.test — Service agreement', 'Rosa'),
      ev('e2', '2026-08-11T13:00:00Z', 'contract_viewed', 'Contract opened by the customer'),
      ev('e3', '2026-08-11T14:00:00Z', 'contract_signed', 'Contract signed by Dana Whitfield — Service agreement'),
      ev('e4', '2026-08-12T12:00:00Z', 'lien_release_signature_requested', 'Signature requested — Final release $4,820.00', 'Rosa'),
      ev('e5', '2026-08-12T13:00:00Z', 'payment_promise', 'They said Friday, by phone'),
      ev('e6', '2026-08-12T14:00:00Z', 'contract_reminded', 'Contract reminder emailed'),
      ev('e7', '2026-08-12T15:00:00Z', 'payment_added', 'Payment $1,200.00 (card)'),
      note('n2', '2026-08-13T12:00:00Z', 'newer note'),
    ])
    expect(feed.map((e) => [e.kind, e.number, e.sentTag ?? null])).toEqual([
      ['note', 1, null],
      ['sent', null, 'Sent'],
      ['sent', null, 'Opened'],
      ['sent', null, 'Signed'],
      ['sent', null, 'Sent'],
      ['sent', null, 'Said'],
      ['note', 2, null],
    ])
    expect(feed[1]).toMatchObject({ authorName: 'Rosa', body: 'Contract sent' })
    expect(feed[2]).toMatchObject({ authorName: 'The customer', body: 'Contract opened by the customer' })
    expect(feed[3]).toMatchObject({ authorName: 'The customer', body: 'Contract signed' })
    expect(feed[4]).toMatchObject({ body: 'Release sent to sign' })
    expect(feed[5]).toMatchObject({ authorName: 'The customer', body: 'They said Friday, by phone' })
  })

  it('reads a re-sent contract and a paper signature from the event’s words', () => {
    expect(sentLineBody({ type: 'contract_sent', summary: 'Contract re-sent to dana@example.test — Service agreement' })).toBe('Contract sent again')
    expect(sentLineBody({ type: 'contract_signed', summary: 'Signed contract on file (paper) — Service agreement' })).toBe('Signed contract on file')
    expect(sentLineBody({ type: 'lien_courtesy_sent', summary: 'Courtesy notice sent' })).toBe('Courtesy notice sent')
  })
})
