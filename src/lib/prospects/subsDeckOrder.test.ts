import { describe, expect, it } from 'vitest'
import { orderSubsDeck, type SubsDeckIn } from './subsDeckOrder'

const sub = (id: string, trades: string[], extra: Partial<{ priority: number | null; created_at: string }> = {}) => ({
  id,
  trades,
  created_at: extra.created_at ?? '2026-10-01T00:00:00Z',
  last_contact: null,
  prospect_fit_status: null,
  priority: extra.priority ?? null,
})

const queue = [sub('a', ['Concrete']), sub('b', ['Framing']), sub('c', ['Concrete']), sub('d', ['Concrete', 'Framing'])]
const base: SubsDeckIn = { run: null, trade: null, mode: 'coldest', benchTrades: [], called: new Set(), calls: [], ranks: [] }
const ids = (rows: { id: string }[]) => rows.map((r) => r.id)

describe('orderSubsDeck', () => {
  it('with nothing named, the deck is the queue as it came', () => {
    expect(ids(orderSubsDeck(queue, base))).toEqual(['a', 'b', 'c', 'd'])
  })

  it('a trade in the address shows that trade alone, in the queue’s order', () => {
    expect(ids(orderSubsDeck(queue, { ...base, trade: 'Framing' }))).toEqual(['b', 'd'])
    expect(ids(orderSubsDeck(queue, { ...base, trade: 'concrete' }))).toEqual(['a', 'c', 'd'])
  })

  it('a run takes its ids in the order the address holds them', () => {
    const run = { ids: ['c', 'a'], trade: 'Concrete', projectId: null, packageId: null }
    expect(ids(orderSubsDeck(queue, { ...base, run }))).toEqual(['c', 'a'])
  })

  it('a card of a run that landed or left the queue is gone, and the run ignores the trade and the calling order', () => {
    const run = { ids: ['zz', 'd', 'b'], trade: 'Concrete', projectId: null, packageId: null }
    expect(ids(orderSubsDeck(queue, { ...base, run, trade: 'Concrete', mode: 'by_rank' }))).toEqual(['d', 'b'])
  })

  it('By rank puts Call first ahead and Later behind, and leaves the rest in the queue’s order', () => {
    const ranked = [sub('a', ['Concrete'], { priority: 3 }), sub('b', ['Concrete']), sub('c', ['Concrete'], { priority: 1 })]
    expect(ids(orderSubsDeck(ranked, { ...base, mode: 'by_rank' }))).toEqual(['c', 'b', 'a'])
  })

  it('By rank leads with the named trade’s pins, in their order, and reads no pins with no trade named', () => {
    const ranks = [
      { prospect_id: 'd', trade: 'Concrete', rank_order: 1 },
      { prospect_id: 'a', trade: 'Concrete', rank_order: 2 },
      { prospect_id: 'b', trade: 'Framing', rank_order: 1 },
    ]
    expect(ids(orderSubsDeck(queue, { ...base, mode: 'by_rank', trade: 'Concrete', ranks }))).toEqual(['d', 'a', 'c'])
    expect(ids(orderSubsDeck(queue, { ...base, mode: 'by_rank', ranks }))).toEqual(['a', 'b', 'c', 'd'])
  })

  it('By rank puts a company never called ahead of one already called', () => {
    expect(ids(orderSubsDeck(queue, { ...base, mode: 'by_rank', trade: 'Concrete', called: new Set(['a']) }))).toEqual(['c', 'd', 'a'])
  })

  it('By need counts the gap on the whole queue, then orders the trade’s subs', () => {
    const benchTrades = [
      { trade: 'Concrete', dependable: 3 },
      { trade: 'Framing', dependable: 0 },
    ]
    const out = ids(orderSubsDeck(queue, { ...base, mode: 'by_need', benchTrades }))
    expect(out).toHaveLength(4)
    expect(out.indexOf('b')).toBeLessThan(out.indexOf('a'))
  })

  it('does not change the queue it was given', () => {
    const before = ids(queue)
    orderSubsDeck(queue, { ...base, mode: 'by_rank', trade: 'Concrete' })
    expect(ids(queue)).toEqual(before)
  })
})
