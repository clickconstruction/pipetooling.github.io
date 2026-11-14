import { describe, expect, it } from 'vitest'
import { rateWords, workbenchBars, type WorkbenchBarsInput } from './workbenchBars'

/** The mock-up's bid: sent at $48,700, the book $624 higher today, labor at the default crew rate, $2,100 on four rows with no cost. */
function sentBid(over: Partial<WorkbenchBarsInput> = {}): WorkbenchBarsInput {
  return {
    revenue: 49324,
    sent: { on: '2026-10-21', value: 48700 },
    cost: { labor: 16600, materials: 14000, tax: 1100, total: 31700 },
    rate: { value: 35.76, source: 'company' },
    noCost: { revenue: 2100, rows: 4 },
    drift: { gap: 624, moved: 3, wrong: 0 },
    laborOutOfStep: true,
    stamp: { pct: 31, revenueUsd: 48700, costUsd: 33600, uncostedUsd: 2100, rateSet: false },
    currentYear: 2026,
    ...over,
  }
}

describe('workbenchBars', () => {
  it('a sent bid: the revenue bar is the sent figure with today’s book as a sliver past it, on the scale of the larger', () => {
    const b = workbenchBars(sentBid())!
    expect(b.scale).toBe(49324)
    const rev = b.bars[0]!
    expect(rev.caption).toBe('Revenue · $48,700 sent Oct 21 · $49,324 at today’s book')
    expect(rev.segments.map((s) => [s.kind, s.amount, s.label])).toEqual([
      ['sent', 48700, '$48,700 sent Oct 21'],
      ['today', 624, '+$624'],
    ])
    expect(rev.segments.reduce((t, s) => t + s.fraction, 0)).toBeCloseTo(1, 6)
    expect(rev.marks).toEqual([{ key: 'sent', kind: 'sent', label: 'sent Oct 21 · $48,700', fraction: 48700 / 49324 }])
  })

  it('the cost bar: labor, materials with their tax, the drift hatched, no cost dashed, the margin as the rest; the stamp a ghost mark', () => {
    const b = workbenchBars(sentBid())!
    const cost = b.bars[1]!
    expect(cost.caption).toBe('Our cost · $31,700 · 64% of revenue · margin 36%')
    expect(cost.segments.map((s) => [s.kind, s.amount])).toEqual([
      ['labor', 16600],
      ['materials', 15100],
      ['drift', 624],
      ['nocost', 2100],
      ['margin', 49324 - 31700 - 2100],
    ])
    expect(cost.segments.find((s) => s.kind === 'labor')!.title).toBe('Labor $16,600 at the crew rate, $35.76/h, until Labor has one of its own')
    expect(cost.segments.find((s) => s.kind === 'materials')!.title).toBe('Materials $14,000 and $1,100 of tax on them')
    expect(cost.segments.find((s) => s.kind === 'margin')!.label).toBe('margin 36%')
    expect(cost.marks).toEqual([{ key: 'stamp', kind: 'stamp', label: 'went out at 31%', fraction: (49324 * 0.69) / 49324 }])
    expect(b.margin).toBeCloseTo((49324 - 31700) / 49324, 6)
  })

  it('each caveat is a legend line on the part it touches, with its door', () => {
    const b = workbenchBars(sentBid())!
    expect(b.legend.map((l) => [l.key, l.words, l.tone, l.door?.kind ?? null])).toEqual([
      ['labor', 'labor · at the crew rate $35.76/h · a default', 'guess', 'laborRate'],
      ['materials', 'materials · $15,100 · +$624 at today’s book', 'plain', 'takeoffs'],
      ['nocost', 'no cost · $2,100 on 4 rows', 'guess', 'noCostRows'],
      ['margin', 'margin · went out at 31% · $33,600 cost on $48,700', 'plain', null],
    ])
    expect(b.warn).toEqual({ key: 'laborOutOfStep', swatch: 'none', words: 'labor on last version’s counts', tone: 'warn', door: { kind: 'labor', words: 'Labor' } })
    expect(b.words).toBe('Revenue $49,324 at today’s book, sent Oct 21 at $48,700. Our cost $31,700, 64% of revenue. Margin 36%, went out at 31%. Labor’s hours follow another version’s counts.')
  })

  it('an unsent bid with its own rate and no caveats: one revenue segment, no drift, no door, the stamp kept', () => {
    const b = workbenchBars(sentBid({ sent: null, revenue: 48700, rate: { value: 42, source: 'override' }, noCost: { revenue: 0, rows: 0 }, drift: { gap: 0, moved: 0, wrong: 0 }, laborOutOfStep: false, stamp: { pct: 31, revenueUsd: 48700, costUsd: 33600, uncostedUsd: 0, rateSet: true } }))!
    expect(b.scale).toBe(48700)
    expect(b.bars[0]!.caption).toBe('Revenue · $48,700')
    expect(b.bars[0]!.segments.map((s) => s.kind)).toEqual(['today'])
    expect(b.bars[0]!.marks).toEqual([])
    expect(b.bars[1]!.segments.map((s) => s.kind)).toEqual(['labor', 'materials', 'margin'])
    expect(b.bars[1]!.marks[0]!.label).toBe('kept at 31%')
    expect(b.legend.map((l) => [l.words, l.door])).toEqual([
      ['labor · $16,600 at $42.00/h', null],
      ['materials · $15,100', null],
      ['margin · kept on the bid at 31% · $33,600 cost on $48,700', null],
    ])
    expect(b.warn).toBeNull()
  })

  it('the book lower than sent: today’s figure solid and the shortfall dashed to the sent mark; a cheaper book is a legend line, not a segment', () => {
    const b = workbenchBars(sentBid({ revenue: 48000, drift: { gap: -700, moved: 2, wrong: 1 } }))!
    expect(b.scale).toBe(48700)
    expect(b.bars[0]!.segments.map((s) => [s.kind, s.amount, s.label])).toEqual([
      ['today', 48000, '$48,000 at today’s book'],
      ['short', 700, '−$700'],
    ])
    expect(b.bars[1]!.segments.map((s) => s.kind)).toEqual(['labor', 'materials', 'nocost', 'margin'])
    expect(b.legend[1]).toEqual({ key: 'materials', swatch: 'materials', words: 'materials · $15,100 · −$700 at today’s book · 1 price that looks wrong left out', tone: 'plain', door: { kind: 'takeoffs', words: 'Takeoffs' } })
  })

  it('no labor rate, cost over revenue, and no revenue at all', () => {
    const none = workbenchBars(sentBid({ rate: { value: null, source: 'none' }, cost: { labor: 0, materials: 14000, tax: 1100, total: 15100 } }))!
    expect(none.bars[1]!.segments.map((s) => s.kind)).toEqual(['materials', 'drift', 'nocost', 'margin'])
    expect(none.legend[0]).toEqual({ key: 'labor', swatch: 'labor', words: 'labor · no rate, so labor counts as $0', tone: 'guess', door: { kind: 'laborRate', words: 'set Labor’s rate' } })
    const over = workbenchBars(sentBid({ revenue: 30000, sent: null, drift: null }))!
    expect(over.scale).toBe(31700)
    expect(over.bars[1]!.caption).toBe('Our cost · $31,700 · $1,700 over revenue')
    expect(over.bars[1]!.segments.map((s) => s.kind)).toEqual(['labor', 'materials'])
    expect(over.bars[1]!.segments.reduce((t, s) => t + s.fraction, 0)).toBeCloseTo(1, 6)
    expect(workbenchBars(sentBid({ revenue: 0, sent: null, cost: { labor: 0, materials: 0, tax: 0, total: 0 }, drift: null }))).toBeNull()
  })

  it('other direct costs are one segment, and a sent date in another year keeps its year', () => {
    const b = workbenchBars(sentBid({ sent: { on: '2025-09-22', value: 48700 }, cost: { labor: 16600, materials: 14000, tax: 1100, total: 35100 } }))!
    expect(b.bars[1]!.segments.map((s) => [s.kind, s.amount])).toEqual([
      ['labor', 16600],
      ['materials', 15100],
      ['drift', 624],
      ['other', 3400],
      ['nocost', 2100],
      ['margin', 49324 - 35100 - 2100],
    ])
    expect(b.bars[0]!.caption).toBe('Revenue · $48,700 sent Sep 22, 2025 · $49,324 at today’s book')
    expect(rateWords(35.758)).toBe('$35.76/h')
  })
})
