import { describe, expect, it } from 'vitest'
import type { GcReviewGroup } from '../gcReviewRollup'
import type { GcReviewCertRow } from './gcReviewCertification'
import type { RoundMarkRow } from './gcStatementRounds'
import { buildGcWorklist } from './gcWorklist'
import { buildGcStageTrack, gcRowStage, gcStageStopLabel, gcWorklistAtStage } from './gcReviewStages'

const WEEK = '2026-09-21'

const group = (gcId: string, subtotal: number): GcReviewGroup => ({ key: gcId, gcId, gcName: `GC ${gcId}`, isNoGc: false, rows: [], subtotal, jobCount: 2, oldestAgeDays: 30 })
const cert = (gcId: string, total: number): GcReviewCertRow => ({ week_start: WEEK, gc_customer_id: gcId, certified_by_name: 'Taunya', certified_at: '2026-09-23T15:00:00Z', job_count: 2, total, snapshot: null, note: '' })
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

/**
 * Six GCs, one at every place a GC can be:
 *   a — unchecked                      → check
 *   b — checked                        → send
 *   c — checked, sent, no word         → word
 *   d — checked, sent, word in         → done
 *   e — under the line, checked        → send (owes no word)
 *   f — under the line, checked, sent  → done
 */
const week = (over: Partial<Parameters<typeof buildGcWorklist>[0]> = {}) =>
  buildGcWorklist({
    groups: [group('a', 30000), group('b', 98000), group('c', 21000), group('d', 22000), group('e', 8000), group('f', 4000)],
    certsByGc: new Map([
      ['b', cert('b', 98000)],
      ['c', cert('c', 21000)],
      ['d', cert('d', 22000)],
      ['e', cert('e', 8000)],
      ['f', cert('f', 4000)],
    ]),
    marks: [mark('c', 'sent'), mark('d', 'sent', { temperature: 'warm' }), mark('f', 'sent')],
    senders: new Map([
      ['a', 'u-malachi'],
      ['b', 'u-malachi'],
      ['c', 'u-malachi'],
      ['d', 'u-taunya'],
    ]),
    accountMen: new Map(),
    lastSentByGcId: {},
    weekStartYmd: WEEK,
    ...over,
  })

describe('gcRowStage', () => {
  it('is the next step, and done once none is left', () => {
    expect(gcRowStage({ next: 'check' })).toBe('check')
    expect(gcRowStage({ next: 'word' })).toBe('word')
    expect(gcRowStage({ next: null })).toBe('done')
  })
})

describe('buildGcStageTrack', () => {
  it('counts the GCs waiting at each stage and what they owe', () => {
    const t = buildGcStageTrack(week())
    expect(t.stops.map((s) => [s.key, s.waiting, s.waitingTotal])).toEqual([
      ['check', 1, 30000],
      ['send', 2, 106000],
      ['word', 1, 21000],
    ])
  })

  it('says how far along each step is — the word only counts the GCs over the line', () => {
    const t = buildGcStageTrack(week())
    expect(t.stops.map((s) => [s.key, s.done, s.of])).toEqual([
      ['check', 5, 6],
      ['send', 3, 6],
      ['word', 1, 4],
    ])
  })

  it('every GC is at exactly one stage', () => {
    const w = week()
    const t = buildGcStageTrack(w)
    const waiting = t.stops.reduce((n, s) => n + s.waiting, 0)
    expect(waiting + t.finished.done + t.finished.skipped).toBe(w.counts.gcs)
    expect(t.finished).toEqual({ done: 2, skipped: 0, of: 6 })
  })

  it('"here" is the first stage with a GC waiting', () => {
    expect(buildGcStageTrack(week()).here).toBe('check')
    // Check the last one: the work moves on to Send by itself.
    const checked = week({ certsByGc: new Map(['a', 'b', 'c', 'd', 'e', 'f'].map((id) => [id, cert(id, { a: 30000, b: 98000, c: 21000, d: 22000, e: 8000, f: 4000 }[id]!)])) })
    const t = buildGcStageTrack(checked)
    expect(t.here).toBe('send')
    expect(t.stops[0]).toMatchObject({ waiting: 0, done: 6, of: 6, complete: true })
  })

  it('a finished week is "done", every stop complete', () => {
    const all = ['a', 'b', 'c', 'd']
    const w = buildGcWorklist({
      groups: all.map((id) => group(id, 20000)),
      certsByGc: new Map(all.map((id) => [id, cert(id, 20000)])),
      marks: all.map((id) => mark(id, 'sent', { temperature: 'hot' })),
      senders: new Map(),
      accountMen: new Map(),
      lastSentByGcId: {},
      weekStartYmd: WEEK,
    })
    const t = buildGcStageTrack(w)
    expect(t.here).toBe('done')
    expect(t.stops.every((s) => s.complete)).toBe(true)
    expect(t.finished).toEqual({ done: 4, skipped: 0, of: 4 })
  })

  it('a GC whose bills changed after sign-off is back at Check, and Check is not complete', () => {
    // b was certified at 98,000 and now owes 99,500.
    const w = week({ groups: [group('a', 30000), group('b', 99500), group('c', 21000), group('d', 22000), group('e', 8000), group('f', 4000)] })
    const t = buildGcStageTrack(w)
    expect(t.stops[0]).toMatchObject({ waiting: 2, done: 4, of: 6, complete: false })
    expect(t.stops[1]).toMatchObject({ waiting: 1 })
  })

  it('a skipped GC waits nowhere and is not owed the steps it never did', () => {
    const t = buildGcStageTrack(week({ marks: [mark('a', 'skipped'), mark('c', 'sent'), mark('d', 'sent', { temperature: 'warm' }), mark('f', 'sent')] }))
    expect(t.stops[0]).toMatchObject({ waiting: 0, done: 5, of: 5, complete: true })
    expect(t.here).toBe('send')
    expect(t.finished).toEqual({ done: 2, skipped: 1, of: 6 })
  })

  it('an empty week has nothing to complete', () => {
    const t = buildGcStageTrack({ groups: [] })
    expect(t.here).toBe('done')
    expect(t.stops.every((s) => !s.complete && s.of === 0)).toBe(true)
  })
})

describe('gcStageStopLabel', () => {
  it('reads as the work left', () => {
    expect(gcStageStopLabel({ key: 'check', waiting: 1, complete: false })).toBe('1 to check')
    expect(gcStageStopLabel({ key: 'send', waiting: 10, complete: false })).toBe('10 to send')
    expect(gcStageStopLabel({ key: 'word', waiting: 1, complete: false })).toBe('1 word due')
    expect(gcStageStopLabel({ key: 'word', waiting: 2, complete: false })).toBe('2 words due')
  })

  it('says so when the step is finished, or when its GCs are still upstream', () => {
    expect(gcStageStopLabel({ key: 'check', waiting: 0, complete: true })).toBe('all checked')
    expect(gcStageStopLabel({ key: 'send', waiting: 0, complete: true })).toBe('all sent')
    expect(gcStageStopLabel({ key: 'word', waiting: 0, complete: true })).toBe('all words in')
    expect(gcStageStopLabel({ key: 'word', waiting: 0, complete: false })).toBe('none waiting')
  })
})

describe('gcWorklistAtStage', () => {
  const names = (groups: ReturnType<typeof gcWorklistAtStage>['groups']) => groups.map((g) => [g.key, g.rows.map((r) => r.gcId)])

  it('with no stage picked, keeps every GC and puts the earliest stage on top of its group', () => {
    const at = gcWorklistAtStage(week(), null)
    expect(at).toMatchObject({ shown: 6, of: 6 })
    expect(names(at.groups)).toEqual([
      ['owner:u-malachi', ['a', 'b', 'c']],
      ['owner:u-taunya', ['d']],
      ['under_line', ['e', 'f']],
    ])
  })

  it('with a stage picked, keeps the GCs waiting there and drops the groups with none', () => {
    const at = gcWorklistAtStage(week(), 'send')
    expect(names(at.groups)).toEqual([
      ['owner:u-malachi', ['b']],
      ['under_line', ['e']],
    ])
    expect(at).toMatchObject({ shown: 2, shownTotal: 106000, of: 6 })
  })

  it('"done" lists the finished GCs', () => {
    expect(names(gcWorklistAtStage(week(), 'done').groups)).toEqual([
      ['owner:u-taunya', ['d']],
      ['under_line', ['f']],
    ])
  })

  it('a broken promise stays first, whatever its stage', () => {
    // c promised the 20th and still owes; today is the 27th. It is at Word, behind a (Check) and b (Send).
    const w = week({ expectedPayByByGc: new Map([['c', '2026-09-20']]), todayYmd: '2026-09-27' })
    expect(gcWorklistAtStage(w, null).groups[0]!.rows.map((r) => r.gcId)).toEqual(['c', 'a', 'b'])
  })

  it('leaves the worklist it was given alone', () => {
    const w = week()
    const before = w.groups.map((g) => g.rows.map((r) => r.gcId))
    gcWorklistAtStage(w, 'send')
    expect(w.groups.map((g) => g.rows.map((r) => r.gcId))).toEqual(before)
  })

  it('a stage nobody is at is an empty list', () => {
    const all = ['a', 'b']
    const w = buildGcWorklist({ groups: all.map((id) => group(id, 20000)), certsByGc: new Map(), marks: [], senders: new Map(), accountMen: new Map(), lastSentByGcId: {}, weekStartYmd: WEEK })
    expect(gcWorklistAtStage(w, 'word')).toMatchObject({ groups: [], shown: 0, shownTotal: 0, of: 2 })
  })
})
