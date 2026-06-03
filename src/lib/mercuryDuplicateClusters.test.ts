import { describe, expect, it } from 'vitest'
import {
  clusterDuplicatePairs,
  duplicatePairKey,
  type DuplicatePair,
  type DuplicateTxLite,
} from './mercuryDuplicateClusters'

function tx(id: string, over: Partial<DuplicateTxLite> = {}): DuplicateTxLite {
  return {
    id,
    amount: -100,
    counterpartyName: 'Gajeske',
    postedAt: '2026-06-01T00:00:00Z',
    createdAt: '2026-06-01T00:00:00Z',
    kind: 'debitCard',
    mercuryAccountId: 'acct-1',
    source: 'mercury',
    raw: null,
    ...over,
  }
}

function pair(a: DuplicateTxLite, b: DuplicateTxLite, over: Partial<DuplicatePair> = {}): DuplicatePair {
  return {
    a,
    b,
    manualInvolved: a.source === 'manual' || b.source === 'manual',
    daysApart: 0,
    ...over,
  }
}

describe('duplicatePairKey', () => {
  it('is order-independent', () => {
    expect(duplicatePairKey('b', 'a')).toBe('a|b')
    expect(duplicatePairKey('a', 'b')).toBe('a|b')
  })
})

describe('clusterDuplicatePairs', () => {
  it('groups transitively-linked pairs into one cluster (3 identical → group of 3)', () => {
    const a = tx('a')
    const b = tx('b')
    const c = tx('c')
    const clusters = clusterDuplicatePairs([pair(a, b), pair(b, c)])
    expect(clusters).toHaveLength(1)
    expect(clusters[0]!.members.map((m) => m.id).sort()).toEqual(['a', 'b', 'c'])
    expect(clusters[0]!.key).toBe('a|b|c')
  })

  it('keeps unrelated pairs as separate clusters', () => {
    const clusters = clusterDuplicatePairs([pair(tx('a'), tx('b')), pair(tx('c'), tx('d'))])
    expect(clusters).toHaveLength(2)
  })

  it('flags manualInvolved when any member is manual and sorts those first', () => {
    const synced = clusterDuplicatePairs([pair(tx('a'), tx('b'))])
    expect(synced[0]!.manualInvolved).toBe(false)

    const m1 = tx('m1', { source: 'manual', postedAt: null })
    const s1 = tx('s1')
    const clusters = clusterDuplicatePairs([pair(tx('a'), tx('b')), pair(s1, m1)])
    expect(clusters[0]!.manualInvolved).toBe(true)
    expect(clusters[0]!.members.map((m) => m.id)).toContain('m1')
    // Manual-involved cluster ranks ahead of the synced-only one.
    expect(clusters[0]!.members.some((m) => m.source === 'manual')).toBe(true)
  })

  it('orders members synced-first so the likely keeper is on top', () => {
    const manual = tx('m', { source: 'manual' })
    const synced = tx('s', { source: 'mercury' })
    const [cluster] = clusterDuplicatePairs([pair(manual, synced)])
    expect(cluster!.members[0]!.source).toBe('mercury')
    expect(cluster!.members[1]!.source).toBe('manual')
  })

  it('tracks maxDaysApart and the observed pair keys', () => {
    const a = tx('a')
    const b = tx('b')
    const c = tx('c')
    const [cluster] = clusterDuplicatePairs([pair(a, b, { daysApart: 1 }), pair(b, c, { daysApart: 3 })])
    expect(cluster!.maxDaysApart).toBe(3)
    expect(cluster!.pairKeys.sort()).toEqual(['a|b', 'b|c'])
  })

  it('sorts larger clusters ahead of smaller ones (same manual status)', () => {
    const big = clusterDuplicatePairs([
      pair(tx('a'), tx('b')),
      pair(tx('b'), tx('c')),
      pair(tx('x'), tx('y')),
    ])
    expect(big[0]!.members.length).toBe(3)
    expect(big[1]!.members.length).toBe(2)
  })

  it('returns [] for no pairs', () => {
    expect(clusterDuplicatePairs([])).toEqual([])
  })
})
