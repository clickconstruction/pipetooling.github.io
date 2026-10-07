/**
 * Main's own tests for the quotes and our number (the Board's B2-i): who quoted, the lowest all in,
 * what is carried and what is a hole, a line with no cost, a quote that ran out or priced older
 * plans, the comparison's sentences, our number's totals, a statement of work's money and the bid
 * tabs, run through the kernels on the test data. The spike's own cases: on Boerne Retail Shell,
 * today Fri Oct 2, sitework and concrete carry quotes, roofing carries Summit's with roof curbs not
 * costed, HVAC and electrical have two quotes each and steel and fire protection none.
 */
import { describe, expect, it } from 'vitest'
import {
  bidIsStale,
  bidTabResult,
  bidTabRows,
  bidTabsOpen,
  bidsIn,
  carriedUncosted,
  compareBids,
  isGuess,
  lowLeveled,
  packageCoverage,
  packageHasTab,
  proposalTotals,
  proposalUncosted,
  proposalUncostedWords,
  quoteRanOut,
  sowMoney,
  uncostedLines,
  uncostedWords,
} from './bids'
import { initialGcState } from './schedule/testState'
import type { GcState } from './types'

const job = (s: GcState, id: string) => s.projects.find((p) => p.id === id)!
const trade = (s: GcState, id: string, pkg: string) => job(s, id).packages.find((k) => k.id === pkg)!

describe('the quotes on a trade', () => {
  it('reads each Boerne trade as carried, our own, waiting, quoted or empty', () => {
    const s = initialGcState()
    expect(job(s, 'boerne').packages.map((k) => [k.id, packageCoverage(k)])).toEqual([
      ['site', 'carried'],
      ['conc', 'carried'],
      ['steel', 'waiting'],
      ['roof', 'carried'],
      ['plumb', 'self'],
      ['hvac', 'bids'],
      ['elec', 'bids'],
      ['fire', 'empty'],
    ])
    expect(packageCoverage(trade(s, 'helotes', 'dry'))).toBe('awarded')
  })

  it('finds the quotes in and the lowest all in, a plug counted for what a quote leaves out', () => {
    const s = initialGcState()
    expect(bidsIn(trade(s, 'boerne', 'hvac')).map((i) => i.id)).toEqual(['hvac-coolbreeze', 'hvac-kendall'])
    const low = lowLeveled(trade(s, 'boerne', 'hvac'))
    expect([low?.invite.id, low?.total]).toEqual(['hvac-kendall', 144000])
    expect(lowLeveled(trade(s, 'boerne', 'steel'))).toBeNull()
  })

  it('names the line a carried quote has no cost for, and says it once', () => {
    const s = initialGcState()
    const roof = trade(s, 'boerne', 'roof')
    expect(uncostedLines(roof, roof.invites[0]!).map((x) => x.label)).toEqual(['Roof curbs'])
    expect(carriedUncosted(roof).map((x) => x.label)).toEqual(['Roof curbs'])
    expect(uncostedWords(carriedUncosted(roof))).toBe('1 line has no cost yet: roof curbs.')
    expect(proposalUncosted(job(s, 'boerne')).map((k) => k.id)).toEqual(['roof'])
    expect(proposalUncostedWords(job(s, 'boerne'))).toBe('In Roofing, 1 line has no cost yet: roof curbs.')
    expect(proposalUncostedWords(job(s, 'padb'))).toBe('')
  })

  it('a quote runs out past its good-for days, and one on older plans asks to be confirmed', () => {
    const s = initialGcState()
    const bid = trade(s, 'boerne', 'roof').invites[0]!.bid!
    expect(quoteRanOut({ ...bid, goodForDays: 5, submittedOn: '2026-09-25' }, s.today)).toBe(true)
    expect(quoteRanOut({ ...bid, goodForDays: 30, submittedOn: '2026-09-25' }, s.today)).toBe(false)
    const hvac = trade(s, 'boerne', 'hvac')
    expect(hvac.invites.filter((i) => bidIsStale(job(s, 'boerne'), hvac, i)).map((i) => i.id)).toEqual(['hvac-coolbreeze'])
  })

  it('our budget carried is a guess, never a real number', () => {
    const s = initialGcState()
    expect(isGuess(trade(s, 'boerne', 'site'))).toBe(false)
    expect(isGuess({ ...trade(s, 'boerne', 'steel'), carried: 'plug' })).toBe(true)
  })
})

describe('compare quotes', () => {
  it('says each quote in a sentence, then who is lowest for the same work', () => {
    const s = initialGcState()
    const hvac = compareBids(s, job(s, 'boerne'), trade(s, 'boerne', 'hvac'))
    expect(hvac.lines.map((l) => l.text)).toEqual([
      'Cool Breeze Mechanical quoted $148,900 and covers everything. They priced an older set of plans, so ask them to confirm.',
      'Kendall Air quoted $139,200 and left out test and balance. Covering that adds $4,800, so they come to $144,000.',
    ])
    expect([hvac.conclusion, hvac.complete]).toEqual(['Kendall Air is lowest for the same work, by $4,900.', true])
  })

  it('a line with no cost leaves the real number unknown, and one quote is not enough', () => {
    const s = initialGcState()
    const roof = compareBids(s, job(s, 'boerne'), trade(s, 'boerne', 'roof'))
    expect(roof.lines[0]!.text).toBe('Summit Roofing quoted $112,300 and left out roof curbs. No cost is set for roof curbs yet, so their real number is not known.')
    expect([roof.conclusion, roof.complete]).toEqual(['One quote only. You want at least 2 to compare.', false])
  })
})

describe('our number', () => {
  it('adds the carried trades, general conditions, contingency and fee, and names the holes', () => {
    const s = initialGcState()
    const boerne = proposalTotals(job(s, 'boerne'))
    expect([boerne.trades, boerne.holes.map((k) => k.id), boerne.generalConditions, boerne.contingency, boerne.fee, boerne.price]).toEqual([
      603400,
      ['steel', 'hvac', 'elec', 'fire'],
      138000,
      22242,
      61091.36,
      824733.36,
    ])
    expect(proposalTotals(job(s, 'helotes')).price).toBe(338767)
  })

  it('reads a statement of work: billed, held, paid and ready to pay', () => {
    const s = initialGcState()
    expect(sowMoney(trade(s, 'fairoaksd', 'fsteel').sow!)).toEqual({ billed: 92000, retainageHeld: 9200, paid: 82800, ready: 88000 })
    expect(sowMoney(trade(s, 'helotes', 'delec').sow!)).toEqual({ billed: 0, retainageHeld: 0, paid: 0, ready: 0 })
  })
})

describe('the bid tabs', () => {
  it('open once our bid is in, low to high, the awarded company marked', () => {
    const s = initialGcState()
    expect([bidTabsOpen(job(s, 'boerne')), bidTabsOpen(job(s, 'helotes'))]).toEqual([false, true])
    expect(job(s, 'helotes').packages.filter(packageHasTab).map((k) => k.id)).toEqual(['delec', 'mill'])
    expect(bidTabRows(s, trade(s, 'helotes', 'delec')).map((r) => [r.company, r.amount, r.rank, r.overLowPct, r.awarded])).toEqual([
      ['Brightline Electric', 56900, 1, 0, true],
      ['Voltage Brothers', 61400, 2, 7.9, false],
    ])
  })

  it('tells each company how the trade went, in its language', () => {
    const s = initialGcState()
    const delec = trade(s, 'helotes', 'delec')
    expect(bidTabResult(job(s, 'helotes'), delec, 'brightline')).toBe('Click won the project. This trade is yours.')
    expect(bidTabResult(job(s, 'helotes'), delec, 'voltage')).toBe('Click won the project. This trade went to another company.')
    expect(bidTabResult(job(s, 'helotes'), delec, 'voltage', 'es')).toBe('Click ganó el proyecto. Esta especialidad fue para otra empresa.')
  })
})
