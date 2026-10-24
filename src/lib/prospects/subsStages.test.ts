import { describe, expect, it } from 'vitest'
import type { GcNeed, GcNeeds } from './gcNeeds'
import {
  NO_TRADE_GROUP,
  SUB_STRIP_SENTENCE,
  callForTradeHref,
  groupHeadWords,
  groupSubsByTrade,
  plansChoiceWords,
  plansChoices,
  rowPress,
  stageCounts,
  stageHref,
  stageTone,
  stageWords,
  subStage,
  type PlansChoice,
  type StageIn,
} from './subsStages'

const inp: StageIn = {
  calledIds: new Set(['b', 'c', 'd']),
  answeredIds: new Set(['c', 'd']),
  quotedCompanyIds: new Set(['co-quoted']),
}

type Row = { id: string; prospect_fit_status: string | null; converted_gc_company_id: string | null; trades: string[] | null }
const a: Row = { id: 'a', prospect_fit_status: null, converted_gc_company_id: null, trades: ['Fire sprinkler'] }
const b: Row = { id: 'b', prospect_fit_status: null, converted_gc_company_id: null, trades: ['Concrete'] }
const c: Row = { id: 'c', prospect_fit_status: null, converted_gc_company_id: null, trades: ['Concrete', 'Sitework'] }
const d: Row = { id: 'd', prospect_fit_status: 'converted', converted_gc_company_id: 'co-new', trades: ['HVAC'] }
const e: Row = { id: 'e', prospect_fit_status: 'converted', converted_gc_company_id: 'co-quoted', trades: ['HVAC'] }
const f: Row = { id: 'f', prospect_fit_status: 'cant_reach', converted_gc_company_id: null, trades: ['Roofing'] }
const g: Row = { id: 'g', prospect_fit_status: 'not_a_fit', converted_gc_company_id: null, trades: null }
const h: Row = { id: 'h', prospect_fit_status: null, converted_gc_company_id: null, trades: ['Masonry'] }

describe('subsStages: the path', () => {
  it('reads each company’s stage from the call log, the landing and the bench’s quotes', () => {
    expect(subStage(a, inp)).toBe('to_call')
    expect(subStage(b, inp)).toBe('called')
    expect(subStage(c, inp)).toBe('talked')
    expect(subStage(d, inp)).toBe('on_bench')
    expect(subStage(e, inp)).toBe('quoted')
    expect(subStage(f, inp)).toBe('cant_reach')
    expect(subStage(g, inp)).toBe('not_a_fit')
  })

  it('counts the strip in path order and folds the exits under it', () => {
    const counts = stageCounts([a, b, c, d, e, f, g, h], inp)
    expect(counts.stages.map((s) => `${s.stage}:${s.n}`)).toEqual(['to_call:2', 'called:1', 'talked:1', 'on_bench:1', 'quoted:1'])
    expect(counts.exits.map((x) => `${x.exit}:${x.n}`)).toEqual(['cant_reach:1', 'not_a_fit:1'])
  })

  it('makes the bench’s two boxes doors to Trade partners and keeps the rest on the page', () => {
    expect(stageHref('on_bench')).toBe('/gc?view=partners')
    expect(stageHref('quoted')).toBe('/gc?view=partners')
    expect(stageHref('talked')).toBeNull()
  })

  it('offers Call now → until someone talks to them, then Add to the bench ✓ beside it, and nothing after', () => {
    expect(rowPress('to_call')).toBe('call')
    expect(rowPress('called')).toBe('call')
    expect(rowPress('talked')).toBe('call_or_bench')
    expect(rowPress('on_bench')).toBeNull()
    expect(rowPress('not_a_fit')).toBeNull()
  })

  it('reads the chip’s words and tone', () => {
    expect(stageWords('to_call')).toBe('To call')
    expect(stageWords('cant_reach')).toBe("Can't reach")
    expect(stageTone('to_call')).toBe('green')
    expect(stageTone('called')).toBe('amber')
    expect(stageTone('talked')).toBe('blue')
    expect(stageTone('quoted')).toBe('violet')
    expect(stageTone('not_a_fit')).toBe('grey')
  })

  it('says what moves a company in plain sentences', () => {
    for (const sentence of SUB_STRIP_SENTENCE.split(/(?<=\.)\s+/)) {
      expect(sentence.split(/\s+/).length).toBeLessThanOrEqual(20)
      expect(sentence).not.toMatch(/[—;()·]/)
    }
  })
})

const projects = [
  { id: 'p1', name: 'Oak Run Clinic', stage: 'bidding', bidDue: '2026-10-30', lostOn: null, packages: [{ id: 'k1', trade: 'Fire sprinkler', ours: false }, { id: 'k2', trade: 'Plumbing', ours: true }, { id: 'k3', trade: 'Concrete', ours: false }, { id: 'k4', trade: 'concrete', ours: false }] },
  { id: 'p2', name: 'Alamo Heights duplex', stage: 'building', bidDue: null, lostOn: null, packages: [{ id: 'k5', trade: 'HVAC', ours: false }] },
  { id: 'p3', name: 'Boerne shell', stage: 'bidding', bidDue: null, lostOn: null, packages: [{ id: 'k6', trade: 'HVAC', ours: false }] },
  { id: 'p4', name: 'Lost one', stage: 'bidding', bidDue: '2026-10-25', lostOn: '2026-10-20', packages: [] },
]

describe('subsStages: the moment a set of plans lands', () => {
  it('lists the projects out for a bid, soonest first, with the trades each buys out and the package behind each', () => {
    const choices = plansChoices(projects, '2026-10-23')
    expect(choices.map((c) => c.id)).toEqual(['p1', 'p3'])
    expect(choices[0]!.trades).toEqual(['Fire sprinkler', 'Concrete'])
    expect(choices[0]!.packageByTrade).toEqual({ 'fire sprinkler': 'k1', concrete: 'k3' })
    expect(choices[0]!.daysLeft).toBe(7)
    expect(choices[1]!.daysLeft).toBeNull()
  })

  it('reads the picker’s line', () => {
    const [p1, p3] = plansChoices(projects, '2026-10-23') as [PlansChoice, PlansChoice]
    expect(plansChoiceWords(p1)).toBe('Oak Run Clinic · bids due in 7 days · 2 trades to buy out')
    expect(plansChoiceWords(p3)).toBe('Boerne shell · no due day · 1 trade to buy out')
    expect(plansChoiceWords({ ...p1, daysLeft: 0 })).toContain('bids due today')
    expect(plansChoiceWords({ ...p1, daysLeft: -2 })).toContain('bids were due')
  })

  it('links a group’s call to the lane filtered on the trade, carrying the project', () => {
    expect(callForTradeHref('Fire sprinkler', 'p1')).toBe('/prospects?tab=follow-up&kind=subs&trade=Fire+sprinkler&for=p1')
    expect(callForTradeHref('Concrete', null)).toBe('/prospects?tab=follow-up&kind=subs&trade=Concrete')
  })
})

const need = (trade: string, over: Partial<GcNeed> = {}): GcNeed => ({ trade, why: 'bench', asks: [], onBench: 1, dependable: 1, benchShort: 2, toCall: 1, unasked: 0, ...over })
const needs: Pick<GcNeeds, 'rows' | 'book'> = {
  rows: [need('Concrete', { why: 'quotes', asks: [{ projectId: 'p1', projectName: 'Oak Run Clinic', bids: 0, short: 2, bidDue: '2026-10-30', daysLeft: 7, asked: 1, unasked: 0 }] }), need('HVAC')],
  book: [
    { trade: 'Fire sprinkler', toCall: 1 },
    { trade: 'Sitework', toCall: 1 },
  ],
}

describe('subsStages: the list by trade', () => {
  it('groups the lane in the panel’s order, a two-trade sub in both groups, no trade apart', () => {
    const { groups, noTrade } = groupSubsByTrade([a, b, c, g, h], needs, null)
    expect(groups.map((x) => x.trade)).toEqual(['Concrete', 'HVAC', 'Fire sprinkler', 'Sitework', 'Masonry'])
    expect(groups[0]!.subs.map((s) => s.id)).toEqual(['b', 'c'])
    expect(groups[3]!.subs.map((s) => s.id)).toEqual(['c'])
    expect(groups[4]!.need).toBeNull()
    expect(noTrade.map((s) => s.id)).toEqual(['g'])
  })

  it('brings the picked project’s trades first and lights them', () => {
    const { groups } = groupSubsByTrade([a, b, c, h], needs, ['Fire sprinkler', 'concrete'])
    expect(groups.map((x) => `${x.trade}${x.lit ? '*' : ''}`)).toEqual(['Concrete*', 'Fire sprinkler*', 'HVAC', 'Sitework', 'Masonry'])
  })

  it('reads a group’s head: the project when lit, the bench’s line, the asks short', () => {
    const { groups } = groupSubsByTrade([a, b], needs, ['Concrete'])
    expect(groupHeadWords(groups[0]!, 'Oak Run Clinic')).toBe('for Oak Run Clinic · 1 on the bench, wants 2 more · an ask short of quotes')
    expect(groupHeadWords(groups.find((x) => x.trade === 'Fire sprinkler')!, null)).toBe('nobody on the bench')
    expect(groupHeadWords({ need: need('X', { onBench: 0 }), book: null, lit: false }, null)).toBe('nobody on the bench')
    expect(NO_TRADE_GROUP).toBe('No trade named yet')
  })
})
