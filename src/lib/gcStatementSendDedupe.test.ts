import { describe, expect, it } from 'vitest'
import * as edge from '../../supabase/functions/_shared/gcStatementSendDedupe'
import {
  GC_STATEMENT_DEDUPE_WINDOW_MS,
  GC_STATEMENT_EMAIL_TYPES,
  describeAgo,
  describeDuplicateStatementSkip,
  dedupeSinceIso,
  findDuplicateStatementSend,
  isDuplicateStatementSend,
  statementEntityKey,
  type RecentStatementSend,
} from './gcStatementSendDedupe'

const NOW = Date.parse('2026-09-05T14:00:00Z')
const min = (n: number) => n * 60_000
const hr = (n: number) => n * 3_600_000

const kestrin = { gcCustomerId: 'gc-kestrin', groupBy: 'gc', gcName: 'Kestrin Contracting', sentTo: 'ap@kestrin.com' }
function sent(over: Partial<RecentStatementSend> = {}, agoMs = min(4)): RecentStatementSend {
  return { ...kestrin, sentAt: new Date(NOW - agoMs).toISOString(), ...over }
}

describe('gcStatementSendDedupe — the rule both lanes run (journey-map #45)', () => {
  it('names the two catalog ids and the two windows', () => {
    expect(GC_STATEMENT_EMAIL_TYPES).toEqual({ manual: 'gc_statement_manual', scheduled: 'gc_statement_scheduled' })
    expect(GC_STATEMENT_DEDUPE_WINDOW_MS.attended).toBe(min(10))
    expect(GC_STATEMENT_DEDUPE_WINDOW_MS.unattended).toBe(hr(12))
  })

  it('a same-GC, same-address send inside the window is a duplicate — by any lane', () => {
    const recent = [sent()]
    expect(isDuplicateStatementSend(recent, kestrin, GC_STATEMENT_DEDUPE_WINDOW_MS.attended, NOW)).toBe(true)
    expect(findDuplicateStatementSend(recent, kestrin, GC_STATEMENT_DEDUPE_WINDOW_MS.attended, NOW)).toBe(recent[0])
  })

  it('outside the window it is not', () => {
    expect(isDuplicateStatementSend([sent({}, min(11))], kestrin, GC_STATEMENT_DEDUPE_WINDOW_MS.attended, NOW)).toBe(false)
    // …but the unattended window still catches the same-half-day scheduled repeat.
    expect(isDuplicateStatementSend([sent({}, hr(7))], kestrin, GC_STATEMENT_DEDUPE_WINDOW_MS.unattended, NOW)).toBe(true)
    expect(isDuplicateStatementSend([sent({}, hr(13))], kestrin, GC_STATEMENT_DEDUPE_WINDOW_MS.unattended, NOW)).toBe(false)
  })

  it('a different recipient or a different GC is never a duplicate', () => {
    expect(isDuplicateStatementSend([sent({ sentTo: 'owner@kestrin.com' })], kestrin, min(10), NOW)).toBe(false)
    expect(isDuplicateStatementSend([sent({ gcCustomerId: 'gc-other' })], kestrin, min(10), NOW)).toBe(false)
  })

  it('recipient match is case- and whitespace-insensitive', () => {
    expect(isDuplicateStatementSend([sent({ sentTo: ' AP@Kestrin.com ' })], kestrin, min(10), NOW)).toBe(true)
  })

  it('whole-report and development statements key on group + snapshotted name (no customer id in the audit)', () => {
    const allGcs = { gcCustomerId: null, groupBy: 'all', gcName: 'All GCs', sentTo: 'malachi@click.com' }
    const allDevs = { gcCustomerId: null, groupBy: 'all', gcName: 'All developments', sentTo: 'malachi@click.com' }
    expect(statementEntityKey(allGcs)).toBe('all:all gcs')
    expect(statementEntityKey(allDevs)).toBe('all:all developments')
    expect(statementEntityKey(kestrin)).toBe('gc:gc-kestrin')
    expect(isDuplicateStatementSend([sent({ ...allGcs })], allGcs, min(10), NOW)).toBe(true)
    expect(isDuplicateStatementSend([sent({ ...allGcs })], allDevs, min(10), NOW)).toBe(false)
    const dev = { gcCustomerId: null, groupBy: 'development', gcName: 'Sunset Ridge', sentTo: 'ap@dev.com' }
    expect(isDuplicateStatementSend([sent({ ...dev, gcName: ' sunset ridge ' })], dev, min(10), NOW)).toBe(true)
  })

  it('picks the newest match, ignores garbage timestamps and rows from the future', () => {
    const newest = sent({}, min(1))
    const recent = [sent({}, min(5)), newest, sent({ sentAt: 'not a date' }), sent({}, -min(3))]
    expect(findDuplicateStatementSend(recent, kestrin, min(10), NOW)).toBe(newest)
    expect(isDuplicateStatementSend([sent({ sentAt: 'nope' })], kestrin, min(10), NOW)).toBe(false)
    expect(isDuplicateStatementSend([sent({}, -min(3))], kestrin, min(10), NOW)).toBe(false)
  })

  it('a zero/negative window or an empty recipient disables the check', () => {
    expect(isDuplicateStatementSend([sent()], kestrin, 0, NOW)).toBe(false)
    expect(isDuplicateStatementSend([sent()], { ...kestrin, sentTo: '' }, min(10), NOW)).toBe(false)
  })

  it('writes one sentence for the skip reason', () => {
    expect(describeDuplicateStatementSkip(sent(), NOW)).toBe(
      'skipped: duplicate — Kestrin Contracting already went to ap@kestrin.com 4 minutes ago',
    )
    expect(describeDuplicateStatementSkip(sent({ gcName: '' }, min(0.5)), NOW)).toBe(
      'skipped: duplicate — This statement already went to ap@kestrin.com just now',
    )
    expect(describeAgo(new Date(NOW - min(1)).toISOString(), NOW)).toBe('1 minute ago')
    expect(describeAgo(new Date(NOW - hr(1)).toISOString(), NOW)).toBe('1 hour ago')
    expect(describeAgo(new Date(NOW - hr(5)).toISOString(), NOW)).toBe('5 hours ago')
    expect(describeAgo('bad', NOW)).toBe('recently')
  })

  it('dedupeSinceIso is now − window', () => {
    expect(dedupeSinceIso(min(10), NOW)).toBe('2026-09-05T13:50:00.000Z')
    expect(dedupeSinceIso(-5, NOW)).toBe('2026-09-05T14:00:00.000Z')
  })
})

describe('client twin agrees with the edge kernel', () => {
  const cases: Array<[RecentStatementSend[], number]> = [
    [[sent()], min(10)],
    [[sent({}, min(11))], min(10)],
    [[sent({ sentTo: 'x@y.z' })], min(10)],
    [[sent({}, hr(7))], hr(12)],
  ]
  it.each(cases)('case %#', (recent, window) => {
    expect(isDuplicateStatementSend(recent, kestrin, window, NOW)).toBe(edge.isDuplicateStatementSend(recent, kestrin, window, NOW))
    expect(findDuplicateStatementSend(recent, kestrin, window, NOW)).toBe(edge.findDuplicateStatementSend(recent, kestrin, window, NOW))
  })
  it('the twin is the same module', () => {
    expect(isDuplicateStatementSend).toBe(edge.isDuplicateStatementSend)
    expect(GC_STATEMENT_EMAIL_TYPES).toBe(edge.GC_STATEMENT_EMAIL_TYPES)
  })
})
