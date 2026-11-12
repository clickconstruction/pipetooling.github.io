import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { STRIP_MIN_THICK, buildFlowStrip } from './flowStrip'
import { buildBidWins, buildMarketWorth } from './bidWins'
import { buildEstimateWins } from './estimateWins'
import { STRIP_DOWN_LEGEND, STRIP_DOWN_MARKET_PRESS, layoutFlowStripDown, marketDetailBlocks, stripDownLines, stripDownWords, withMarketWorth } from './flowStripDown'
import type { StageFlow, StageId, StageReading } from './stageFlow'

// Made-up paces and piles.
const stage = (id: StageId, name: string, weeks: number | null): StageReading => ({ id, name, object: '', action: '', readable: true, pile: { headline: '', sub: [], usd: null, guessShare: 0 }, flow: [], weeks, weeksText: '', badge: '', tone: 'plain', isLink: false })
const flow = (linkId: StageId | null): StageFlow => ({
  stages: [stage('market', 'Market', null), stage('sales', 'Sales', null), stage('build', 'Build', 4.2), stage('bill', 'Bill', 7.5), stage('collect', 'Collect', 2.6)],
  linkId,
  nominatedId: linkId,
  heldStands: false,
  pairId: null,
})
const paces = { market: 160_000, sales: 36_000, build: 33_000, bill: 19_000, collect: 26_000 }
const strip = buildFlowStrip(flow('bill'), paces)
const section = (s: ReturnType<typeof buildFlowStrip>, id: StageId) => s.sections.find((x) => x.id === id)!

describe('layoutFlowStripDown', () => {
  it('draws the five sections as one outline running down, each centred on the pipe', () => {
    const box = { row: 60, pipe: 100, joint: 12 }
    const layout = layoutFlowStripDown(strip.sections, box)
    expect(layout.width).toBe(100)
    expect(layout.height).toBe(300)
    expect(layout.cells.map((c) => c.id)).toEqual(['market', 'sales', 'build', 'bill', 'collect'])
    // Two corners a side for every section.
    expect(layout.points.split(' ').length).toBe(20)
    for (const c of layout.cells) expect((c.left + c.right) / 2).toBeCloseTo(50, 1)
    // The widest section fills the pipe, and a taper sits between two sections.
    expect(layout.cells[0]).toMatchObject({ y: 0, height: 54, left: 0, right: 100 })
    expect(layout.cells[1]?.y).toBe(66)
    expect(layout.cells[4]).toMatchObject({ y: 246, height: 54 })
  })
})

describe('stripDownLines', () => {
  it('says each step’s pace as a phrase, and names the slowest step', () => {
    expect(stripDownLines(section(strip, 'bill'))).toEqual({ title: 'Bill, the slowest step', pace: 'billed $19k a week', weeks: '8 weeks wait' })
    expect(stripDownLines(section(strip, 'sales'))).toEqual({ title: 'Sales', pace: 'sold $36k a week', weeks: '' })
  })

  it('uses the owner’s word for Market, bid, until its worth is read', () => {
    expect(stripDownLines(section(strip, 'market')).pace).toBe('bid $160k a week')
  })

  it('says a step that does not read is not read yet', () => {
    const unread = buildFlowStrip(flow(null), { build: 33_000 })
    expect(stripDownLines(section(unread, 'collect')).pace).toBe('not read yet')
  })
})

describe('withMarketWorth', () => {
  it('leaves the pipe as it was until Market’s worth is read', () => {
    expect(withMarketWorth(strip, null)).toBe(strip)
    expect(withMarketWorth(strip, 0)).toBe(strip)
  })

  it('draws Market at what it is worth and sizes every section against the new widest', () => {
    // At the dollars asked Market is far the widest, and the other four are thin beside it.
    expect(section(strip, 'market').thick).toBe(1)
    const sized = withMarketWorth(strip, 9_000)
    expect(section(sized, 'market').paceUsd).toBe(9_000)
    // Sales is now the widest, and Market a quarter of it: half the width, over the floor.
    expect(section(sized, 'sales').thick).toBe(1)
    expect(section(sized, 'market').thick).toBeCloseTo(STRIP_MIN_THICK + (1 - STRIP_MIN_THICK) * 0.5, 6)
    for (const s of sized.sections) {
      expect(s.thick).toBeGreaterThanOrEqual(STRIP_MIN_THICK)
      expect(s.thick).toBeLessThanOrEqual(1)
    }
  })

  it('says the same amount to a screen reader as to the eye', () => {
    const sized = withMarketWorth(strip, 9_000)
    expect(section(sized, 'market').label).toBe('Market. Worth $9k a week.')
    expect(section(withMarketWorth(buildFlowStrip(flow('market'), paces), 9_000), 'market').label).toBe('Market. Worth $9k a week. The slowest step.')
  })

  it('does not move the page’s reading: the lit step and the waiting work stay', () => {
    const sized = withMarketWorth(strip, 9_000)
    expect(sized.litId).toBe('bill')
    expect(sized.sections.map((s) => s.lit)).toEqual(strip.sections.map((s) => s.lit))
    expect(sized.sections.map((s) => s.pile)).toEqual(strip.sections.map((s) => s.pile))
    expect(sized.sections.map((s) => s.weeksText)).toEqual(strip.sections.map((s) => s.weeksText))
  })
})

describe('the standing pipe’s words', () => {
  const market = { perWeekUsd: 9_000, pace: 'worth $9k a week', parts: ['bids $6k at 4% won', 'estimates $3k at 60% won'] }

  it('lists what the pipe prints, with Market’s amount and its two parts once that is read', () => {
    expect(stripDownWords(strip, null)).toEqual([STRIP_DOWN_LEGEND, 'Market', 'bid $160k a week', 'Sales', 'sold $36k a week', 'Build', 'built $33k a week', '4 weeks wait', 'Bill, the slowest step', 'billed $19k a week', '8 weeks wait', 'Collect', 'paid $26k a week', '3 weeks wait'])
    const words = stripDownWords(strip, market)
    expect(words.slice(1, 5)).toEqual(['Market', 'worth $9k a week', 'bids $6k at 4% won', 'estimates $3k at 60% won'])
    expect(words[words.length - 1]).toBe(STRIP_DOWN_MARKET_PRESS)
  })

  it('keeps the legend to plain words', () => {
    expect(plainWordsFailures(STRIP_DOWN_LEGEND)).toEqual([])
  })
})

describe('marketDetailBlocks', () => {
  it('draws the bids’ lines and the estimates’ lines as two blocks, with no line lost or reworded', () => {
    const detail = ['Bids: $150k went out a week over the last 8 weeks.', 'A bid counts as won or lost only when it is marked.', 'Estimates: won by dollars is 60%.', '3 estimates were approved, for $9k.']
    expect(marketDetailBlocks(detail)).toEqual([detail.slice(0, 2), detail.slice(2)])
    expect(marketDetailBlocks(detail).flat()).toEqual(detail)
  })

  it('keeps one block when only one part reads, and none when there is no working', () => {
    expect(marketDetailBlocks(['Bids: $150k went out a week over the last 8 weeks.'])).toEqual([['Bids: $150k went out a week over the last 8 weeks.']])
    expect(marketDetailBlocks(['Estimates: won by dollars is 60%.', '3 estimates were approved, for $9k.'])).toEqual([['Estimates: won by dollars is 60%.', '3 estimates were approved, for $9k.']])
    expect(marketDetailBlocks([])).toEqual([])
  })

  it('splits the working the page’s own builders write, so a change to their opening words fails here', () => {
    // Made-up bids and estimates.
    const bids = buildBidWins({ todayYmd: '2026-03-02', windowStart: '2026-01-05', bids: [{ sentYmd: '2026-02-02', outcome: 'won', usd: 8_000, hasJob: false, jobUsd: null }, { sentYmd: '2026-02-09', outcome: 'lost', usd: 40_000, hasJob: false, jobUsd: null }] })
    const estimates = buildEstimateWins({ todayYmd: '2026-03-02', windowStart: '2026-01-05', estimates: [{ sentYmd: '2026-02-03', status: 'customer_accepted', usd: 2_000, answeredYmd: '2026-02-05' }, { sentYmd: '2026-02-10', status: 'declined', usd: 1_000 }] })
    const blocks = marketDetailBlocks(buildMarketWorth(bids, estimates).detail)
    expect(blocks.map((b) => b[0]?.split(':')[0])).toEqual(['Bids', 'Estimates'])
    expect(blocks[0]).toEqual(bids.detail)
    expect(blocks[1]).toEqual(estimates.detail)
  })
})
