import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { STRIP_LEGEND, STRIP_MIN_THICK, buildFlowStrip, layoutFlowStrip, stripWords } from './flowStrip'
import type { StageFlow, StageId, StageReading } from './stageFlow'

// Made-up paces and piles.
const stage = (id: StageId, name: string, weeks: number | null): StageReading => ({ id, name, object: '', action: '', readable: true, pile: { headline: '', sub: [], usd: null, guessShare: 0 }, flow: [], weeks, weeksText: '', badge: '', tone: 'plain', isLink: false })
const flow = (linkId: StageId | null, weeks: Partial<Record<StageId, number | null>> = { build: 4.2, bill: 7.5, collect: 2.6 }): StageFlow => ({
  stages: [stage('market', 'Market', null), stage('sales', 'Sales', null), stage('build', 'Build', weeks.build ?? null), stage('bill', 'Bill', weeks.bill ?? null), stage('collect', 'Collect', weeks.collect ?? null)],
  linkId,
  nominatedId: linkId,
  heldStands: false,
  pairId: null,
})
const paces = { market: 44_000, sales: 36_000, build: 33_000, bill: 19_000, collect: 26_000 }

describe('buildFlowStrip', () => {
  it('draws the five steps in order, each with its pace, and lights the page’s slowest step', () => {
    const strip = buildFlowStrip(flow('bill'), paces)
    expect(strip.sections.map((s) => s.name)).toEqual(['Market', 'Sales', 'Build', 'Bill', 'Collect'])
    expect(strip.sections.map((s) => s.paceText)).toEqual(['$44k asked', '$36k sold', '$33k built', '$19k billed', '$26k paid'])
    expect(strip.sections.map((s) => s.lit)).toEqual([false, false, false, true, false])
    expect(strip.litId).toBe('bill')
    expect(strip.label).toBe('The five steps as one pipe. Bill is lit.')
  })

  it('says worth on Market once its pace is what the asks are worth, to the eye and to a screen reader (#318)', () => {
    const strip = buildFlowStrip(flow('bill'), { ...paces, market: 29_000 }, { marketIsWorth: true })
    const market = strip.sections[0]!
    expect(market.paceText).toBe('$29k worth')
    expect(market.label).toBe('Market. Worth $29k a week.')
    // The other four keep their words, and without the flag Market keeps asked.
    expect(strip.sections.slice(1).map((s) => s.paceText)).toEqual(['$36k sold', '$33k built', '$19k billed', '$26k paid'])
    expect(buildFlowStrip(flow('bill'), paces).sections[0]!.label).toBe('Market. $44k asked a week.')
    expect(plainWordsFailures(market.label)).toEqual([])
  })

  it('sizes a section the way pipe is sized: four times the flow is twice as wide', () => {
    const strip = buildFlowStrip(flow('bill'), { market: 40_000, sales: 10_000, build: 40_000, bill: 40_000, collect: 40_000 })
    const [market, sales] = strip.sections
    expect(market?.thick).toBe(1)
    // A quarter of the flow is half the width, over the floor every section keeps.
    expect(sales?.thick).toBeCloseTo(STRIP_MIN_THICK + (1 - STRIP_MIN_THICK) * 0.5, 6)
    // The widest step is 1, and none is thinner than the floor.
    for (const s of buildFlowStrip(flow('bill'), paces).sections) {
      expect(s.thick).toBeGreaterThanOrEqual(STRIP_MIN_THICK)
      expect(s.thick).toBeLessThanOrEqual(1)
    }
  })

  it('puts a block of waiting work on the three steps that hold a pile, the tallest on the most weeks', () => {
    const strip = buildFlowStrip(flow('bill'), paces)
    const by = Object.fromEntries(strip.sections.map((s) => [s.id, s]))
    expect(by.market?.pile).toBe(0)
    expect(by.sales?.pile).toBe(0)
    expect(by.bill?.pile).toBe(1)
    expect(by.build?.pile).toBeCloseTo(4.2 / 7.5, 6)
    expect(by.bill?.weeksText).toBe('8 weeks wait')
    expect(by.build?.weeksText).toBe('4 weeks wait')
    expect(by.market?.weeksText).toBe('')
    // Under a week says nothing, and one week reads without an s.
    const thin = Object.fromEntries(buildFlowStrip(flow('bill', { build: 0.3, bill: 1.2, collect: null }), paces).sections.map((s) => [s.id, s]))
    expect(thin.build?.weeksText).toBe('')
    expect(thin.bill?.weeksText).toBe('1 week waits')
    expect(thin.bill?.label).toBe('Bill. $19k billed a week. 1 week of work waits in front of it. The slowest step.')
    expect(thin.collect?.pile).toBe(0)
    // A pile past the cap is drawn at full height, and no taller.
    expect(buildFlowStrip(flow('build', { build: 40, bill: 6, collect: 3 }), paces).sections.find((s) => s.id === 'build')?.pile).toBe(1)
  })

  it('lights the page’s reading even when another step is narrower, and says so for a screen reader', () => {
    // Sales moves the least, and Build has the most weeks waiting: the page lights Build.
    const strip = buildFlowStrip(flow('build', { build: 7.4, bill: 2, collect: 3 }), { market: 234_000, sales: 14_000, build: 38_300, bill: 30_000, collect: 42_000 })
    const by = Object.fromEntries(strip.sections.map((s) => [s.id, s]))
    expect(by.build?.lit).toBe(true)
    expect(by.sales?.thick).toBeLessThan(by.build?.thick ?? 0)
    expect(by.build?.label).toBe('Build. $38.3k built a week. 7 weeks of work wait in front of it. The slowest step.')
    expect(by.sales?.label).toBe('Sales. $14k sold a week.')
  })

  it('draws a step that does not read at the thinnest, and lights nothing when nothing reads', () => {
    const strip = buildFlowStrip(flow(null, { build: null, bill: null, collect: null }), { market: null, sales: 0, build: 33_000 })
    expect(strip.sections.map((s) => s.paceText)).toEqual(['not read', 'not read', '$33k built', 'not read', 'not read'])
    expect(strip.sections[0]?.thick).toBe(STRIP_MIN_THICK)
    expect(strip.sections[0]?.label).toBe('Market. Not read yet.')
    expect(strip.litId).toBeNull()
    expect(strip.label).toBe('The five steps as one pipe.')
  })

  it('writes plain words, and fewer of them on a phone', () => {
    const strip = buildFlowStrip(flow('bill'), paces)
    for (const s of strip.sections) for (const w of [s.label, s.paceText, s.weeksText]) expect(plainWordsFailures(w), w).toEqual([])
    expect(plainWordsFailures(strip.label)).toEqual([])
    // A desk prints every block's weeks; a phone prints the lit step's alone.
    expect(stripWords(strip, false).filter((w) => /weeks? wait/.test(w))).toEqual(['4 weeks wait', '8 weeks wait', '3 weeks wait'])
    expect(stripWords(strip, true).filter((w) => /weeks? wait/.test(w))).toEqual(['8 weeks wait'])
    // The legend says the unit; at a desk it also says what a block is.
    expect(stripWords(strip, true)[0]).toBe('Dollars a week.')
    expect(stripWords(strip, false)[0]).toBe('Dollars a week. A block is work waiting in front of a step.')
    for (const w of [STRIP_LEGEND.short, STRIP_LEGEND.long]) expect(plainWordsFailures(w), w).toEqual([])
    // What a phone's first screen takes on: twenty one words and six numbers at most.
    const phone = stripWords(strip, true).join(' ')
    expect(phone.split(/\s+/).length).toBeLessThanOrEqual(21)
    expect((phone.match(/\$?\d[\d,.]*\s?(k|M|h|%)?/g) ?? []).length).toBeLessThanOrEqual(6)
  })
})

describe('layoutFlowStrip', () => {
  const strip = buildFlowStrip(flow('bill'), paces)
  const box = { width: 100, pile: 16, pipe: 30, joint: 3 }

  it('is one outline around five flat runs, each inside its fifth of the width', () => {
    const l = layoutFlowStrip(strip.sections, box)
    expect(l.height).toBe(46)
    expect(l.points.split(' ').length).toBe(20)
    expect(l.cells.map((c) => c.id)).toEqual(['market', 'sales', 'build', 'bill', 'collect'])
    l.cells.forEach((c, i) => {
      expect(c.x).toBeGreaterThanOrEqual(i * 20)
      expect(c.x + c.width).toBeLessThanOrEqual((i + 1) * 20 + 0.001)
    })
    // The ends run to the edge; the joints between leave room for the taper.
    expect(l.cells[0]?.x).toBe(0)
    expect(l.cells[4]?.x).toBe(81.5)
    expect((l.cells[4]?.x ?? 0) + (l.cells[4]?.width ?? 0)).toBe(100)
  })

  it('centres the pipe, widest at the fastest step, and sets each block on top of its section', () => {
    const l = layoutFlowStrip(strip.sections, box)
    const [market, , , bill] = l.cells
    // Market is the widest: it fills the pipe's height.
    expect(market?.top).toBe(16)
    expect(market?.bottom).toBe(46)
    for (const c of l.cells) expect((c.top + c.bottom) / 2).toBeCloseTo(31, 1)
    expect(market?.block).toBeNull()
    // Bill holds the tallest pile: its block stands on the pipe and stays inside the drawing.
    expect(bill?.block).not.toBeNull()
    expect((bill?.block?.y ?? 0) + (bill?.block?.height ?? 0)).toBeCloseTo((bill?.top ?? 0) - 1, 1)
    expect(bill?.block?.y).toBeGreaterThanOrEqual(0)
  })
})
