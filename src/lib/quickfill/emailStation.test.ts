import { describe, expect, it } from 'vitest'
import type { WatchView } from '../emailIn/countCard'
import { agoWords, BY_HAND_NONE, BY_HAND_NOT_YET, BY_HAND_OFF, emailStation, type EmailStationInput, type StationThreadRow } from './emailStation'

// Fri Oct 23, 2026, 9:55 AM in Chicago; the last look was Thursday at 12:01 PM. Made-up boxes, people and mail.
const NOW = '2026-10-23T14:55:00.000Z'
const SINCE = '2026-10-22T17:01:00.000Z'
const MARISOL = 'u-marisol'
const DALE = 'u-dale'

const watch = (over: Partial<WatchView> & { id: string; address: string }): WatchView => ({
  user_id: null,
  labels: ['Inbox', 'Follow Up', 'Next Actions'],
  is_on: true,
  labels_state: null,
  last_ok_at: '2026-10-23T14:51:00Z',
  last_error: null,
  created_at: '2026-10-20T13:00:00Z',
  added_by: null,
  ...over,
})
const thread = (over: Partial<StationThreadRow> & { watch_id: string; gmail_thread_id: string; label_name: string }): StationThreadRow => ({
  arrived_at: null,
  last_at: null,
  from_name: null,
  from_address: null,
  subject: '',
  first_seen_at: '2026-10-20T12:00:00Z',
  gone_at: null,
  ...over,
})

const BIDS = watch({
  id: 'w-bids',
  address: 'bids@clickconstruction.example',
  labels: ['Inbox', 'Follow Up'],
  labels_state: { Inbox: { at: NOW, total: 2 }, 'Follow Up': { at: NOW, total: 0 } },
})
const WORK = watch({
  id: 'w-work',
  address: 'work@clickplumbing.example',
  created_at: '2026-10-20T14:00:00Z',
  labels_state: { Inbox: { at: NOW, total: 1 }, 'Follow Up': { at: NOW, missing: true }, 'Next Actions': { at: NOW, total: 0 } },
})
const MINE = watch({
  id: 'w-marisol',
  user_id: MARISOL,
  address: 'marisol@clickplumbing.example',
  labels_state: { Inbox: { at: NOW, total: 0 }, 'Follow Up': { at: NOW, total: 2 }, 'Next Actions': { at: NOW, total: 1 } },
})
const THREADS: StationThreadRow[] = [
  thread({ watch_id: 'w-bids', label_name: 'Inbox', gmail_thread_id: 'ridgeway', arrived_at: '2026-10-17T15:10:00Z', from_name: 'Ridgeway Builders', subject: 'Lot 7 — final waivers', first_seen_at: '2026-10-17T15:15:00Z' }),
  thread({ watch_id: 'w-bids', label_name: 'Inbox', gmail_thread_id: 'newer', arrived_at: '2026-10-22T20:00:00Z', from_name: 'Dana', subject: 'Question', first_seen_at: '2026-10-22T20:05:00Z' }),
  thread({ watch_id: 'w-work', label_name: 'Inbox', gmail_thread_id: 'cedar', arrived_at: '2026-10-19T15:00:00Z', from_name: 'Cedar Bend Partners', subject: 'Building C — plans to bid' }),
  thread({ watch_id: 'w-work', label_name: 'Inbox', gmail_thread_id: 'toll', arrived_at: '2026-10-19T12:00:00Z', subject: 'Toll bill', gone_at: '2026-10-23T14:50:00Z' }),
  thread({ watch_id: 'w-marisol', label_name: 'Follow Up', gmail_thread_id: 'harlan', arrived_at: '2026-10-14T15:00:00Z', from_name: 'Harlan Freight', subject: 'W-9 for the new account' }),
  thread({ watch_id: 'w-marisol', label_name: 'Follow Up', gmail_thread_id: 'fresh', arrived_at: '2026-10-22T15:00:00Z', subject: 'Fresh', first_seen_at: '2026-10-23T14:00:00Z' }),
  thread({ watch_id: 'w-marisol', label_name: 'Next Actions', gmail_thread_id: 'applicants', arrived_at: '2026-10-11T15:00:00Z', from_name: 'Applicants', subject: 'plumber helper — three to call back' }),
]
const NAMES = { [MARISOL]: 'Marisol', [DALE]: 'Dale' }
const input = (over: Partial<EmailStationInput> = {}): EmailStationInput => ({
  on: true,
  limitDays: 3,
  leadId: DALE,
  rows: [MINE, WORK, BIDS],
  threads: THREADS,
  names: NAMES,
  viewerId: MARISOL,
  nowIso: NOW,
  sinceIso: SINCE,
  ...over,
})

describe('emailStation: a person with labels', () => {
  const m = emailStation(input())

  it('reads live, the shared boxes first, then the viewer’s own, each with who sees it', () => {
    expect(m.mode).toBe('live')
    expect(m.boxes.map((b) => [b.title, b.who, b.readWords])).toEqual([
      ['bids@', 'for the office', 'read 4 min ago'],
      ['work@', 'for the office', 'read 4 min ago'],
      ['Your mail', 'shows to you and Dale', 'read 4 min ago'],
    ])
  })

  it('counts each label with Gmail’s own count and lists the threads past the limit, oldest first', () => {
    const bids = m.boxes[0]!
    const inbox = bids.labels[0]!
    expect(inbox.kind).toBe('facts')
    if (inbox.kind !== 'facts') return
    expect([inbox.shown, inbox.facts.oldestDays, inbox.facts.newer]).toEqual([2, 6, 1])
    expect(inbox.facts.past.map((t) => [t.days, t.arrivedWords, t.from, t.subject])).toEqual([[6, 'Sat Oct 17', 'Ridgeway Builders', 'Lot 7 — final waivers']])
    expect(inbox.href).toBe('https://mail.google.com/mail/?authuser=bids%40clickconstruction.example#inbox')
    expect(bids.labels[1]).toMatchObject({ kind: 'facts', label: 'Follow Up', shown: 0 })
    const mine = m.boxes[2]!
    expect(mine.labels.map((l) => (l.kind === 'facts' ? `${l.label} ${l.shown}/${l.facts.past.map((t) => t.days).join(',')}` : l.kind))).toEqual(['Inbox 0/', 'Follow Up 2/9', 'Next Actions 1/12'])
    expect([m.open, m.past]).toEqual([6, 4])
  })

  it('says what moved since the last look', () => {
    expect(m.since).toEqual({ newSince: 2, clearedSince: 1, stillSince: 4, words: 'Since the last look, Thu, Oct 22 at 12:01 PM' })
  })

  it('says what is counted and who sees it', () => {
    expect(m.stance).toEqual(['Counts bids@, work@ and your mail.', 'Senders, subjects and dates only, never the words.', 'Your rows show to you and Dale.', 'It changes nothing in Gmail.'])
  })

  it('writes the note the mark saves, with the person’s own word last', () => {
    const note = emailStation(input({ word: 'Harlan W-9 asked twice already.' })).note
    expect(note.split('\n')).toEqual([
      'bids@ · Inbox 2, oldest 6d (Ridgeway Builders, Lot 7 — final waivers) · Follow Up clean',
      'work@ · Inbox 1, oldest 4d (Cedar Bend Partners, Building C — plans to bid) · Follow Up (no such label) · Next Actions clean',
      'Marisol · Inbox clean · Follow Up 2, oldest 9d (Harlan Freight, W-9 for the new account) · Next Actions 1, oldest 12d (Applicants, plumber helper — three to call back)',
      '+2 new, 1 cleared, 4 still here since Oct 22',
      'Harlan W-9 asked twice already.',
    ])
  })
})

describe('emailStation: a label that does not exist', () => {
  it('says so in words with a door to Gmail’s labels, and still counts the others', () => {
    const work = emailStation(input()).boxes[1]!
    expect(work.labels[1]).toEqual({
      kind: 'missing',
      label: 'Follow Up',
      words: 'No label named Follow Up in work@ yet. Make it in Gmail, or pick another label.',
      href: 'https://mail.google.com/mail/?authuser=work%40clickplumbing.example#settings/labels',
    })
    expect(work.labels[0]).toMatchObject({ kind: 'facts', shown: 1 })
  })

  it('says a label not counted yet, and a label the count could not read', () => {
    const fresh = watch({ id: 'w-new', address: 'new@clickplumbing.example', labels_state: { Inbox: { at: NOW, error: 'Gmail 429' } } })
    const b = emailStation(input({ rows: [fresh] })).boxes[0]!
    expect(b.labels.map((l) => l.kind)).toEqual(['error', 'waiting', 'waiting'])
    expect(b.labels[0]).toMatchObject({ words: 'Inbox was not counted: Gmail 429' })
  })
})

describe('emailStation: one with none', () => {
  it('a viewer with no box of their own sees the shared boxes alone, never a person’s', () => {
    const m = emailStation(input({ viewerId: 'u-bea' }))
    expect(m.boxes.map((b) => b.title)).toEqual(['bids@', 'work@'])
    expect(m.stance).toEqual(['Counts bids@ and work@.', 'Senders, subjects and dates only, never the words.', 'It changes nothing in Gmail.'])
  })

  it('the lead sees each person’s rows, with no door into another’s Gmail', () => {
    const m = emailStation(input({ viewerId: DALE }))
    const marisol = m.boxes[2]!
    expect([marisol.title, marisol.who, marisol.canOpen]).toEqual(["Marisol's mail", 'shows to Marisol and you', false])
    const follow = marisol.labels[1]!
    expect(follow.kind === 'facts' && [follow.href, follow.facts.past[0]!.href]).toEqual([null, ''])
    expect(m.stance).toContain('As the lead, you see each person’s rows. Nobody else on the station does.')
  })

  it('a person whose own box is switched off sees it no more', () => {
    expect(emailStation(input({ rows: [{ ...MINE, is_on: false }, BIDS] })).boxes.map((b) => b.title)).toEqual(['bids@'])
  })
})

describe('emailStation: by hand until the app counts', () => {
  it('stays by hand while the switch is off, with no box, or before the first count', () => {
    expect(emailStation(input({ on: false }))).toMatchObject({ mode: 'byHand', byHandWhy: BY_HAND_OFF, note: '' })
    expect(emailStation(input({ rows: [] }))).toMatchObject({ mode: 'byHand', byHandWhy: BY_HAND_NONE })
    expect(emailStation(input({ rows: [{ ...BIDS, last_ok_at: null }] }))).toMatchObject({ mode: 'byHand', byHandWhy: BY_HAND_NOT_YET })
  })
})

describe('agoWords', () => {
  it('reads minutes, hours, then the day', () => {
    expect(agoWords('2026-10-23T14:54:40Z', NOW)).toBe('just now')
    expect(agoWords('2026-10-23T14:51:00Z', NOW)).toBe('4 min ago')
    expect(agoWords('2026-10-23T11:00:00Z', NOW)).toBe('3 h ago')
    expect(agoWords('2026-10-22T13:00:00Z', NOW)).toBe('Thu, Oct 22')
  })
})
