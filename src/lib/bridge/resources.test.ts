import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { buildResources, type ResourcesInput } from './resources'

const base: ResourcesInput = {
  linkId: 'bill',
  pendingHours: 585,
  pendingSessions: 104,
  unpricedJobs: 6,
  noPctJobs: 6,
  unsortedBankRows: 1151,
  bidsNoValue: 0,
  bankUsd: 390,
  bankSynced: true,
  lowestUsd: -16_300,
  lowestLabel: 'Oct 12',
  floorUsd: 5000,
  clearsFloor: false,
  fieldPeople: 7,
  fieldHours7d: 317,
  billers: 1,
}

describe('buildResources', () => {
  it('reads the three resources against the link', () => {
    const [decision, capital, talent] = buildResources(base)
    expect(decision!.gauge).toBe('4 piles on you')
    expect(decision!.oneLine).toBe('585h to approve, 6 prices, 6 percents, 1,151 bank rows; prices and bank sorting slow the biller')
    expect(decision!.badge).toBe('throttles the link')
    expect(capital!.gauge).toBe('$390 in the bank')
    expect(capital!.oneLine).toBe('lowest point −$16.3k on Oct 12 against a $5k floor; red, but the symptom of Bill and Collect')
    expect(capital!.tone).toBe('red')
    expect(capital!.badge).toBe('symptom of the link')
    expect(talent!.gauge).toBe('7 in the field · 1 billing')
    expect(talent!.badge).toBe('throttles the link')
    expect(talent!.oneLine).toBe('the field is staffed, 317h this week; billing is one person with other work on her desk')
  })
  it('reads clear piles, a cleared floor and a staffed office', () => {
    const [decision, capital, talent] = buildResources({ ...base, pendingHours: 0, unpricedJobs: 0, noPctJobs: 0, unsortedBankRows: 0, bankUsd: 80_000, lowestUsd: 42_000, clearsFloor: true, billers: 2 })
    expect(decision!.gauge).toBe('nothing waits on you')
    expect(decision!.badge).toBe('not short')
    expect(capital!.tone).toBe('green')
    expect(capital!.oneLine).toContain('clears the floor')
    expect(talent!.badge).toBe('not short')
  })
  it('reads one biller from the bills when the sends carry no sender', () => {
    const [, , talent] = buildResources({ ...base, billers: 0, billsWithoutSender: 12 })
    expect(talent!.gauge).toBe('7 in the field · 1 billing, by the bills')
    expect(talent!.badge).toBe('throttles the link')
    expect(buildResources({ ...base, billers: 0, billsWithoutSender: 0 })[2]!.gauge).toBe('7 in the field · 0 billing')
  })
  it('keeps the lines in plain words', () => {
    for (const r of buildResources(base)) for (const t of [r.kind, r.action]) expect(plainWordsFailures(t), t).toEqual([])
  })
})
