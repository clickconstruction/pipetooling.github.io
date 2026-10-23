import { describe, expect, it } from 'vitest'
import type { TradeBench } from '../gc/bench'
import {
  BOOK_TRADES,
  NEEDS_RULE,
  benchLineParts,
  bestDoor,
  bookChipWords,
  dueWords,
  dueWordsOn,
  gcBenchInput,
  gcNeeds,
  needsHeadWords,
  quotesWords,
  tradePartnersHref,
  type GcBenchIn,
} from './gcNeeds'

const ask = (over: Partial<GcBenchIn['asks'][number]>): GcBenchIn['asks'][number] => ({
  projectId: 'p1',
  projectName: 'Comal ISD field house',
  bids: 0,
  short: 2,
  bidDue: '2026-10-28',
  daysLeft: 5,
  asked: 1,
  unasked: 2,
  ...over,
})

const benches: GcBenchIn[] = [
  // Deep and quiet: three answer, no ask out.
  { trade: 'Concrete', onBench: 3, dependable: 3, asks: [] },
  // Two asks short, one of them due later.
  {
    trade: 'Electrical',
    onBench: 3,
    dependable: 2,
    asks: [ask({ projectId: 'p2', projectName: 'Boerne dental build-out', bids: 1, short: 1, bidDue: '2026-11-06', daysLeft: 14, unasked: 0 }), ask({})],
  },
  // One ask short, everyone asked.
  { trade: 'HVAC', onBench: 2, dependable: 2, asks: [ask({ bids: 1, short: 1, asked: 2, unasked: 0 })] },
  // An ask fully quoted: not short, so the trade sits with the bench rows.
  { trade: 'Fire sprinkler', onBench: 1, dependable: 1, asks: [ask({ bids: 2, short: 0, unasked: 0 })] },
  // No company does it, but a project asks: a row with nobody on the bench.
  { trade: 'Roofing', onBench: 0, dependable: 0, asks: [ask({ projectId: 'p3', projectName: 'Kyle warehouse', bidDue: null, daysLeft: null, asked: 0, unasked: 0 })] },
  // Our own trade never shows.
  { trade: 'Plumbing', onBench: 0, dependable: 0, asks: [ask({ bids: 0, short: 2 })] },
]

type Sub = { trades: string[] | null; prospect_fit_status: string | null }
const subs: Sub[] = [
  { trades: ['Electrical'], prospect_fit_status: null },
  { trades: ['hvac', 'Pool'], prospect_fit_status: null },
  { trades: ['HVAC'], prospect_fit_status: null },
  { trades: ['HVAC'], prospect_fit_status: 'converted' },
  { trades: ['Fire sprinkler'], prospect_fit_status: null },
  { trades: null, prospect_fit_status: null },
]

describe('gcNeeds: the rows', () => {
  const out = gcNeeds(benches, subs, ['Plumbing'])

  it('puts the trades short of quotes first, soonest due first, then the bench by its gap, deep trades last', () => {
    expect(out.rows.map((r) => [r.trade, r.why])).toEqual([
      ['Electrical', 'quotes'],
      ['HVAC', 'quotes'],
      ['Roofing', 'quotes'],
      ['Fire sprinkler', 'bench'],
      ['Concrete', 'bench'],
    ])
  })

  it('keeps only the short asks on a row, soonest first, and reads who is not asked on the soonest', () => {
    const electrical = out.rows[0]!
    expect(electrical.asks.map((a) => a.projectName)).toEqual(['Comal ISD field house', 'Boerne dental build-out'])
    expect(electrical.unasked).toBe(2)
    expect(electrical.toCall).toBe(1)
    expect(electrical.benchShort).toBe(1)
    const sprinkler = out.rows[3]!
    expect(sprinkler.asks).toEqual([])
    expect(sprinkler.unasked).toBe(0)
    expect(sprinkler.benchShort).toBe(2)
    expect(sprinkler.toCall).toBe(1)
  })

  it('counts the subs in the queue by trade, case-blind, and never a sub with an outcome', () => {
    expect(out.rows[1]).toMatchObject({ trade: 'HVAC', toCall: 2 })
  })

  it('counts the short asks and the projects they are on', () => {
    expect(out.asksShort).toBe(4)
    expect(out.projectsShort).toBe(3)
  })

  it('folds the book trades nobody does, in the book order, our own trade left out, then the trades only a sub names', () => {
    const names = out.book.map((b) => b.trade)
    expect(names).not.toContain('Plumbing')
    expect(names).not.toContain('Concrete')
    expect(names.slice(0, 3)).toEqual(['Sitework', 'Landscaping', 'Masonry'])
    expect(out.book[out.book.length - 1]).toEqual({ trade: 'Pool', toCall: 1 })
    expect(BOOK_TRADES).toContain('Electrical')
  })

  it('reads the whole book when nothing is on the bench and no project asks', () => {
    const empty = gcNeeds([], [], ['Plumbing'])
    expect(empty.rows).toEqual([])
    expect(empty.book.map((b) => b.trade)).toEqual(BOOK_TRADES.filter((t) => t !== 'Plumbing'))
    expect(empty.asksShort).toBe(0)
  })

  it('reads the bench as tradeBenches gives it, counting the companies not asked on each project', () => {
    const partners = [{ id: 'a' }, { id: 'b' }, { id: 'c' }] as TradeBench['partners']
    const bench = {
      trade: 'Electrical',
      partners,
      dependable: 2,
      short: 2,
      urgency: 6,
      toldAhead: {},
      needs: [
        {
          project: { id: 'p1', name: 'Comal ISD field house', bidDue: '2026-10-28' },
          pkg: { invites: [{ partnerId: 'a' }] },
          bids: 0,
          looking: 0,
          silent: 1,
          passed: 0,
          short: 2,
          daysLeft: 5,
        },
      ],
    } as unknown as TradeBench
    expect(gcBenchInput([bench])).toEqual([
      {
        trade: 'Electrical',
        onBench: 3,
        dependable: 2,
        asks: [{ projectId: 'p1', projectName: 'Comal ISD field house', bids: 0, short: 2, bidDue: '2026-10-28', daysLeft: 5, asked: 1, unasked: 2 }],
      },
    ])
  })
})

describe('gcNeeds: the words', () => {
  it('reads the quotes with a tone', () => {
    expect(quotesWords({ bids: 0, short: 2 })).toEqual({ text: '0 of 2 quotes', tone: 'red' })
    expect(quotesWords({ bids: 1, short: 1 })).toEqual({ text: '1 of 2 quotes', tone: 'amber' })
    expect(quotesWords({ bids: 2, short: 0 })).toEqual({ text: '2 of 2 quotes', tone: 'green' })
  })

  it('reads the due day', () => {
    expect(dueWords(null, null)).toEqual({ text: 'no due day set', tone: 'quiet' })
    expect(dueWords('2026-10-20', -3)).toEqual({ text: 'bids were due Oct 20', tone: 'red' })
    expect(dueWords('2026-10-23', 0)).toEqual({ text: 'due Oct 23, today', tone: 'red' })
    expect(dueWords('2026-10-24', 1)).toEqual({ text: 'due Oct 24, tomorrow', tone: 'red' })
    expect(dueWords('2026-10-28', 5)).toEqual({ text: 'due Oct 28, in 5 days', tone: 'red' })
    expect(dueWords('2026-11-06', 14)).toEqual({ text: 'due Nov 6, in 14 days', tone: 'quiet' })
    expect(dueWordsOn('2026-10-24', '2026-10-23')).toEqual({ text: 'due Oct 24, tomorrow', tone: 'red' })
  })

  it('reads the bench line in parts', () => {
    expect(benchLineParts({ asks: [], onBench: 0, dependable: 0, benchShort: 3, toCall: 0, unasked: 0 })).toEqual(['nobody on the bench', '0 to call here'])
    expect(benchLineParts({ asks: [ask({})], onBench: 3, dependable: 2, benchShort: 1, toCall: 1, unasked: 2 })).toEqual(['3 on the bench, 2 answer', '2 not asked yet', '1 to call here'])
    expect(benchLineParts({ asks: [ask({})], onBench: 1, dependable: 1, benchShort: 2, toCall: 0, unasked: 0 })).toEqual(['1 on the bench', 'everyone asked', '0 to call here'])
    expect(benchLineParts({ asks: [], onBench: 1, dependable: 1, benchShort: 2, toCall: 1, unasked: 0 })).toEqual(['1 on the bench', 'wants 2 more', '1 to call here'])
    expect(benchLineParts({ asks: [], onBench: 3, dependable: 3, benchShort: 0, toCall: 0, unasked: 0 })).toEqual(['3 on the bench', 'deep enough', '0 to call here'])
  })

  it('picks the best door in the owner’s order: the bench, then the subs here, then Add a sub', () => {
    expect(bestDoor({ asks: [ask({})], toCall: 3, unasked: 2 })).toBe('ask')
    expect(bestDoor({ asks: [ask({})], toCall: 3, unasked: 0 })).toBe('call')
    expect(bestDoor({ asks: [], toCall: 0, unasked: 0 })).toBe('add')
    expect(bestDoor({ asks: [], toCall: 2, unasked: 0 })).toBe('call')
  })

  it('reads the head line and the rule', () => {
    expect(needsHeadWords({ asksShort: 4, projectsShort: 3 })).toBe('4 asks short of quotes on 3 projects')
    expect(needsHeadWords({ asksShort: 1, projectsShort: 1 })).toBe('1 ask short of quotes on 1 project')
    expect(needsHeadWords({ asksShort: 0, projectsShort: 0 })).toBe('no ask is short of quotes')
    expect(NEEDS_RULE).toBe('2 quotes on every ask, 3 a trade on the bench')
  })

  it('reads a chip and the door to Trade partners', () => {
    expect(bookChipWords({ trade: 'Pool', toCall: 1 })).toBe('Pool · 1 to call')
    expect(bookChipWords({ trade: 'Masonry', toCall: 0 })).toBe('Masonry')
    expect(tradePartnersHref('Fire sprinkler')).toBe('/gc?view=partners&trade=Fire%20sprinkler')
  })
})
