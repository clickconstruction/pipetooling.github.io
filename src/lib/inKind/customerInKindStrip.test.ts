import { describe, expect, it } from 'vitest'
import { collectedInKindWords, openBalanceInKindChip, openIsAllInKind, paysInInKindWords, type InKindStripStats } from './customerInKindStrip'

const stats = (o: Partial<InKindStripStats> = {}): InKindStripStats => ({
  openBalance: 9375.4,
  lifetimeCollected: 10500,
  scheduledInKind: 9375.4,
  collectedInKind: 10500,
  aging: { count30_90: 0, count90: 0 },
  ...o,
})

describe('collectedInKindWords', () => {
  it('says when all of it was in kind', () => {
    expect(collectedInKindWords(stats())).toBe('$10,500.00 paid, all of it in kind')
  })
  it('says the part that was in kind', () => {
    expect(collectedInKindWords(stats({ lifetimeCollected: 12000, collectedInKind: 1596 }))).toBe('$12,000.00 collected, $1,596.00 of it in kind')
  })
  it('leaves a customer who paid in money alone', () => {
    expect(collectedInKindWords(stats({ collectedInKind: 0 }))).toBeNull()
  })
})

describe('openBalanceInKindChip', () => {
  it('reads all of an in-kind balance as scheduled', () => {
    expect(openIsAllInKind(stats())).toBe(true)
    expect(openBalanceInKindChip(stats())).toEqual({ label: 'scheduled in kind, none late', tone: 'green' })
  })
  it('names the part scheduled when other money is open and none of it is late', () => {
    expect(openIsAllInKind(stats({ openBalance: 10000 }))).toBe(false)
    expect(openBalanceInKindChip(stats({ openBalance: 10000 }))).toEqual({ label: '$9,375.40 scheduled in kind, none 30+ days', tone: 'green' })
  })
  it('leaves the page’s chip when a bill that is not in kind is late', () => {
    expect(openBalanceInKindChip(stats({ openBalance: 10000, aging: { count30_90: 1, count90: 0 } }))).toBeNull()
    expect(openBalanceInKindChip(stats({ openBalance: 10000, aging: { count30_90: 0, count90: 2 } }))).toBeNull()
  })
  it('says nothing for a customer with no deal', () => {
    expect(openBalanceInKindChip(stats({ scheduledInKind: 0 }))).toBeNull()
    expect(openIsAllInKind(stats({ scheduledInKind: 0, openBalance: 0 }))).toBe(false)
  })
})

describe('paysInInKindWords', () => {
  it('explains a missing pay speed', () => {
    expect(paysInInKindWords(false, stats())).toBe('paid in kind, so there is no pay speed')
    expect(paysInInKindWords(true, stats())).toBe('in kind payments are left out')
    expect(paysInInKindWords(false, stats({ collectedInKind: 0 }))).toBeNull()
  })
})
