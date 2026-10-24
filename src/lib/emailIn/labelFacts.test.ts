import { describe, expect, it } from 'vitest'
import { arrivedWords, composeLookNote, gmailLabelHref, gmailThreadHref, labelFacts, missingLabelWords, sinceTotals, type ThreadRow } from './labelFacts'

// Made-up rows of a made-up box. The clock is Fri Oct 23, 2026, 9:55 AM in the app's calendar (America/Chicago).
const NOW = '2026-10-23T14:55:00.000Z'
const SINCE = '2026-10-22T17:01:00.000Z' // yesterday's look, 12:01 PM
const ADDRESS = 'bids@clickconstruction.example'

const row = (over: Partial<ThreadRow> & { gmail_thread_id: string }): ThreadRow => ({
  label_name: 'Inbox',
  arrived_at: null,
  last_at: null,
  from_name: null,
  from_address: null,
  subject: '',
  first_seen_at: '2026-10-20T12:00:00Z',
  gone_at: null,
  ...over,
})

const rows: ThreadRow[] = [
  row({ gmail_thread_id: 'ridgeway', arrived_at: '2026-10-17T15:10:00Z', from_name: 'Ridgeway Builders', from_address: 'ap@ridgeway.example', subject: 'Lot 7 — final waivers', first_seen_at: '2026-10-17T15:15:00Z' }),
  row({ gmail_thread_id: 'new-one', arrived_at: '2026-10-22T20:00:00Z', from_address: 'dana@cedarbend.example', subject: 'Building C — plans to bid', first_seen_at: '2026-10-23T14:00:00Z' }),
  row({ gmail_thread_id: 'toll', arrived_at: '2026-10-19T12:00:00Z', from_name: 'Toll Co', subject: 'Toll bill', first_seen_at: '2026-10-19T12:05:00Z', gone_at: '2026-10-23T14:50:00Z' }),
  row({ gmail_thread_id: 'old-gone', arrived_at: '2026-10-10T12:00:00Z', subject: 'Done long ago', first_seen_at: '2026-10-10T12:05:00Z', gone_at: '2026-10-15T14:50:00Z' }),
  row({ gmail_thread_id: 'undated', from_name: 'Nobody', subject: 'No date on this one' }),
  row({ gmail_thread_id: 'other-label', label_name: 'Follow Up', arrived_at: '2026-10-11T12:00:00Z', subject: 'Applicants', first_seen_at: '2026-10-11T12:05:00Z' }),
]

describe('labelFacts: what the station says about one label', () => {
  it('counts the open threads of that label, names the oldest, and lists the ones past the limit with their day and door', () => {
    const f = labelFacts('Inbox', rows, { address: ADDRESS, limitDays: 3, nowIso: NOW, sinceIso: SINCE })
    expect(f.label).toBe('Inbox')
    expect(f.count).toBe(3) // ridgeway, new-one, undated
    expect(f.oldestDays).toBe(6)
    expect(f.past).toEqual([
      {
        threadId: 'ridgeway',
        days: 6,
        arrivedYmd: '2026-10-17',
        arrivedWords: 'Sat Oct 17',
        from: 'Ridgeway Builders',
        subject: 'Lot 7 — final waivers',
        href: 'https://mail.google.com/mail/?authuser=bids%40clickconstruction.example#all/ridgeway',
      },
    ])
    expect(f.newer).toBe(2)
  })

  it('says what moved since the last look: new, cleared, still here', () => {
    const f = labelFacts('Inbox', rows, { address: ADDRESS, limitDays: 3, nowIso: NOW, sinceIso: SINCE })
    expect(f.newSince).toBe(1) // new-one
    expect(f.clearedSince).toBe(1) // toll; old-gone cleared long before
    expect(f.stillSince).toBe(2) // ridgeway, undated
    expect(sinceTotals([f, f])).toEqual({ newSince: 2, clearedSince: 2, stillSince: 4 })
  })

  it('with nobody having looked yet, says nothing moved and counts everything as here', () => {
    const f = labelFacts('Inbox', rows, { address: ADDRESS, limitDays: 3, nowIso: NOW, sinceIso: null })
    expect([f.newSince, f.clearedSince, f.stillSince]).toEqual([0, 0, 0])
  })

  it('orders the stuck oldest first, falls back to the address and "(no subject)", and leaves out an undated thread', () => {
    const more = [
      ...rows,
      row({ gmail_thread_id: 'older', arrived_at: '2026-10-14T12:00:00Z', from_address: 'ap@harlan.example', first_seen_at: '2026-10-14T12:05:00Z' }),
    ]
    const f = labelFacts('Inbox', more, { address: ADDRESS, limitDays: 2, nowIso: NOW, sinceIso: null })
    expect(f.past.map((t) => [t.threadId, t.days, t.from, t.subject])).toEqual([
      ['older', 9, 'ap@harlan.example', '(no subject)'],
      ['ridgeway', 6, 'Ridgeway Builders', 'Lot 7 — final waivers'],
    ])
    expect(f.count).toBe(4)
    expect(f.oldestDays).toBe(9)
  })

  it('reads an empty label as clean', () => {
    expect(labelFacts('Next Actions', rows, { address: ADDRESS, limitDays: 3, nowIso: NOW, sinceIso: SINCE })).toEqual({
      label: 'Next Actions',
      count: 0,
      oldestDays: null,
      past: [],
      newer: 0,
      newSince: 0,
      clearedSince: 0,
      stillSince: 0,
    })
  })
})

describe('the doors into Gmail, under the box’s own address', () => {
  it('opens the Inbox, a label with spaces, and one thread', () => {
    expect(gmailLabelHref(ADDRESS, 'Inbox')).toBe('https://mail.google.com/mail/?authuser=bids%40clickconstruction.example#inbox')
    expect(gmailLabelHref(ADDRESS, 'Follow Up')).toBe('https://mail.google.com/mail/?authuser=bids%40clickconstruction.example#label/Follow+Up')
    expect(gmailThreadHref('work@clickplumbing.example', '18c3f0a1b2')).toBe('https://mail.google.com/mail/?authuser=work%40clickplumbing.example#all/18c3f0a1b2')
  })
})

describe('the words', () => {
  it('says a missing label in plain words', () => {
    expect(missingLabelWords('Follow Up', 'work@')).toBe('No label named Follow Up in work@ yet. Make it in Gmail, or pick another label.')
  })

  it('spells a day the way the station does', () => {
    expect(arrivedWords('2026-10-17T15:10:00Z')).toBe('Sat Oct 17')
    expect(arrivedWords('2026-10-23T03:00:00Z')).toBe('Thu Oct 22')
  })
})

describe('composeLookNote: the note the mark saves', () => {
  it('writes one line per box in the history’s shape, the moves since the last look, then the person’s word', () => {
    const inbox = labelFacts('Inbox', rows, { address: ADDRESS, limitDays: 3, nowIso: NOW, sinceIso: SINCE })
    const followUp = labelFacts('Follow Up', rows, { address: ADDRESS, limitDays: 3, nowIso: NOW, sinceIso: SINCE })
    const note = composeLookNote(
      [
        { words: 'bids@', labels: [inbox, { label: 'Next Actions', missing: true }] },
        { words: 'Marisol', labels: [followUp] },
      ],
      SINCE,
      '  Toll bill paid, waiting on the receipt. ',
    )
    expect(note.split('\n')).toEqual([
      'bids@ · Inbox 3, oldest 6d (Ridgeway Builders, Lot 7 — final waivers) · Next Actions (no such label)',
      'Marisol · Follow Up 1, oldest 12d (someone, Applicants)',
      '+1 new, 1 cleared, 3 still here since Oct 22',
      'Toll bill paid, waiting on the receipt.',
    ])
  })

  it('says clean for an empty label, names at most three stuck threads, and leaves the since line out with no last look', () => {
    const many: ThreadRow[] = ['a', 'b', 'c', 'd', 'e'].map((id, i) => row({ gmail_thread_id: id, arrived_at: `2026-10-1${i}T12:00:00Z`, from_name: `Sender ${id}`, subject: `Subject ${id}` }))
    const f = labelFacts('Inbox', many, { address: ADDRESS, limitDays: 3, nowIso: NOW, sinceIso: null })
    const empty = labelFacts('Follow Up', [], { address: ADDRESS, limitDays: 3, nowIso: NOW, sinceIso: null })
    expect(composeLookNote([{ words: 'work@', labels: [f, empty] }], null)).toBe(
      'work@ · Inbox 5, oldest 13d (Sender a, Subject a; Sender b, Subject b; Sender c, Subject c; +2 more) · Follow Up clean',
    )
  })

  it('never passes the mark’s cap', () => {
    const long = labelFacts('Inbox', [row({ gmail_thread_id: 'x', arrived_at: '2026-10-01T12:00:00Z', subject: 'y'.repeat(600) })], { address: ADDRESS, limitDays: 1, nowIso: NOW, sinceIso: null })
    const boxes = Array.from({ length: 30 }, () => ({ words: 'work@', labels: [long] }))
    expect(composeLookNote(boxes, null).length).toBe(10_000)
  })
})
