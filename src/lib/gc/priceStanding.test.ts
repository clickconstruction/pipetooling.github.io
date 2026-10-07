/**
 * The tests of `gcPriceStanding.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the Board's B2-i). The data is `schedule/testState.ts`. The tests that play the
 * prototype's reducer or read another lane stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { proposalTotals } from './bids'
import { aboutMoney, priceStanding } from './priceStanding'
import { initialGcState } from './schedule/testState'
import type { GcState } from './types'

const projectOf = (s: GcState, id: string) => {
  const p = s.projects.find((x) => x.id === id)
  if (!p) throw new Error(`no ${id}`)
  return p
}

describe('where the price stands', () => {
  it('Boerne: 4 holes by next step, and about $1.42M once every trade is in', () => {
    const s = initialGcState()
    const p = priceStanding(s, projectOf(s, 'boerne'))
    expect(p.rows.map((r) => [r.standing, r.pkg.trade, r.estimate ?? r.carried])).toEqual([
      ['pick', 'HVAC', 144_000],
      ['pick', 'Electrical', 180_000],
      ['waiting', 'Structural steel', 164_000],
      ['notAsked', 'Fire sprinkler', 44_000],
      ['gap', 'Roofing', 112_300],
      ['real', 'Sitework', 184_900],
      ['real', 'Concrete', 219_800],
      ['real', 'Plumbing', 86_400],
    ])
    expect(p.holes).toBe(4)
    expect(Math.round(p.soFar)).toBe(824_733)
    expect(Math.round(p.likely)).toBe(1_416_530)
    expect(aboutMoney(p.likely)).toBe('about $1.42M')
    // The pieces add up to the price so far, the one the board shows.
    expect(Math.round(p.trades + p.generalConditions + p.markups)).toBe(Math.round(proposalTotals(projectOf(s, 'boerne')).price))
  })

  it('says what happens next on each, in plain words', () => {
    const s = initialGcState()
    const words = Object.fromEntries(priceStanding(s, projectOf(s, 'boerne')).rows.map((r) => [r.pkg.trade, r.words]))
    expect(words).toMatchObject({
      HVAC: 'Kendall Air is lowest of 2. Cool Breeze Mechanical is $148,900.',
      Electrical: 'Voltage Brothers is lowest of 2. Brightline Electric is $182,500. Tejas Power opened it and has not quoted.',
      'Structural steel': 'Bexar Steel Erectors has not opened it. Comal Iron said no. Quotes are due Thu Oct 8. Our budget is shown.',
      'Fire sprinkler': 'No company asked yet. Our budget is shown.',
      Roofing: 'Summit Roofing leaves out roof curbs. No cost set yet, so it counts as $0.',
      Sitework: '',
    })
  })

  it('names who to follow up with on a trade waiting on an answer', () => {
    const s = initialGcState()
    const steel = priceStanding(s, projectOf(s, 'boerne')).rows.find((r) => r.pkg.trade === 'Structural steel')
    expect(steel?.followUp).toEqual({ partnerId: 'bexar', company: 'Bexar Steel Erectors' })
  })

  it('agrees with the red chip: 3 real, 1 missing a cost, 4 with no number', () => {
    const s = initialGcState()
    const { counts } = priceStanding(s, projectOf(s, 'boerne'))
    expect([counts.real, counts.gap, counts.pick + counts.waiting + counts.notAsked + counts.ownBid]).toEqual([3, 1, 4])
  })

  it('Pad B: nobody asked for sitework or concrete; about $395,800 at budget', () => {
    const s = initialGcState()
    const p = priceStanding(s, projectOf(s, 'padb'))
    expect(p.rows.map((r) => [r.standing, r.pkg.trade])).toEqual([
      ['notAsked', 'Sitework'],
      ['notAsked', 'Concrete'],
      ['real', 'Plumbing'],
    ])
    expect(Math.round(p.likely)).toBe(395_766)
    expect(aboutMoney(p.likely)).toBe('about $395,800')
  })
})
