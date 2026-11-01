import { describe, expect, it } from 'vitest'
import type { NeedsReplyRow } from '../followUp/queue'
import type { FollowUpContact } from '../followUp/followUpRows'
import { plainWordsFailures } from '../plainWords'
import {
  answeredWithinHour,
  answers,
  estimateFunnel,
  fromLastWeek,
  linesForPill,
  longestWaitNow,
  stripTiles,
  stripWindows,
  STRIP_WORDS,
  textsNotDelivered,
  turns,
  waitsFromQueue,
  waitWords,
  type StripEstimate, type StripRating,
  type StripLine,
  type StripWait,
} from './weekStrip'

// Now: Wed Oct 21, 10:00 AM Chicago (CDT). This week is Oct 15 to Oct 21; last week Oct 8 to Oct 14.
const NOW = new Date('2026-10-21T15:00:00Z')
const at = (iso: string) => Date.parse(iso)
let n = 0
const line = (set: Partial<StripLine> & Pick<StripLine, 'direction' | 'atMs'>): StripLine => ({ id: `l${++n}`, contactId: 'c1', kind: 'customer', channel: 'text', who: set.direction === 'in' ? 'Dana' : 'Rosa', ...set })
const win = stripWindows(NOW)

describe('the last 7 days (punch list #140 PR 5)', () => {
  it('cuts the two weeks at the company day', () => {
    expect(new Date(win.thisWeek.fromMs).toISOString()).toBe('2026-10-15T05:00:00.000Z')
    expect(new Date(win.thisWeek.toMs).toISOString()).toBe('2026-10-22T05:00:00.000Z')
    expect(new Date(win.lastWeek.fromMs).toISOString()).toBe('2026-10-08T05:00:00.000Z')
    expect(win.lastWeek.toMs).toBe(win.thisWeek.fromMs)
  })

  it('a turn is one run of theirs, answered by the first real reply of ours', () => {
    const lines = [
      line({ direction: 'in', atMs: at('2026-10-20T14:00:00Z') }),
      line({ direction: 'in', atMs: at('2026-10-20T14:05:00Z') }), // the same wait, not a second
      line({ direction: 'in', atMs: at('2026-10-20T14:09:00Z') }),
      line({ direction: 'out', atMs: at('2026-10-20T14:10:00Z'), who: 'the app' }), // a reminder is not an answer
      line({ direction: 'out', atMs: at('2026-10-20T14:12:00Z'), channel: 'note' }), // the customer never sees a note
      line({ direction: 'out', atMs: at('2026-10-20T14:15:00Z'), delivery: 'failed' }), // they never read it
      line({ direction: 'out', atMs: at('2026-10-20T14:30:00Z'), delivery: 'delivered' }),
      line({ direction: 'in', atMs: at('2026-10-20T18:00:00Z') }), // after the answer: a new turn
      line({ direction: 'out', atMs: at('2026-10-20T19:30:00Z'), channel: 'call' }),
      line({ direction: 'in', atMs: at('2026-10-19T14:00:00Z'), contactId: 'c2', who: 'Kim' }), // never answered
    ]
    expect(turns(lines)).toEqual([
      { contactId: 'c2', inAtMs: at('2026-10-19T14:00:00Z'), outAtMs: null },
      { contactId: 'c1', inAtMs: at('2026-10-20T14:00:00Z'), outAtMs: at('2026-10-20T14:30:00Z') },
      { contactId: 'c1', inAtMs: at('2026-10-20T18:00:00Z'), outAtMs: at('2026-10-20T19:30:00Z') },
    ])
    expect(answers({ direction: 'out', channel: 'email', who: 'Rosa' })).toBe(true)
    expect(answers({ direction: 'out', channel: 'text', who: 'The app' })).toBe(false)
    expect(answers({ direction: 'in', channel: 'text', who: 'Dana' })).toBe(false)
  })

  it('counts the share answered within an hour, this week against last', () => {
    const ts = turns([
      line({ direction: 'in', atMs: at('2026-10-20T14:00:00Z') }),
      line({ direction: 'out', atMs: at('2026-10-20T14:30:00Z') }),
      line({ direction: 'in', atMs: at('2026-10-19T14:00:00Z'), contactId: 'c2' }),
      line({ direction: 'out', atMs: at('2026-10-19T16:00:00Z'), contactId: 'c2' }), // two hours: answered, not within the hour
      line({ direction: 'in', atMs: at('2026-10-10T14:00:00Z'), contactId: 'c3' }),
      line({ direction: 'out', atMs: at('2026-10-10T14:20:00Z'), contactId: 'c3' }),
    ])
    expect(answeredWithinHour(ts, win.thisWeek)).toEqual({ count: 1, of: 2, share: 0.5 })
    expect(answeredWithinHour(ts, win.lastWeek)).toEqual({ count: 1, of: 1, share: 1 })
    expect(answeredWithinHour([], win.thisWeek)).toEqual({ count: 0, of: 0, share: null })
    expect(fromLastWeek(0.5, 1)).toBe('↓ from 100% last week')
    expect(fromLastWeek(0.9, 0.71)).toBe('↑ from 71% last week')
    expect(fromLastWeek(0.5, 0.5)).toBe('same as last week')
    expect(fromLastWeek(0.5, null)).toBeNull()
  })

  it('names the longest wait right now, from the queue’s rows, with who has it', () => {
    const rows = [
      { contactId: 'c-dana', landOnId: 'm1', waitingSince: '2026-10-19T11:00:00Z', callBack: false, offers: [], acts: [] },
      { contactId: 'c-kim', landOnId: 'm2', waitingSince: '2026-10-21T14:25:00Z', callBack: false, offers: [], acts: [] },
      { contactId: 'c-unk', landOnId: null, waitingSince: null, callBack: false, offers: [], acts: [] },
    ] as NeedsReplyRow[]
    const contacts = [
      { id: 'c-dana', kind: 'customer', name: 'Dana Whitfield', state: 'waiting', hasUserId: 'u-rosa', hasSince: null, hasHow: null },
      { id: 'c-kim', kind: 'customer', name: '', company: 'Coe Builders', state: 'waiting', hasUserId: null, hasSince: null, hasHow: null },
    ] as unknown as FollowUpContact[]
    const waits = waitsFromQueue(rows, contacts, (id) => (id === 'u-rosa' ? 'Rosa' : null))
    expect(waits).toEqual([
      { contactId: 'c-dana', name: 'Dana Whitfield', has: 'Rosa', waitingSinceMs: at('2026-10-19T11:00:00Z'), landOnId: 'm1' },
      { contactId: 'c-kim', name: 'Coe Builders', has: null, waitingSinceMs: at('2026-10-21T14:25:00Z'), landOnId: 'm2' },
    ])
    expect(longestWaitNow(waits, NOW)).toEqual({ contactId: 'c-dana', name: 'Dana Whitfield', has: 'Rosa', words: '2 d 4 h', landOnId: 'm1' })
    expect(longestWaitNow([waits[1]!], NOW)?.words).toBe('35 min')
    expect(longestWaitNow([], NOW)).toBeNull()
    expect(waitWords(5 * 3_600_000)).toBe('5 h')
  })

  it('counts the texts Quo could not deliver this week, and the estimates’ funnel', () => {
    const lines = [
      line({ direction: 'out', atMs: at('2026-10-20T14:00:00Z'), delivery: 'failed' }),
      line({ direction: 'out', atMs: at('2026-10-18T14:00:00Z'), delivery: 'undelivered', contactId: 'c2' }),
      line({ direction: 'out', atMs: at('2026-10-19T14:00:00Z'), delivery: 'delivered' }),
      line({ direction: 'out', atMs: at('2026-10-19T14:00:00Z'), channel: 'email' }),
      line({ direction: 'out', atMs: at('2026-10-10T14:00:00Z'), delivery: 'failed' }), // last week
    ]
    expect(textsNotDelivered(lines, win.thisWeek)).toEqual({ count: 2, first: { contactId: 'c1' } })
    const estimates: StripEstimate[] = [
      { id: 'e1', number: 101, sentAtMs: at('2026-10-16T14:00:00Z'), opened: true, accepted: true },
      { id: 'e2', number: 102, sentAtMs: at('2026-10-18T14:00:00Z'), opened: true, accepted: false },
      { id: 'e3', number: 103, sentAtMs: at('2026-10-19T14:00:00Z'), opened: false, accepted: false },
      { id: 'e4', number: 104, sentAtMs: at('2026-10-05T14:00:00Z'), opened: true, accepted: false }, // before the week
      { id: 'e5', number: 105, sentAtMs: null, opened: false, accepted: false },
    ]
    expect(estimateFunnel(estimates, win.thisWeek)).toEqual({ sent: 3, opened: 2, accepted: 1, openedQuiet: 1 })
  })

  it('draws the five tiles with their doors, and none with nothing behind it', () => {
    const lines = [
      line({ direction: 'in', atMs: at('2026-10-20T14:00:00Z') }),
      line({ direction: 'out', atMs: at('2026-10-20T14:30:00Z') }),
      line({ direction: 'in', atMs: at('2026-10-19T14:00:00Z'), contactId: 'c2', kind: 'trade' }),
      line({ direction: 'out', atMs: at('2026-10-19T16:00:00Z'), contactId: 'c2', kind: 'trade', delivery: 'failed' }),
      line({ direction: 'in', atMs: at('2026-10-10T14:00:00Z'), contactId: 'c3' }),
      line({ direction: 'out', atMs: at('2026-10-10T14:20:00Z'), contactId: 'c3' }),
    ]
    const estimates: StripEstimate[] = [
      { id: 'e1', number: 101, sentAtMs: at('2026-10-16T14:00:00Z'), opened: true, accepted: false },
      { id: 'e2', number: 102, sentAtMs: at('2026-10-18T14:00:00Z'), opened: false, accepted: false },
    ]
    const waits: StripWait[] = [{ contactId: 'c-dana', name: 'Dana Whitfield', has: 'Rosa', waitingSinceMs: at('2026-10-19T11:00:00Z'), landOnId: 'm1' }]
    const ratings: StripRating[] = [
      { contactId: 'c1', askedAtMs: at('2026-10-17T14:00:00Z'), answeredAtMs: at('2026-10-17T15:00:00Z'), score: 5 },
      { contactId: 'c-dana', askedAtMs: at('2026-10-19T14:00:00Z'), answeredAtMs: at('2026-10-19T15:00:00Z'), score: 2 },
      { contactId: 'c2', askedAtMs: at('2026-10-20T14:00:00Z'), answeredAtMs: null, score: null },
      // Asked before the window: not this week's.
      { contactId: 'c3', askedAtMs: at('2026-10-10T14:00:00Z'), answeredAtMs: at('2026-10-20T14:00:00Z'), score: 4 },
    ]
    const tiles = stripTiles({ lines, estimates, ratings, waits, now: NOW, pill: 'all' })
    expect(tiles.map((t) => [t.key, t.value, t.sub, t.door])).toEqual([
      ['answered', '50%', '1 of 2 · ↓ from 100% last week', { kind: 'needs-reply' }],
      ['longest', '2 d 4 h', 'Dana Whitfield · Rosa has it', { kind: 'thread', contactId: 'c-dana', at: 'm1' }],
      ['notDelivered', '1', 'Call them, or send it as an email.', { kind: 'went-out' }],
      ['estimates', '2 sent · 1 opened · 0 accepted', '1 opened and quiet', { kind: 'waiting' }],
      ['ratings', '3 asked · 2 answered · 3.5 of 5', '1 answer of 2 or less', { kind: 'thread', contactId: 'c-dana', at: null }],
    ])
    // A pill narrows the lines; the estimates are customers', so they read none under Trade partners.
    expect(linesForPill(lines, 'trade').map((l) => l.contactId)).toEqual(['c2', 'c2'])
    const trade = stripTiles({ lines, estimates, ratings, waits: [], now: NOW, pill: 'trade' })
    expect(trade.map((t) => [t.key, t.value, t.door])).toEqual([
      ['answered', '0%', { kind: 'needs-reply' }],
      ['longest', 'none', null],
      ['notDelivered', '1', { kind: 'went-out' }],
      ['estimates', 'none', null],
      ['ratings', 'none', null],
    ])
    expect(stripTiles({ lines: [], estimates: [], waits: [], now: NOW, pill: 'all' }).map((t) => [t.value, t.sub, t.door])).toEqual([
      ['none', null, null],
      ['none', null, null],
      ['none', null, null],
      ['none', null, null],
      ['none', null, null],
    ])
  })

  it('reads in plain words', () => {
    const words = [STRIP_WORDS.title, STRIP_WORDS.note, STRIP_WORDS.problem, STRIP_WORDS.answered, STRIP_WORDS.longest, STRIP_WORDS.notDelivered, STRIP_WORDS.notDeliveredSub, STRIP_WORDS.ratings, STRIP_WORDS.ratingLow(1), STRIP_WORDS.ratingLow(2), STRIP_WORDS.officeWait, ...Object.values(STRIP_WORDS.tips)]
    for (const w of words) expect(plainWordsFailures(w), w).toEqual([])
  })
})
