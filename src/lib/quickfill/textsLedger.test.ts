import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import type { NeedsReplyRow } from '../followUp/queue'
import type { WentOutLine } from '../messages/wentOut'
import { cleanDayWords, ledgerMarkNote, ledgerName, textsLedger, textsMarkNoteFor, TEXTS_LEDGER_WORDS, wentOutSummary, type LedgerContact, type LedgerLine, type TextsLedgerInput } from './textsLedger'

// Fri Oct 24, 2026 in Chicago (CDT, UTC-5). Now is 9:52 AM.
const TODAY = '2026-10-24'
const NOW = Date.parse('2026-10-24T14:52:00Z')
const at = (iso: string) => Date.parse(iso)

const contacts: LedgerContact[] = [
  { id: 'marcus', name: 'Marcus Calloway', kind: 'sub', phone: '(512) 555-0142' },
  { id: 'dana', name: 'Dana Whitfield', kind: 'customer', phone: null },
  { id: 'tom', name: 'Tom Reyes', kind: 'customer' },
  { id: 'lena', name: 'Lena Ortiz', kind: 'customer' },
  { id: 'priya', name: 'Priya Natarajan', kind: 'customer' },
  { id: 'alvarez', name: '', kind: 'trade', company: 'Alvarez Mechanical' },
  { id: 'hill', name: 'Hill Country Electric', kind: 'trade' },
  { id: 'glenn', name: 'Glenn Geling', kind: 'customer' },
  { id: 'unknown1', name: '', kind: 'unknown' },
  { id: 'unknown2', name: '', kind: 'unknown' },
]

const lines = new Map<string, LedgerLine>(
  (
    [
      { id: 'l-marcus', contactId: 'marcus', channel: 'text', direction: 'in', body: 'Running late, there by 9:30.\nIs the water still off?', at: '2026-10-24T11:55:00Z' },
      { id: 'l-dana', contactId: 'dana', channel: 'text', direction: 'in', body: 'Can the tech come after 2 instead of 11?', at: '2026-10-24T13:12:00Z' },
      { id: 'l-glenn', contactId: 'glenn', channel: 'email', direction: 'in', body: 'Invitation to bid', at: '2026-10-23T15:00:00Z' },
      { id: 'l-lena', contactId: 'lena', channel: 'missed', direction: 'in', body: 'rang the company number', at: '2026-10-24T13:30:00Z' },
      { id: 'l-unknown1', contactId: 'unknown1', channel: 'text', direction: 'in', body: 'Hi, do you do water heaters?', at: '2026-10-24T13:40:00Z' },
      { id: 'l-unknown1-old', contactId: 'unknown1', channel: 'email', direction: 'in', body: 'older', at: '2026-10-20T13:40:00Z' },
      { id: 'l-unknown2', contactId: 'unknown2', channel: 'email', direction: 'in', body: 'A newsletter', at: '2026-10-24T13:45:00Z' },
    ] as LedgerLine[]
  ).map((l) => [l.id, l]),
)

const reply = (contactId: string, landOnId: string, waitingSince: string): NeedsReplyRow => ({ contactId, landOnId, waitingSince, callBack: false, offers: [], acts: ['Reply'] })
const needsReply: NeedsReplyRow[] = [reply('marcus', 'l-marcus', '2026-10-24T11:55:00Z'), reply('dana', 'l-dana', '2026-10-24T13:12:00Z'), reply('glenn', 'l-glenn', '2026-10-23T15:00:00Z'), reply('lena', 'l-lena', '2026-10-24T13:30:00Z')]

const sent = (set: Partial<WentOutLine> & { id: string; contactId: string; name: string | null; atMs: number }): WentOutLine => ({ kind: 'customer', body: 'Hello', who: 'Taunya', delivery: 'delivered', number: '(830) 555-0121', ...set })
const wentOut: WentOutLine[] = [
  sent({ id: 's-hill', contactId: 'hill', name: 'Hill Country Electric', kind: 'trade', body: 'Rosa, the inspector comes at 1.', atMs: at('2026-10-24T14:40:00Z'), delivery: null }),
  sent({ id: 's-marcus', contactId: 'marcus', name: 'Marcus Calloway', kind: 'sub', body: 'No problem, see you at 9:30.', atMs: at('2026-10-24T14:12:00Z') }),
  sent({ id: 's-dana', contactId: 'dana', name: 'Dana Whitfield', body: 'Dana, a reminder from Click Plumbing.', atMs: at('2026-10-24T14:00:00Z'), who: 'the app' }),
  sent({ id: 's-alvarez', contactId: 'alvarez', name: 'Alvarez Mechanical', kind: 'trade', body: 'Pay app 3 is approved.', atMs: at('2026-10-24T13:30:00Z'), who: 'Wendi' }),
  sent({ id: 's-priya', contactId: 'priya', name: 'Priya Natarajan', body: 'Priya, your estimate #1320 is ready.', atMs: at('2026-10-24T13:05:00Z') }),
  sent({ id: 's-lena', contactId: 'lena', name: 'Lena Ortiz', body: 'Lena, this is Luis. On my way.', atMs: at('2026-10-24T12:41:00Z'), who: 'Luis' }),
  // An email today is not a text.
  sent({ id: 'e-dana', contactId: 'dana', name: 'Dana Whitfield', channel: 'email', subject: 'Estimate #1298', body: '', atMs: at('2026-10-24T14:20:00Z'), delivery: null }),
  // Yesterday's failed text is Not delivered; the one three days ago is too old.
  sent({ id: 's-tom', contactId: 'tom', name: 'Tom Reyes', body: 'Tom, your estimate #1312 is ready.', atMs: at('2026-10-23T21:10:00Z'), delivery: 'undelivered' }),
  sent({ id: 's-old', contactId: 'priya', name: 'Priya Natarajan', body: 'An older text.', atMs: at('2026-10-21T15:00:00Z'), delivery: 'failed' }),
]

const input: TextsLedgerInput = { needsReply, newLane: [{ contactId: 'unknown1' }, { contactId: 'unknown2' }], lines, contacts, wentOut, todayYmd: TODAY, nowMs: NOW }

describe('textsLedger (v2.5816, punch list #157)', () => {
  it('Needs a reply holds the texts alone, in the queue’s order, each with its words, its wait, its number and its door', () => {
    const l = textsLedger(input)
    expect(l.needsReply.map((r) => r.name)).toEqual(['Marcus Calloway', 'Dana Whitfield'])
    expect(l.needsReply[0]).toEqual({
      contactId: 'marcus',
      landOnId: 'l-marcus',
      name: 'Marcus Calloway',
      initials: 'MC',
      kind: 'sub',
      words: 'Running late, there by 9:30.',
      when: '6:55 AM',
      waiting: 'waiting 2 h',
      atMs: at('2026-10-24T11:55:00Z'),
      phone: '(512) 555-0142',
      href: '/messages?thread=marcus&at=l-marcus',
    })
    expect(l.needsReply[1]?.waiting).toBe('waiting 1 h')
    expect(l.needsReply[1]?.phone).toBeNull()
  })
  it('Not delivered is our texts from today and yesterday that Quo could not put on a phone, with the call and the door', () => {
    const l = textsLedger(input)
    expect(l.notDelivered.map((r) => [r.name, r.mark?.words, r.tel, r.number, r.href])).toEqual([['Tom Reyes', '⚠ not delivered', 'tel:+18305550121', '(830) 555-0121', '/messages?thread=tom&at=s-tom']])
  })
  it('Went out today is the receipt: every text sent today, newest first, with Quo’s answers counted', () => {
    const l = textsLedger(input)
    expect(l.wentOutToday.rows.map((r) => r.name)).toEqual(['Hill Country Electric', 'Marcus Calloway', 'Dana Whitfield', 'Alvarez Mechanical', 'Priya Natarajan', 'Lena Ortiz'])
    expect(l.wentOutToday.rows[0]?.mark).toBeNull()
    expect(l.wentOutToday.rows[2]?.when).toBe('9:00 AM · the app')
    expect([l.wentOutToday.delivered, l.wentOutToday.waiting, l.wentOutToday.bad]).toEqual([5, 1, 0])
    expect(wentOutSummary(l.wentOutToday)).toBe('5 ✓ delivered · 1 waiting on Quo')
  })
  it('the count is the work: texts needing a reply plus texts not delivered; the receipt and New are not counted', () => {
    const l = textsLedger(input)
    expect(l.count).toBe(3)
    expect(l.newTexts).toBe(1)
  })
  it('the Mark’s note names who was still waiting, then the receipt, then the words typed on their own line', () => {
    const l = textsLedger(input)
    expect(ledgerMarkNote(l)).toBe('2 need a reply · Marcus Calloway 2 h, Dana Whitfield 1 h · 1 not delivered · Tom Reyes · 6 went out, 5 delivered, 1 waiting on Quo')
    expect(ledgerMarkNote(l, '  Owe Pete the sheet from my phone  ')).toBe('2 need a reply · Marcus Calloway 2 h, Dana Whitfield 1 h · 1 not delivered · Tom Reyes · 6 went out, 5 delivered, 1 waiting on Quo\nOwe Pete the sheet from my phone')
    const one = textsLedger({ ...input, needsReply: [needsReply[1]!], wentOut: wentOut.filter((w) => w.id !== 's-tom') })
    expect(ledgerMarkNote(one)).toBe('1 needs a reply · Dana Whitfield 1 h · 6 went out, 5 delivered, 1 waiting on Quo')
  })
  it('a clean day: nothing waiting, one line, and the note says so', () => {
    const clean = textsLedger({ ...input, needsReply: [], newLane: [], wentOut: wentOut.filter((w) => w.id !== 's-tom' && w.id !== 's-hill') })
    expect(clean.count).toBe(0)
    expect(cleanDayWords(clean)).toEqual({ head: 'Nothing on texts is waiting on us.', sub: '5 went out today, all delivered.' })
    expect(ledgerMarkNote(clean)).toBe('nothing waiting · 5 went out, all delivered')
    const quiet = textsLedger({ ...input, needsReply: [], newLane: [], wentOut: [] })
    expect(cleanDayWords(quiet).sub).toBe('Nothing went out today.')
    expect(ledgerMarkNote(quiet)).toBe('nothing waiting · nothing went out')
    expect(wentOutSummary(quiet.wentOutToday)).toBe('')
  })
  it('a failed text of today sits in both Not delivered and the receipt, and the summary says so', () => {
    const l = textsLedger({ ...input, wentOut: [...wentOut, sent({ id: 's-bad', contactId: 'priya', name: 'Priya Natarajan', body: 'Again.', atMs: at('2026-10-24T14:45:00Z'), delivery: 'failed' })] })
    expect(l.notDelivered.map((r) => r.name)).toEqual(['Priya Natarajan', 'Tom Reyes'])
    expect(wentOutSummary(l.wentOutToday)).toBe('5 ✓ delivered · 1 waiting on Quo · 1 not delivered')
    expect(ledgerMarkNote(l)).toContain('7 went out, 5 delivered, 1 waiting on Quo, 1 not delivered')
  })
  it('every Mark of the station writes one note: the rows with the typed words, why there is no record, the words alone, or none', () => {
    const l = textsLedger(input)
    expect(textsMarkNoteFor({ ledger: l, typed: '  from my phone ', problem: false })).toBe(`${ledgerMarkNote(l)}\nfrom my phone`)
    expect(textsMarkNoteFor({ ledger: l, typed: '', problem: false })).toBe(ledgerMarkNote(l))
    expect(textsMarkNoteFor({ ledger: null, typed: '', problem: true })).toBe('the texts could not be read')
    expect(textsMarkNoteFor({ ledger: null, typed: 'owe Pete', problem: true })).toBe('the texts could not be read\nowe Pete')
    expect(textsMarkNoteFor({ ledger: null, typed: ' all caught up ', problem: false })).toBe('all caught up')
    expect(textsMarkNoteFor({ ledger: null, typed: '  ', problem: false })).toBeNull()
  })
  it('names a person, a company, or a number nobody has named', () => {
    expect(ledgerName({ name: 'Dana Whitfield' })).toBe('Dana Whitfield')
    expect(ledgerName({ name: ' ', company: 'Alvarez Mechanical' })).toBe('Alvarez Mechanical')
    expect(ledgerName({ name: '' })).toBe('A number nobody has named')
    expect(ledgerName(undefined)).toBe('A number nobody has named')
  })
  it('the words a first-timer reads are plain', () => {
    const sentences = [TEXTS_LEDGER_WORDS.banner, TEXTS_LEDGER_WORDS.needsReplyNote, TEXTS_LEDGER_WORDS.notDeliveredNote, TEXTS_LEDGER_WORDS.cleanHead, TEXTS_LEDGER_WORDS.elseHint, TEXTS_LEDGER_WORDS.problem, TEXTS_LEDGER_WORDS.notOffice, TEXTS_LEDGER_WORDS.todaysSends(2), TEXTS_LEDGER_WORDS.todaysSends(1), TEXTS_LEDGER_WORDS.newTexts(1), TEXTS_LEDGER_WORDS.newTexts(3)]
    for (const s of sentences) expect(plainWordsFailures(s), s).toEqual([])
  })
})
