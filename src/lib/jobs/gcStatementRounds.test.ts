import { describe, expect, it } from 'vitest'
import type { GcReviewGroup } from '../gcReviewRollup'
import type { GcReviewCertRow } from './gcReviewCertification'
import {
  buildStatementRound,
  deriveGcAccountMen,
  describeRoundMark,
  isStatementSendChannel,
  mergeMarksIntoLastSent,
  sendChannelLabel,
  senderRoundQueue,
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

const mark = (gc: string, action: 'sent' | 'skipped' | 'contacted', at = '2026-08-20T15:00:00Z'): RoundMarkRow => ({
  gc_customer_id: gc,
  week_start: '2026-08-17',
  action,
  acted_by: 'u2',
  acted_by_name: 'Malachi',
  acted_at: at,
  channel: null,
  note: null,
  temperature: null,
  expected_pay_by: null,
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
    expect(s.senderProgress.get('u2')).toEqual({ sent: 1, contacted: 0, total: 2 })
    expect(s.senderProgress.get('u3')).toEqual({ sent: 0, contacted: 0, total: 1 })
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

describe('send channels (v2.2761)', () => {
  it('labels every channel and reads legacy null / unknown as Email', () => {
    expect(sendChannelLabel('text')).toBe('Text')
    expect(sendChannelLabel('in_person')).toBe('In person')
    expect(sendChannelLabel(null)).toBe('Email')
    expect(sendChannelLabel('fax')).toBe('Email')
  })

  it('guards the stored string', () => {
    expect(isStatementSendChannel('call')).toBe(true)
    expect(isStatementSendChannel('fax')).toBe(false)
    expect(isStatementSendChannel(null)).toBe(false)
  })

  it('describes a mark with and without a note', () => {
    expect(describeRoundMark({ acted_by_name: 'Malachi', channel: 'text', note: '  ' }, 'Thu, Sep 4')).toBe(
      'Marked sent by Malachi · Thu, Sep 4 · text',
    )
    expect(describeRoundMark({ acted_by_name: '', channel: null, note: 'Dave pays Friday' }, 'Thu, Sep 4')).toBe(
      'Marked sent by — · Thu, Sep 4 · email\nNote: Dave pays Friday',
    )
  })

  it('a text-message mark merges into last-sent like an email', () => {
    const m = { ...mark('a', 'sent', '2026-08-21T10:00:00Z'), channel: 'text', note: 'texted Dave' }
    expect(mergeMarksIntoLastSent({ a: '2026-08-20T09:00:00Z' }, [m])).toEqual({ a: '2026-08-21T10:00:00Z' })
  })
})

describe('senderRoundQueue (v2.2792)', () => {
  it('walks ready first by amount, then held, then marks; tallies assigned-only', () => {
    const senders = new Map([['a', 'u2'], ['b', 'u2'], ['c', 'u2'], ['d', 'u2'], ['e', 'u9']])
    const items = buildStatementRound({
      groups: [group('a', 20000), group('b', 46000), group('c', 15000), group('d', 30000), group('e', 12000)],
      certsByGc: new Map([
        ['a', { ...cert(20000), gc_customer_id: 'a' }],
        ['b', { ...cert(46000), gc_customer_id: 'b' }],
        ['c', { ...cert(15000), gc_customer_id: 'c' }],
        ['e', { ...cert(12000), gc_customer_id: 'e' }],
      ]),
      marks: [mark('c', 'sent')],
      senders,
      accountMen: new Map(),
    })
    const q = senderRoundQueue(items, 'u2')
    expect(q.queue.map((i) => `${i.gcId}:${i.state}`)).toEqual(['b:ready', 'a:ready', 'd:needs_certify', 'c:sent'])
    expect(q.sent).toBe(1)
    expect(q.assigned).toBe(4)
    expect(senderRoundQueue(items, 'nobody').queue).toEqual([])
  })
})

describe('contacted marks (v2.2813)', () => {
  it('a contacted mark is its own state, never a send, and describes itself with the temperature', () => {
    const m = { ...mark('a', 'contacted'), channel: 'call', temperature: 'warm', note: 'Dave says the 10th', expected_pay_by: '2026-09-10' }
    expect(mergeMarksIntoLastSent({}, [m])).toEqual({})
    const items = buildStatementRound({ groups: [group('a', 46000)], certsByGc: new Map([['a', cert(46000)]]), marks: [m], senders: new Map([['a', 'u2']]), accountMen: new Map() })
    expect(items[0]?.state).toBe('contacted')
    const s = summarizeStatementRound(items, 'u2')
    expect(s.readyForUser).toEqual([])
    expect(s.senderProgress.get('u2')).toEqual({ sent: 0, contacted: 1, total: 1 })
    expect(describeRoundMark(m, 'Thu, Sep 4')).toBe("Spoke with them by Malachi · Thu, Sep 4 · call · warm · no statement\nTemperature: Dave says the 10th\nThey said they'd pay by 2026-09-10")
  })
})
