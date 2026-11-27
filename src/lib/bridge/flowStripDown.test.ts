import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { STRIP_MIN_THICK, buildFlowStrip } from './flowStrip'
import { buildBidWins, buildMarketWorth } from './bidWins'
import { buildEstimateWins } from './estimateWins'
import { DIRECTION_KEEPS_MARGIN, STRIP_DOWN_LEGEND, STRIP_DOWN_MARKET_PRESS, feederDirection, layoutFlowStripDown, marketDetailBlocks, pileDirection, stripDownDirections, stripDownLabel, stripDownLines, stripDownWords, withMarketWorth } from './flowStripDown'
import type { StageFlow, StageFlowInput, StageId, StageReading } from './stageFlow'

// Made-up paces and piles.
const stage = (id: StageId, name: string, weeks: number | null): StageReading => ({ id, name, object: '', action: '', readable: true, pile: { headline: '', sub: [], usd: null, guessShare: 0 }, flow: [], paceUsd: null, weeks, weeksText: '', badge: '', tone: 'plain', isLink: false })
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
  it('says each step’s pace as a phrase, and names the narrowest step', () => {
    expect(stripDownLines(section(strip, 'bill'))).toEqual({ title: 'Bill, the narrowest step', pace: 'billed $19k a week', weeks: '8 weeks wait' })
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
    // Sales is now the widest, and Market a quarter of it: a quarter of the width.
    expect(section(sized, 'sales').thick).toBe(1)
    expect(section(sized, 'market').thick).toBeCloseTo(0.25, 6)
    for (const s of sized.sections) {
      expect(s.thick).toBeGreaterThanOrEqual(STRIP_MIN_THICK)
      expect(s.thick).toBeLessThanOrEqual(1)
    }
  })

  it('says the same amount to a screen reader as to the eye', () => {
    const sized = withMarketWorth(strip, 9_000)
    expect(section(sized, 'market').label).toBe('Market. Worth $9k a week.')
    expect(section(withMarketWorth(buildFlowStrip(flow('market'), paces), 9_000), 'market').label).toBe('Market. Worth $9k a week. The narrowest step.')
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
    expect(stripDownWords(strip, null)).toEqual([STRIP_DOWN_LEGEND, 'Market', 'bid $160k a week', 'Sales', 'sold $36k a week', 'Build', 'built $33k a week', '4 weeks wait', 'Bill, the narrowest step', 'billed $19k a week', '8 weeks wait', 'Collect', 'paid $26k a week', '3 weeks wait'])
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

describe('each row’s direction (punch list #321, PR 1)', () => {
  // The card's made-up week: the field builds more than Sales sells, so Build's pile shrinks while Collect's grows.
  const week: StageFlowInput = {
    market: { bidsInvited: 12, bidsInvitedUsd: 400_000, estimatesRequested: 20, estimatesRequestedUsd: 90_000, weeks: 8, worth: { perWeekUsd: 34_000, bidsPerWeekUsd: 20_000, estimatesPerWeekUsd: 14_000 } },
    sales: { bids: { sentUsd: 300_000, wonUsd: 80_000, lostUsd: 120_000 }, estimates: { sentUsd: 70_000, wonUsd: 40_000, lostUsd: 10_000 }, awaiting: { bids: 4, bidsUsd: 100_000, estimates: 3, estimatesUsd: 20_000 }, soldPerWeekUsd: 30_000 },
    build: { pileUsd: 352_000, pileCount: 20, inPerWeekUsd: 30_000, outPerWeekUsd: 44_000, knownJobs: 20, guessUsd: 0, guessJobs: 0 },
    bill: { pileUsd: 46_000, pileCount: 3, inPerWeekUsd: 44_000, outPerWeekUsd: 46_000 },
    collect: { pileUsd: 217_000, pileCount: null, inPerWeekUsd: 46_000, outPerWeekUsd: 31_000, lateCount: 9 },
    fieldPerWeekUsd: 44_000,
    heldLinkId: null,
  }

  it('says which way each pile is heading, and how far each feeder runs from the field', () => {
    expect(stripDownDirections(week)).toEqual({
      market: { text: '$10k a week short of the field.', tone: 'short' },
      sales: { text: '$14k a week short of the field.', tone: 'short' },
      build: { text: 'Shrinks $14k a week.', tone: 'shrinks' },
      bill: { text: 'Keeps up.', tone: 'keeps' },
      collect: { text: 'Grows $15k a week.', tone: 'grows' },
    })
  })

  it('reads two paces within a twentieth of each other as keeping up, and a wider gap as a trend', () => {
    expect(DIRECTION_KEEPS_MARGIN).toBe(0.05)
    expect(pileDirection({ pileUsd: 50_000, inPerWeekUsd: 40_000, outPerWeekUsd: 42_000 })).toEqual({ text: 'Keeps up.', tone: 'keeps' })
    expect(pileDirection({ pileUsd: 50_000, inPerWeekUsd: 40_000, outPerWeekUsd: 43_000 })).toEqual({ text: 'Shrinks $3k a week.', tone: 'shrinks' })
    expect(pileDirection({ pileUsd: 50_000, inPerWeekUsd: 43_000, outPerWeekUsd: 40_000 })).toEqual({ text: 'Grows $3k a week.', tone: 'grows' })
    expect(feederDirection(42_000, 44_000)).toEqual({ text: 'Keeps up with the field.', tone: 'keeps' })
    expect(feederDirection(48_000, 44_000)).toEqual({ text: '$4k a week ahead of the field.', tone: 'ahead' })
  })

  it('calls a step that clears more than it is fed, with nothing waiting, keeping up', () => {
    expect(pileDirection({ pileUsd: 0, inPerWeekUsd: 20_000, outPerWeekUsd: 40_000 })).toEqual({ text: 'Keeps up.', tone: 'keeps' })
    // A pile that is empty today still grows when more comes in than goes out.
    expect(pileDirection({ pileUsd: 0, inPerWeekUsd: 40_000, outPerWeekUsd: 20_000 })).toEqual({ text: 'Grows $20k a week.', tone: 'grows' })
  })

  it('says nothing for a step with no pace to read, and nothing for a feeder until the field reads', () => {
    expect(pileDirection({ pileUsd: 50_000, inPerWeekUsd: 0, outPerWeekUsd: 0 })).toBeNull()
    expect(feederDirection(30_000, null)).toBeNull()
    expect(feederDirection(null, 44_000)).toBeNull()
    expect(feederDirection(30_000, 0)).toBeNull()
    expect(stripDownDirections({ ...week, build: null, bill: null, collect: null, fieldPerWeekUsd: null })).toEqual({})
  })

  it('says nothing for Market until its worth is read, since the dollars bid are not on the field’s scale', () => {
    const unread = stripDownDirections({ ...week, market: { ...week.market!, worth: null } })
    expect(unread.market).toBeUndefined()
    expect(unread.sales).toEqual({ text: '$14k a week short of the field.', tone: 'short' })
  })

  it('keeps every sentence to plain words', () => {
    const lines = [
      ...Object.values(stripDownDirections(week)),
      pileDirection({ pileUsd: 0, inPerWeekUsd: 20_000, outPerWeekUsd: 40_000 }),
      feederDirection(42_000, 44_000),
      feederDirection(48_000, 44_000),
    ]
    for (const d of lines) expect(plainWordsFailures(d!.text), d!.text).toEqual([])
  })

  it('prints each direction under its row, and the press says it to a screen reader', () => {
    const directions = stripDownDirections(week)
    const words = stripDownWords(strip, null, directions)
    expect(words.slice(1)).toEqual(['Market', 'bid $160k a week', '$10k a week short of the field.', 'Sales', 'sold $36k a week', '$14k a week short of the field.', 'Build', 'built $33k a week', '4 weeks wait', 'Shrinks $14k a week.', 'Bill, the narrowest step', 'billed $19k a week', '8 weeks wait', 'Keeps up.', 'Collect', 'paid $26k a week', '3 weeks wait', 'Grows $15k a week.'])
    // Without directions the pipe prints what it did.
    expect(stripDownWords(strip, null)).toEqual(stripDownWords(strip, null, {}))
    expect(stripDownLabel(section(strip, 'bill'), directions.bill)).toBe('Bill. $19k billed a week. 8 weeks of work wait in front of it. The narrowest step. Keeps up. Open its desk.')
    expect(stripDownLabel(section(strip, 'sales'), undefined)).toBe('Sales. $36k sold a week. Open its desk.')
  })
})
