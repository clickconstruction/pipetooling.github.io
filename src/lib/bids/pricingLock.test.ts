import { describe, expect, it } from 'vitest'
import {
  PRICING_REVISE_STORAGE_KEY,
  formatSentDay,
  pricingLockChipText,
  pricingLockState,
  pricingLockedMessage,
  readRevisedBids,
  writeRevisedBid,
} from './pricingLock'

describe('pricingLock (v2.3591)', () => {
  it('is open until the bid is sent, locked once it is, revising when this session said so', () => {
    expect(pricingLockState({ bidDateSent: null, bidId: 'b1', revised: new Set() })).toBe('open')
    expect(pricingLockState({ bidDateSent: '2026-07-01', bidId: null, revised: new Set(['b1']) })).toBe('open')
    expect(pricingLockState({ bidDateSent: '2026-07-01', bidId: 'b1', revised: new Set() })).toBe('locked')
    expect(pricingLockState({ bidDateSent: '2026-07-01', bidId: 'b1', revised: new Set(['b1']) })).toBe('revising')
    expect(pricingLockState({ bidDateSent: '2026-07-01', bidId: 'b1', revised: new Set(['b2']) })).toBe('locked')
  })

  it('names the sent day, with the year only when it is not this year', () => {
    expect(formatSentDay('2026-07-01', 2026)).toBe('Jul 1')
    expect(formatSentDay('2025-09-22', 2026)).toBe('Sep 22, 2025')
    expect(formatSentDay('2026-07-01T12:00:00Z', 2026)).toBe('Jul 1')
    expect(formatSentDay('garbage', 2026)).toBe('garbage')
    expect(pricingLockedMessage('2026-07-01', 2026)).toBe('This bid was sent Jul 1 — press Revise on the Pricing header to change its prices.')
  })

  it('words the chip for each state and stays off on an unsent bid', () => {
    expect(pricingLockChipText('open', '2026-07-01', 2026)).toBeNull()
    expect(pricingLockChipText('locked', null, 2026)).toBeNull()
    expect(pricingLockChipText('locked', '2026-07-01', 2026)).toBe('Sent Jul 1 · pricing locked')
    expect(pricingLockChipText('revising', '2025-07-01', 2026)).toBe('Revising a bid sent Jul 1, 2025')
  })

  it('round-trips the revised set through session storage and tolerates junk', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) } }
    expect(readRevisedBids(storage).size).toBe(0)
    expect([...writeRevisedBid(storage, 'b1', true)]).toEqual(['b1'])
    expect([...writeRevisedBid(storage, 'b2', true)]).toEqual(['b1', 'b2'])
    expect([...writeRevisedBid(storage, 'b1', false)]).toEqual(['b2'])
    expect(store.get(PRICING_REVISE_STORAGE_KEY)).toBe('["b2"]')
    store.set(PRICING_REVISE_STORAGE_KEY, '{not json')
    expect(readRevisedBids(storage).size).toBe(0)
    store.set(PRICING_REVISE_STORAGE_KEY, '[1, "", "b3"]')
    expect([...readRevisedBids(storage)]).toEqual(['b3'])
    expect(readRevisedBids(null).size).toBe(0)
    const broken = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } }
    expect(readRevisedBids(broken).size).toBe(0)
    expect(() => writeRevisedBid(broken, 'b1', true)).not.toThrow()
  })
})
