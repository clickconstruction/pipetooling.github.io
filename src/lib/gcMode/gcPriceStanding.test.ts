/**
 * GC mode — design spike: where a bidding job's price stands (gcPriceStanding.ts), the card behind
 * the board's "so far, with holes" (the owner's pick B, 2026-10-04). Boerne Retail Shell has four
 * holes, two of them one click from filled; Pad B has two nobody was asked for.
 */
import { describe, expect, it } from 'vitest'
import { aboutMoney, gcReducer, initialGcState, priceStanding, proposalTotals, type GcState } from './gcModel'

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

  it("the card's Carry button fills a hole: HVAC at Kendall Air moves into the price", () => {
    const s = initialGcState()
    const before = priceStanding(s, projectOf(s, 'boerne'))
    const kendall = before.rows.find((r) => r.pkg.trade === 'HVAC')?.lowest?.invite.id
    if (!kendall) throw new Error('no lowest HVAC quote')
    const after = gcReducer(s, { type: 'carry', projectId: 'boerne', packageId: 'hvac', carried: kendall })
    const p = priceStanding(after, projectOf(after, 'boerne'))
    expect(p.rows.find((r) => r.pkg.trade === 'HVAC')).toMatchObject({ standing: 'real', carried: 144_000, company: 'Kendall Air' })
    expect(p.holes).toBe(3)
    // The estimate was the quote, so once every trade is in it does not move.
    expect(Math.round(p.likely)).toBe(Math.round(before.likely))
  })

  it("Use our budget turns a hole into our guess, priced in", () => {
    const s = gcReducer(initialGcState(), { type: 'carry', projectId: 'padb', packageId: 'bsite', carried: 'plug' })
    const p = priceStanding(s, projectOf(s, 'padb'))
    expect(p.rows.find((r) => r.pkg.trade === 'Sitework')).toMatchObject({ standing: 'guess', carried: 96_000, words: 'Carrying our budget. No quote is in yet.' })
    expect(p.holes).toBe(1)
  })
})
