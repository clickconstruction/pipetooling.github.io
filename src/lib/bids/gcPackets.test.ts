import { describe, expect, it } from 'vitest'
import { defaultCopySourceId, groupVersionsByGc, perGcSentSummary, rollUpOutcome } from './gcPackets'
import { getSubmissionSectionKey } from './submissionSections'

const v = (id: string, customer_id: string | null, sort_order: number, extra: Record<string, unknown> = {}) => ({ id, name: id, customer_id, sort_order, ...extra })

describe('groupVersionsByGc', () => {
  it('groups by GC with the bid GC first, names from the customer map, and per-packet send state', () => {
    const g = groupVersionsByGc(
      [v('brund', 'c-brund', 1, { outcome: 'lost' }), v('spc', null, 0), v('brund-ve', 'c-brund', 2)],
      { bidGcName: 'Southern Pine', gcNames: { 'c-brund': 'Brund & Assoc.' }, latestSends: { brund: { sentOn: '2026-07-31', value: 52311.11, isAlternate: false } }, bidDateSent: '2026-07-31' },
    )
    expect(g.map((x) => [x.name, x.versions.map((y) => y.id), x.sentOn, x.sentValue, x.outcome])).toEqual([
      ['Southern Pine', ['spc'], null, null, null],
      ['Brund & Assoc.', ['brund', 'brund-ve'], '2026-07-31', 52311.11, 'lost'],
    ])
  })
  it('falls back to the bid sent date only for versions that existed then, when there are no per-version sends', () => {
    const g = groupVersionsByGc(
      [v('spc', null, 0, { created_at: '2026-07-01T00:00:00Z' }), v('kestrin', 'c-k', 1, { created_at: '2026-08-23T00:00:00Z' })],
      { bidGcName: 'SPC', gcNames: { 'c-k': 'Kestrin' }, latestSends: {}, bidDateSent: '2026-07-31' },
    )
    expect(g.map((x) => [x.name, x.sentOn])).toEqual([['SPC', '2026-07-31'], ['Kestrin', null]])
  })
  it('"Also sent to" GCs without a version become shared-letter packets after the real ones; GCs that have a version are not doubled', () => {
    const g = groupVersionsByGc(
      [v('spc', null, 0), v('brund', 'c-brund', 1)],
      { bidGcName: 'SPC', gcNames: { 'c-brund': 'Brund' }, latestSends: {}, bidDateSent: '2026-07-31', recipients: [{ customerId: 'c-brund', name: 'Brund' }, { customerId: 'c-k', name: 'Kestrin' }] },
    )
    expect(g.map((x) => [x.name, x.versions.length, x.sentOn, x.sharedLetter ?? false])).toEqual([
      ['SPC', 1, '2026-07-31', false],
      ['Brund', 1, '2026-07-31', false],
      ['Kestrin', 0, '2026-07-31', true],
    ])
  })
})

describe('defaultCopySourceId', () => {
  const vs = [
    v('spc', null, 0),
    v('brund', 'c-brund', 1, { starred_price_book_version_id: 'p1' }),
    v('brund-ve', 'c-brund', 2),
    v('kestrin-b', 'c-k', 4, { starred_price_book_version_id: 'p2' }),
    v('kestrin-a', 'c-k', 3),
  ]
  it('keeps the selected version when it is already in the destination packet', () => {
    expect(defaultCopySourceId(vs, 'c-brund', 'brund-ve')).toBe('brund-ve')
  })
  it('prefers the destination packet over a selection in another GC — the ★ version first', () => {
    expect(defaultCopySourceId(vs, 'c-k', 'brund')).toBe('kestrin-b')
  })
  it('falls back to the packet first by sort order when nothing is starred', () => {
    expect(defaultCopySourceId([v('spc', null, 0), v('b1', 'c-b', 2), v('b2', 'c-b', 1)], 'c-b', 'spc')).toBe('b2')
  })
  it('a packet with no versions falls back to the selection, then the first version overall', () => {
    expect(defaultCopySourceId(vs, 'c-new', 'brund')).toBe('brund')
    expect(defaultCopySourceId(vs, 'c-new', null)).toBe('spc')
    expect(defaultCopySourceId([], null, null)).toBeNull()
  })
})

describe('rollUpOutcome', () => {
  it('won if any won; lost only when every sent packet lost; else null', () => {
    expect(rollUpOutcome([{ outcome: 'won', sentOn: '2026-07-31' }, { outcome: 'lost', sentOn: '2026-07-31' }])).toBe('won')
    expect(rollUpOutcome([{ outcome: 'lost', sentOn: '2026-07-31' }, { outcome: 'lost', sentOn: '2026-07-31' }])).toBe('lost')
    expect(rollUpOutcome([{ outcome: 'lost', sentOn: '2026-07-31' }, { outcome: null, sentOn: '2026-07-31' }])).toBeNull()
    expect(rollUpOutcome([{ outcome: null, sentOn: null }])).toBeNull()
  })
})

describe('resolveWinningPacket', () => {
  it('one won real packet is the winner; shared-letter wins never count', async () => {
    const { resolveWinningPacket } = await import('./gcPackets')
    expect(resolveWinningPacket([{ outcome: 'won' }, { outcome: null }])).toEqual({ winner: { outcome: 'won' }, multiple: false })
    expect(resolveWinningPacket([{ outcome: 'won', sharedLetter: true }, { outcome: null }])).toEqual({ winner: null, multiple: false })
  })
  it('zero or multiple winners → null (multiple flagged)', async () => {
    const { resolveWinningPacket } = await import('./gcPackets')
    expect(resolveWinningPacket([{ outcome: null }, { outcome: 'lost' }])).toEqual({ winner: null, multiple: false })
    expect(resolveWinningPacket([{ outcome: 'won' }, { outcome: 'won' }])).toEqual({ winner: null, multiple: true })
  })
})

describe('perGcSentSummary', () => {
  it('counts real packets: partial and complete', () => {
    expect(perGcSentSummary([{ sentOn: '2026-08-27' }, { sentOn: null }])).toEqual({ sent: 1, total: 2, complete: false })
    expect(perGcSentSummary([{ sentOn: '2026-08-20' }, { sentOn: '2026-08-27' }])).toEqual({ sent: 2, total: 2, complete: true })
  })
  it('shared-letter recipients ride the bid — they never count', () => {
    expect(perGcSentSummary([{ sentOn: '2026-08-27' }, { sentOn: null }, { sentOn: '2026-08-27', sharedLetter: true }])).toEqual({ sent: 1, total: 2, complete: false })
    expect(perGcSentSummary([{ sentOn: '2026-08-27' }, { sentOn: '2026-08-27', sharedLetter: true }])).toBeNull()
  })
  it('null when the badge would be noise: <2 real packets, all-unsent, or no packets', () => {
    expect(perGcSentSummary([{ sentOn: '2026-08-27' }])).toBeNull()
    expect(perGcSentSummary([{ sentOn: null }, { sentOn: null }])).toBeNull()
    expect(perGcSentSummary([])).toBeNull()
    expect(perGcSentSummary(undefined)).toBeNull()
  })
})

describe('groupVersionsByGc · a version made on the evening of the send keeps its day (v2.4470)', () => {
  it('counts a version made at 8 pm Central on the sent day as there when it went out', () => {
    // 01:00 UTC on Aug 1 is 8 pm CDT on Jul 31; 00:30 UTC on Dec 2 is 6:30 pm CST on Dec 1.
    const opts = (bidDateSent: string) => ({ bidGcName: 'SPC', gcNames: {}, latestSends: {}, bidDateSent })
    expect(groupVersionsByGc([v('spc', null, 0, { created_at: '2026-08-01T01:00:00Z' })], opts('2026-07-31'))[0]!.sentOn).toBe('2026-07-31')
    expect(groupVersionsByGc([v('spc', null, 0, { created_at: '2026-12-02T00:30:00+00:00' })], opts('2026-12-01'))[0]!.sentOn).toBe('2026-12-01')
    expect(groupVersionsByGc([v('spc', null, 0, { created_at: '2026-08-01T12:00:00Z' })], opts('2026-07-31'))[0]!.sentOn).toBeNull()
  })
})

describe('rollUpOutcome · a same-letter GC rides the bid (BP391, 2026-11-02)', () => {
  // Grace marked every GC lost and the bid stayed in Not yet won or lost. The second GC on the
  // bid's "Also sent to" list had no version of its own, so it came in as a shared-letter packet
  // carrying the bid's sent date and no outcome of its own — and the all-lost rule never fired.
  // A shared-letter GC's answer IS the bid's answer; it can never hold the roll-up.
  const s = { sentOn: '2026-09-01', value: null, isAlternate: false }
  const packets = groupVersionsByGc(
    [
      v('structura', null, 0, { outcome: 'lost', loss_category: 'gc_lost', created_at: '2026-08-27T20:25:19Z' }),
      v('planhub', 'c-planhub', 1, { outcome: 'lost', loss_category: 'price', created_at: '2026-08-27T20:25:19Z' }),
      v('wrenman-v', 'c-planhub', 2, { outcome: 'lost', loss_category: 'price', created_at: '2026-09-01T14:49:16Z' }),
    ],
    {
      bidGcName: 'Structura, Inc. – San Antonio',
      gcNames: { 'c-planhub': 'PlanHub - Subcontractor Prime Opportunity' },
      latestSends: { structura: s, planhub: s, 'wrenman-v': s },
      bidDateSent: '2026-09-01',
      recipients: [
        { customerId: 'c-planhub', name: 'PlanHub - Subcontractor Prime Opportunity' },
        { customerId: 'c-wrenman', name: 'Wrenman Commercial' },
      ],
    },
  )

  it("the bid's shape: two real packets lost, one shared-letter GC with the bid's sent date and no outcome", () => {
    expect(packets.map((p) => [p.name, p.outcome, p.sentOn, p.sharedLetter ?? false])).toEqual([
      ['Structura, Inc. – San Antonio', 'lost', '2026-09-01', false],
      ['PlanHub - Subcontractor Prime Opportunity', 'lost', '2026-09-01', false],
      ['Wrenman Commercial', null, '2026-09-01', true],
    ])
  })

  it('rolls up to Lost, and the pile rule files it under Lost — not Not yet won or lost', () => {
    const roll = rollUpOutcome(packets)
    expect(roll).toBe('lost')
    expect(getSubmissionSectionKey({ outcome: roll, bid_date_sent: '2026-09-01' })).toBe('lost')
  })

  it("an unanswered shared-letter GC decides nothing; an answer set on one is the bid's answer (the writer's in-memory path)", () => {
    expect(rollUpOutcome([{ outcome: null, sentOn: '2026-09-01', sharedLetter: true }])).toBeNull()
    expect(rollUpOutcome([{ outcome: 'won', sentOn: '2026-09-01', sharedLetter: true }])).toBe('won')
    expect(rollUpOutcome([{ outcome: 'lost', sentOn: '2026-09-01' }, { outcome: 'lost', sentOn: '2026-09-01', sharedLetter: true }])).toBe('lost')
  })

  it('a real GC still waiting holds the bid open, shared letter or not', () => {
    expect(rollUpOutcome([{ outcome: 'lost', sentOn: '2026-09-01' }, { outcome: null, sentOn: '2026-09-01' }, { outcome: null, sentOn: '2026-09-01', sharedLetter: true }])).toBeNull()
  })
})
