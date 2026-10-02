import { describe, expect, it } from 'vitest'
import { type BookPrice, type DriftLine, gapWords, movedWords, takeoffPriceDrift } from './takeoffPriceDrift'

const line = (id: string, over: Partial<DriftLine> = {}): DriftLine => ({ id, partName: id.toUpperCase(), quantity: 1, unitPrice: 10, count: 1, sourcePriceId: `src-${id}`, ...over })
const book = (entries: Record<string, number>, house = 'Reece') => new Map<string, BookPrice>(Object.entries(entries).map(([k, price]) => [k, { price, houseName: house }]))

describe('takeoffPriceDrift', () => {
  it('BP329: three moved book prices, the gap at today’s book, and what Refresh writes', () => {
    const lines = [
      line('pvc90', { partName: '4IN 90 PVC', quantity: 52, unitPrice: 25.88 }),
      line('fd', { partName: '2005_02 FD', quantity: 1, count: 6, unitPrice: 137.02 }),
      line('b65', { partName: 'B65P-CC', quantity: 3, unitPrice: 494.73 }),
      line('same', { partName: 'SAME', quantity: 2, unitPrice: 40 }),
    ]
    const out = takeoffPriceDrift(lines, book({ 'src-pvc90': 17.56, 'src-fd': 101.92, 'src-b65': 501.18, 'src-same': 40 }))
    expect(out.moved.map((m) => [m.partName, m.quantity, Number(m.change.toFixed(2))])).toEqual([
      ['4IN 90 PVC', 52, -432.64],
      ['2005_02 FD', 6, -210.6],
      ['B65P-CC', 3, 19.35],
    ])
    expect(out.gap).toBeCloseTo(-623.89, 2)
    expect(out.materials).toBeCloseTo(52 * 25.88 + 6 * 137.02 + 3 * 494.73 + 2 * 40, 6)
    expect(out.share).toBeCloseTo(-623.89 / out.materials, 8)
    expect(out.refresh).toEqual([
      { lineId: 'pvc90', unitPrice: 17.56 },
      { lineId: 'fd', unitPrice: 101.92 },
      { lineId: 'b65', unitPrice: 501.18 },
    ])
    expect(out.wrong).toEqual([])
  })

  it('BP338: a $999,999 stand-in is set aside, named once with its lines, and never refreshed', () => {
    const lines = [
      line('sink1', { partName: 'RIVERBY SINK', unitPrice: 653.93, sourcePriceId: 'src-sink' }),
      line('sink2', { partName: 'RIVERBY SINK', unitPrice: 653.93, sourcePriceId: 'src-sink' }),
      line('trap', { partName: 'TRAP', unitPrice: 19.64 }),
    ]
    const out = takeoffPriceDrift(lines, book({ 'src-sink': 999_999, 'src-trap': 25.24 }))
    expect(out.wrong).toEqual([{ sourcePriceId: 'src-sink', partName: 'RIVERBY SINK', houseName: 'Reece', priced: 653.93, today: 999_999, lineCount: 2 }])
    expect(out.moved.map((m) => m.lineId)).toEqual(['trap'])
    expect(out.gap).toBeCloseTo(5.6, 6)
    expect(out.refresh).toEqual([{ lineId: 'trap', unitPrice: 25.24 }])
  })

  it('a big jump in either direction is set aside too', () => {
    const out = takeoffPriceDrift([line('up', { unitPrice: 10 }), line('down', { unitPrice: 10 })], book({ 'src-up': 15, 'src-down': 5 }))
    expect(out.moved).toEqual([])
    expect(out.wrong.map((w) => w.partName)).toEqual(['UP', 'DOWN'])
  })

  it('leaves typed prices, rows the reader cannot see and empty lines alone, but counts them in the materials', () => {
    const out = takeoffPriceDrift(
      [line('typed', { sourcePriceId: null, unitPrice: 12, quantity: 2 }), line('hidden', { unitPrice: 5 }), line('zero', { unitPrice: 0 })],
      book({ 'src-zero': 7 }),
    )
    expect(out.moved).toEqual([])
    expect(out.wrong).toEqual([])
    expect(out.materials).toBe(24 + 5)
    expect(out.share).toBe(0)
  })

  it('no lines: nothing moved, no share', () => {
    expect(takeoffPriceDrift([], new Map())).toEqual({ materials: 0, moved: [], gap: 0, share: 0, wrong: [], refresh: [] })
  })
})

describe('words', () => {
  it('says the gap to the dollar, less or more', () => {
    expect(gapWords(-623.89)).toBe('$624 less')
    expect(gapWords(10.2)).toBe('$10 more')
    expect(gapWords(-1495.2)).toBe('$1,495 less')
  })

  it('counts the moved prices', () => {
    expect(movedWords(1)).toBe('1 price on this takeoff moved in the book.')
    expect(movedWords(3)).toBe('3 prices on this takeoff moved in the book.')
  })
})
