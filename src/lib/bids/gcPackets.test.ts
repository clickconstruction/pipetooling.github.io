import { describe, expect, it } from 'vitest'
import { defaultCopySourceId, groupVersionsByGc, rollUpOutcome } from './gcPackets'

const v = (id: string, customer_id: string | null, sort_order: number, extra: Record<string, unknown> = {}) => ({ id, name: id, customer_id, sort_order, ...extra })

describe('groupVersionsByGc', () => {
  it('groups by GC with the bid GC first, names from the customer map, and per-packet send state', () => {
    const g = groupVersionsByGc(
      [v('burd', 'c-burd', 1, { outcome: 'lost' }), v('spc', null, 0), v('burd-ve', 'c-burd', 2)],
      { bidGcName: 'Southern Post', gcNames: { 'c-burd': 'Burd & Assoc.' }, latestSends: { burd: { sentOn: '2026-07-31', value: 52311.11, isAlternate: false } }, bidDateSent: '2026-07-31' },
    )
    expect(g.map((x) => [x.name, x.versions.map((y) => y.id), x.sentOn, x.sentValue, x.outcome])).toEqual([
      ['Southern Post', ['spc'], null, null, null],
      ['Burd & Assoc.', ['burd', 'burd-ve'], '2026-07-31', 52311.11, 'lost'],
    ])
  })
  it('falls back to the bid sent date only for versions that existed then, when there are no per-version sends', () => {
    const g = groupVersionsByGc(
      [v('spc', null, 0, { created_at: '2026-07-01T00:00:00Z' }), v('knight', 'c-k', 1, { created_at: '2026-08-23T00:00:00Z' })],
      { bidGcName: 'SPC', gcNames: { 'c-k': 'Knight' }, latestSends: {}, bidDateSent: '2026-07-31' },
    )
    expect(g.map((x) => [x.name, x.sentOn])).toEqual([['SPC', '2026-07-31'], ['Knight', null]])
  })
  it('"Also sent to" GCs without a version become shared-letter packets after the real ones; GCs that have a version are not doubled', () => {
    const g = groupVersionsByGc(
      [v('spc', null, 0), v('burd', 'c-burd', 1)],
      { bidGcName: 'SPC', gcNames: { 'c-burd': 'Burd' }, latestSends: {}, bidDateSent: '2026-07-31', recipients: [{ customerId: 'c-burd', name: 'Burd' }, { customerId: 'c-k', name: 'Knight' }] },
    )
    expect(g.map((x) => [x.name, x.versions.length, x.sentOn, x.sharedLetter ?? false])).toEqual([
      ['SPC', 1, '2026-07-31', false],
      ['Burd', 1, '2026-07-31', false],
      ['Knight', 0, '2026-07-31', true],
    ])
  })
})

describe('defaultCopySourceId', () => {
  const vs = [
    v('spc', null, 0),
    v('burd', 'c-burd', 1, { starred_price_book_version_id: 'p1' }),
    v('burd-ve', 'c-burd', 2),
    v('knight-b', 'c-k', 4, { starred_price_book_version_id: 'p2' }),
    v('knight-a', 'c-k', 3),
  ]
  it('keeps the selected version when it is already in the destination packet', () => {
    expect(defaultCopySourceId(vs, 'c-burd', 'burd-ve')).toBe('burd-ve')
  })
  it('prefers the destination packet over a selection in another GC — the ★ version first', () => {
    expect(defaultCopySourceId(vs, 'c-k', 'burd')).toBe('knight-b')
  })
  it('falls back to the packet first by sort order when nothing is starred', () => {
    expect(defaultCopySourceId([v('spc', null, 0), v('b1', 'c-b', 2), v('b2', 'c-b', 1)], 'c-b', 'spc')).toBe('b2')
  })
  it('a packet with no versions falls back to the selection, then the first version overall', () => {
    expect(defaultCopySourceId(vs, 'c-new', 'burd')).toBe('burd')
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
