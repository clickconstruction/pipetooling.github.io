import { describe, expect, it } from 'vitest'
import type { GcReviewGroup } from '../gcReviewRollup'
import type { GcReviewCertRow } from './gcReviewCertification'
import {
  buildStatementRound,
  deriveGcAccountMen,
  mergeMarksIntoLastSent,
  summarizeStatementRound,
  type RoundMarkRow,
} from './gcStatementRounds'

const group = (gcId: string | null, subtotal: number, over?: Partial<GcReviewGroup>): GcReviewGroup => ({
  key: gcId ?? 'no-gc',
  gcId,
  gcName: gcId ? `GC ${gcId}` : 'No GC set',
  isNoGc: gcId == null,
  rows: [],
  subtotal,
  jobCount: 2,
  oldestAgeDays: 30,
  ...over,
})

const cert = (total: number): GcReviewCertRow => ({
  week_start: '2026-08-17',
  gc_customer_id: 'a',
  certified_by_name: 'Robert',
  certified_at: '2026-08-19T12:00:00Z',
  job_count: 2,
  total,
  snapshot: null,
  note: '',
})

const mark = (gc: string, action: 'sent' | 'skipped', at = '2026-08-20T15:00:00Z'): RoundMarkRow => ({
  gc_customer_id: gc,
  week_start: '2026-08-17',
  action,
  acted_by: 'u2',
  acted_by_name: 'Malachi',
  acted_at: at,
})

describe('buildStatementRound', () => {
  it('includes only real GCs at/over the threshold, sorted by amount', () => {
    const items = buildStatementRound({
      groups: [group('a', 46000), group('b', 9999), group(null, 65000), group('c', 10000)],
      certsByGc: new Map(),
      marks: [],
      senders: new Map(),
      accountMen: new Map(),
    })
    expect(items.map((i) => i.gcId)).toEqual(['a', 'c'])
  })

  it('walks the state ladder: mark > uncertified > no-sender > ready', () => {
    const certsByGc = new Map([
      ['a', cert(46000)],
      ['b', cert(20000)],
      ['d', cert(15000)],
    ])
    const items = buildStatementRound({
      groups: [group('a', 46000), group('b', 20000), group('c', 12000), group('d', 15000)],
      certsByGc,
      marks: [mark('a', 'sent')],
      senders: new Map([['b', 'u2']]),
      accountMen: new Map([['a', 'u2']]),
    })
    const byId = new Map(items.map((i) => [i.gcId, i]))
    expect(byId.get('a')?.state).toBe('sent')
    expect(byId.get('b')?.state).toBe('ready')
    expect(byId.get('c')?.state).toBe('needs_certify')
    expect(byId.get('d')?.state).toBe('needs_sender')
  })

  it('a changed-since-certified group is held again (unless already marked)', () => {
    const items = buildStatementRound({
      groups: [group('a', 50000)],
      certsByGc: new Map([['a', cert(46000)]]),
      marks: [],
      senders: new Map([['a', 'u2']]),
      accountMen: new Map(),
    })
    expect(items[0]?.state).toBe('needs_certify')
  })
})

describe('summarizeStatementRound', () => {
  it('splits held totals, the current user queue, and per-sender progress', () => {
    const certsByGc = new Map([
      ['a', cert(46000)],
      ['b', cert(20000)],
    ])
    const items = buildStatementRound({
      groups: [group('a', 46000), group('b', 20000), group('c', 12000)],
      certsByGc,
      marks: [mark('a', 'sent')],
      senders: new Map([
        ['a', 'u2'],
        ['b', 'u2'],
        ['c', 'u3'],
      ]),
      accountMen: new Map(),
    })
    const s = summarizeStatementRound(items, 'u2')
    expect(s.held).toEqual({ count: 1, total: 12000 })
    expect(s.readyForUser.map((i) => i.gcId)).toEqual(['b'])
    expect(s.senderProgress.get('u2')).toEqual({ sent: 1, total: 2 })
    expect(s.senderProgress.get('u3')).toEqual({ sent: 0, total: 1 })
  })
})

describe('deriveGcAccountMen', () => {
  it('picks the most common account man per GC, ignoring gaps', () => {
    const rows = [
      { job: { gc_customer_id: 'a', account_manager_user_id: 'u1' } },
      { job: { gc_customer_id: 'a', account_manager_user_id: 'u2' } },
      { job: { gc_customer_id: 'a', account_manager_user_id: 'u2' } },
      { job: { gc_customer_id: 'b', account_manager_user_id: null } },
      { job: { gc_customer_id: null, account_manager_user_id: 'u1' } },
    ]
    const m = deriveGcAccountMen(rows)
    expect(m.get('a')).toBe('u2')
    expect(m.has('b')).toBe(false)
  })
})

describe('mergeMarksIntoLastSent', () => {
  it('later sent marks win; skips never count', () => {
    const merged = mergeMarksIntoLastSent({ a: '2026-08-11T10:00:00Z', b: '2026-08-20T18:00:00Z' }, [
      mark('a', 'sent', '2026-08-20T15:00:00Z'),
      mark('b', 'sent', '2026-08-19T15:00:00Z'),
      mark('c', 'skipped'),
    ])
    expect(merged.a).toBe('2026-08-20T15:00:00Z')
    expect(merged.b).toBe('2026-08-20T18:00:00Z')
    expect(merged.c).toBeUndefined()
  })
})
