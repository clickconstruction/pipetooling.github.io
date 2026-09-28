import { describe, expect, it } from 'vitest'
import type { GcReviewGroup } from '../gcReviewRollup'
import type { GcReviewCertRow } from './gcReviewCertification'
import type { RoundMarkRow } from './gcStatementRounds'
import { APP_SEND_NOTE, buildGcWorklist, markCarriesWord, mergeRoundMarkWrite, worklistCards, worklistGroupTitle, worklistNextStep } from './gcWorklist'

const WEEK = '2026-09-21'

const group = (gcId: string | null, subtotal: number, over?: Partial<GcReviewGroup>): GcReviewGroup => ({
  key: gcId ?? 'no-gc',
  gcId,
  gcName: gcId ? `GC ${gcId}` : 'Not billed to a GC',
  isNoGc: gcId == null,
  rows: [],
  subtotal,
  jobCount: 2,
  oldestAgeDays: 30,
  ...over,
})

const cert = (gcId: string, total: number): GcReviewCertRow => ({
  week_start: WEEK,
  gc_customer_id: gcId,
  certified_by_name: 'Taunya',
  certified_at: '2026-09-23T15:00:00Z',
  job_count: 2,
  total,
  snapshot: null,
  note: '',
})

const mark = (gc: string, action: RoundMarkRow['action'], over?: Partial<RoundMarkRow>): RoundMarkRow => ({
  gc_customer_id: gc,
  week_start: WEEK,
  action,
  acted_by: 'u-taunya',
  acted_by_name: 'Taunya',
  acted_at: '2026-09-24T15:00:00Z',
  channel: action === 'skipped' ? null : 'email',
  note: null,
  temperature: null,
  expected_pay_by: null,
  ...over,
})

const build = (over: Partial<Parameters<typeof buildGcWorklist>[0]> = {}) =>
  buildGcWorklist({
    groups: [],
    certsByGc: new Map(),
    marks: [],
    senders: new Map(),
    accountMen: new Map(),
    lastSentByGcId: {},
    weekStartYmd: WEEK,
    ...over,
  })

describe('worklistNextStep', () => {
  const row = { checked: 'done' as const, sent: false, word: false, skipped: false, overLine: true }

  it('walks check, then send, then the word', () => {
    expect(worklistNextStep({ ...row, checked: 'todo' })).toBe('check')
    expect(worklistNextStep({ ...row, checked: 'changed' })).toBe('check')
    expect(worklistNextStep(row)).toBe('send')
    expect(worklistNextStep({ ...row, sent: true })).toBe('word')
    expect(worklistNextStep({ ...row, sent: true, word: true })).toBeNull()
  })

  it('a word taken early does not skip the statement', () => {
    expect(worklistNextStep({ ...row, word: true })).toBe('send')
  })

  it('under the line the row is done once its statement is out', () => {
    expect(worklistNextStep({ ...row, overLine: false, sent: true })).toBeNull()
  })

  it('a skipped GC asks for nothing this week', () => {
    expect(worklistNextStep({ ...row, skipped: true })).toBeNull()
  })
})

describe('buildGcWorklist', () => {
  it('lists every real GC with a balance — nobody is left to someone else', () => {
    const w = build({
      groups: [group('a', 46000), group('b', 9999), group(null, 65000), group('c', 0)],
      senders: new Map([['a', 'u-malachi']]),
    })
    expect(w.groups.flatMap((g) => g.rows.map((r) => r.gcId))).toEqual(['a', 'b'])
    expect(w.counts.gcs).toBe(2)
  })

  it('groups by the account man, the unassigned next, the GCs under the line last', () => {
    const w = build({
      groups: [group('a', 46000), group('b', 20000), group('c', 30000), group('d', 12000), group('e', 5000)],
      senders: new Map([
        ['a', 'u-malachi'],
        ['b', 'u-malachi'],
      ]),
      accountMen: new Map([
        ['b', 'u-someone-else'],
        ['c', 'u-trace'],
      ]),
    })
    expect(w.groups.map((g) => [g.key, g.kind, g.rows.map((r) => r.gcId), g.total])).toEqual([
      ['owner:u-malachi', 'owner', ['a', 'b'], 66000],
      ['owner:u-trace', 'owner', ['c'], 30000],
      ['unassigned', 'unassigned', ['d'], 12000],
      ['under_line', 'under_line', ['e'], 5000],
    ])
  })

  it('reads the three steps from the certification, the sends and the mark', () => {
    const w = build({
      groups: [group('checked', 40000), group('changed', 30000), group('sent', 20000), group('word', 15000)],
      certsByGc: new Map([
        ['checked', cert('checked', 40000)],
        ['changed', cert('changed', 28000)],
        ['sent', cert('sent', 20000)],
        ['word', cert('word', 15000)],
      ]),
      marks: [mark('sent', 'sent'), mark('word', 'contacted', { temperature: 'warm', note: 'Check run is the 10th.' })],
    })
    const by = Object.fromEntries(w.groups.flatMap((g) => g.rows).map((r) => [r.gcId, [r.checked, r.sent, r.word, r.next]]))
    expect(by).toEqual({
      checked: ['done', false, false, 'send'],
      changed: ['changed', false, false, 'check'],
      sent: ['done', true, false, 'word'],
      word: ['done', false, true, 'send'],
    })
    expect(w.counts).toEqual({ gcs: 4, checked: 3, sent: 1, words: 1, done: 0, late: 0 })
  })

  it('counts an app send this week as sent, and last week’s as not', () => {
    const w = build({
      groups: [group('a', 40000), group('b', 40000)],
      lastSentByGcId: { a: '2026-09-23T15:00:00Z', b: '2026-09-18T15:00:00Z' },
    })
    const rows = w.groups.flatMap((g) => g.rows)
    expect(rows.find((r) => r.gcId === 'a')?.sent).toBe(true)
    expect(rows.find((r) => r.gcId === 'b')?.sent).toBe(false)
  })

  it('puts the rows with work left first, largest first', () => {
    const w = build({
      groups: [group('small', 12000), group('big', 90000), group('done', 95000)],
      certsByGc: new Map([['done', cert('done', 95000)]]),
      marks: [mark('done', 'sent', { temperature: 'hot' })],
    })
    expect(w.groups[0]?.rows.map((r) => r.gcId)).toEqual(['big', 'small', 'done'])
    expect(w.groups[0]?.open).toBe(2)
    expect(w.counts.done).toBe(1)
  })

  it('puts a broken promise first and counts it', () => {
    const w = build({
      groups: [group('big', 90000), group('late', 12000), group('ahead', 50000)],
      expectedPayByByGc: new Map([
        ['late', '2026-09-20'],
        ['ahead', '2026-10-10'],
      ]),
      todayYmd: '2026-09-27',
    })
    const rows = w.groups[0]!.rows
    expect(rows.map((r) => r.gcId)).toEqual(['late', 'big', 'ahead'])
    expect(rows[0]?.promise).toEqual({ payBy: '2026-09-20', late: true, daysLate: 7 })
    expect(rows[2]?.promise?.late).toBe(false)
    expect(rows[1]?.promise).toBeNull()
    expect([w.groups[0]?.late, w.counts.late]).toEqual([1, 1])
  })

  it('a skipped GC is neither done nor to do', () => {
    const w = build({ groups: [group('a', 40000)], marks: [mark('a', 'skipped')] })
    const row = w.groups[0]!.rows[0]!
    expect([row.skipped, row.next]).toEqual([true, null])
    expect(w.counts.done).toBe(0)
  })
})

describe('worklistCards', () => {
  it('counts every GC over the line, whoever its account man is', () => {
    const w = build({
      groups: [group('his', 40000), group('hers', 30000), group('nobody', 20000), group('unchecked', 15000), group('sent', 12000), group('small', 5000), group('skipped', 11000)],
      certsByGc: new Map([
        ['his', cert('his', 40000)],
        ['hers', cert('hers', 30000)],
        ['nobody', cert('nobody', 20000)],
        ['sent', cert('sent', 12000)],
        ['small', cert('small', 5000)],
      ]),
      senders: new Map([
        ['his', 'u-malachi'],
        ['hers', 'u-taunya'],
      ]),
      marks: [mark('sent', 'sent'), mark('skipped', 'skipped')],
      expectedPayByByGc: new Map([['his', '2026-09-20']]),
      todayYmd: '2026-09-27',
    })
    expect(worklistCards(w)).toEqual({ held: { count: 1, total: 15000 }, ready: { count: 3, total: 90000, late: 1 } })
  })

  it('a word taken early still leaves the statement to send', () => {
    const w = build({ groups: [group('a', 40000)], certsByGc: new Map([['a', cert('a', 40000)]]), marks: [mark('a', 'contacted', { temperature: 'warm', note: 'Fine, no date.' })] })
    expect(worklistCards(w).ready).toEqual({ count: 1, total: 40000, late: 0 })
  })
})

describe('worklistGroupTitle', () => {
  it('names who to ask', () => {
    expect(worklistGroupTitle({ kind: 'owner' }, 'Malachi', false)).toBe('Account Man Malachi')
    expect(worklistGroupTitle({ kind: 'owner' }, 'Taunya', true)).toBe('Account Man Taunya (you)')
    expect(worklistGroupTitle({ kind: 'unassigned' }, 'nobody assigned', false)).toBe('No account man yet')
    expect(worklistGroupTitle({ kind: 'under_line' }, '', false)).toBe('Under $10,000')
  })
})

describe('markCarriesWord', () => {
  it('is a spoke-with-them mark, or any mark with a temperature', () => {
    expect(markCarriesWord(null)).toBe(false)
    expect(markCarriesWord(mark('a', 'sent'))).toBe(false)
    expect(markCarriesWord(mark('a', 'sent', { temperature: 'cool' }))).toBe(true)
    expect(markCarriesWord(mark('a', 'contacted'))).toBe(true)
    expect(markCarriesWord(mark('a', 'skipped'))).toBe(false)
  })
})

const NOW = '2026-09-25T18:00:00.000Z'
const NO_WORD = { word_from_user_id: null, word_from_name: null, word_heard_via: null, word_entered_by: null, word_entered_by_name: null, word_at: null }
const FROM_MALACHI = { fromUserId: 'u-malachi', fromName: 'Malachi', heardVia: 'call' as const, enteredBy: 'u-taunya', enteredByName: 'Taunya' }

describe('mergeRoundMarkWrite', () => {
  it('writes a first mark as given', () => {
    expect(mergeRoundMarkWrite(null, { action: 'sent', channel: 'text', note: ' Texted Dave ' }, NOW)).toEqual({
      action: 'sent',
      channel: 'text',
      note: 'Texted Dave',
      temperature: null,
      expected_pay_by: null,
      acted_at: null,
      ...NO_WORD,
    })
  })

  it('a word keeps whose it is, how it was heard, who typed it and when', () => {
    const out = mergeRoundMarkWrite(null, { action: 'contacted', channel: 'call', note: 'Warm — check run is the 10th.', temperature: 'warm', word: FROM_MALACHI }, NOW)
    expect(out).toMatchObject({
      action: 'contacted',
      word_from_user_id: 'u-malachi',
      word_from_name: 'Malachi',
      word_heard_via: 'call',
      word_entered_by: 'u-taunya',
      word_entered_by_name: 'Taunya',
      word_at: NOW,
    })
  })

  it('a plain send names no source, even when the form offered one', () => {
    expect(mergeRoundMarkWrite(null, { action: 'sent', channel: 'email', word: FROM_MALACHI }, NOW)).toMatchObject(NO_WORD)
  })

  it('a send after the word keeps the word’s source and its own day', () => {
    const word = mark('a', 'contacted', { note: 'Cool.', temperature: 'cool', acted_at: '2026-09-22T15:00:00Z', word_from_user_id: 'u-malachi', word_from_name: 'Malachi', word_heard_via: 'call', word_entered_by: 'u-taunya', word_entered_by_name: 'Taunya', word_at: '2026-09-22T15:00:00Z' })
    expect(mergeRoundMarkWrite(word, { action: 'sent', channel: 'email', note: APP_SEND_NOTE, word: { ...FROM_MALACHI, fromUserId: 'u-taunya', fromName: 'Taunya' } }, NOW)).toMatchObject({
      action: 'sent',
      temperature: 'cool',
      word_from_user_id: 'u-malachi',
      word_from_name: 'Malachi',
      word_heard_via: 'call',
      word_at: '2026-09-22T15:00:00Z',
    })
  })

  it('a word from before the columns stays its marker’s when a send keeps it', () => {
    const old = mark('a', 'contacted', { note: 'Warm.', temperature: 'warm', acted_by: 'u-malachi', acted_by_name: 'Malachi', acted_at: '2026-09-22T15:00:00Z' })
    expect(mergeRoundMarkWrite(old, { action: 'sent', channel: 'email' }, NOW)).toMatchObject({
      word_from_user_id: 'u-malachi',
      word_from_name: 'Malachi',
      word_entered_by: 'u-malachi',
      word_at: '2026-09-22T15:00:00Z',
    })
  })

  it('a word written after the statement keeps it sent, on the day it went out', () => {
    const sent = mark('a', 'sent', { channel: 'email', note: APP_SEND_NOTE, acted_at: '2026-09-23T15:00:00Z' })
    expect(mergeRoundMarkWrite(sent, { action: 'contacted', channel: 'call', note: 'Warm — check run is the 10th.', temperature: 'warm', expectedPayBy: '2026-10-10', word: FROM_MALACHI }, NOW)).toEqual({
      action: 'sent',
      channel: 'email',
      note: 'Warm — check run is the 10th.',
      temperature: 'warm',
      expected_pay_by: '2026-10-10',
      acted_at: '2026-09-23T15:00:00Z',
      word_from_user_id: 'u-malachi',
      word_from_name: 'Malachi',
      word_heard_via: 'call',
      word_entered_by: 'u-taunya',
      word_entered_by_name: 'Taunya',
      word_at: NOW,
    })
  })

  it('a statement sent after the word keeps the read, its sentence and the pay date', () => {
    const word = mark('a', 'contacted', { channel: 'call', note: 'Cool — dodging the date.', temperature: 'cool', expected_pay_by: '2026-10-02' })
    expect(mergeRoundMarkWrite(word, { action: 'sent', channel: 'email', note: APP_SEND_NOTE }, NOW)).toMatchObject({
      action: 'sent',
      channel: 'email',
      note: 'Cool — dodging the date.',
      temperature: 'cool',
      expected_pay_by: '2026-10-02',
      acted_at: null,
    })
  })

  it('keeps both notes when both say something, the word first', () => {
    const word = mark('a', 'contacted', { note: 'Warm, no date.', temperature: 'warm' })
    expect(mergeRoundMarkWrite(word, { action: 'sent', channel: 'text', note: 'Texted the statement to Dave.' }).note).toBe('Warm, no date.\nTexted the statement to Dave.')
    const sent = mark('a', 'sent', { note: 'Walked it over.' })
    expect(mergeRoundMarkWrite(sent, { action: 'contacted', note: 'Hot — paying Friday.', temperature: 'hot' }).note).toBe('Hot — paying Friday.\nWalked it over.')
  })

  it('a send that carries its own read replaces the old one', () => {
    const word = mark('a', 'contacted', { note: 'Cool.', temperature: 'cool' })
    const out = mergeRoundMarkWrite(word, { action: 'sent', channel: 'call', note: 'Hot now — check is cut.', temperature: 'hot' })
    expect([out.temperature, out.note]).toEqual(['hot', 'Hot now — check is cut.'])
  })

  it('a skip clears the mark, and a mark over a skip starts clean', () => {
    const word = mark('a', 'contacted', { note: 'Warm.', temperature: 'warm' })
    expect(mergeRoundMarkWrite(word, { action: 'skipped' })).toEqual({ action: 'skipped', channel: null, note: null, temperature: null, expected_pay_by: null, acted_at: null, ...NO_WORD })
    expect(mergeRoundMarkWrite(mark('a', 'skipped'), { action: 'sent', channel: 'email' }).action).toBe('sent')
  })
})
