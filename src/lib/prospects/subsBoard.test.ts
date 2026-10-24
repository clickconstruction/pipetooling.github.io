import { describe, expect, it } from 'vitest'
import type { GcNeed, GcNeeds } from './gcNeeds'
import type { SubRecord } from './subRecord'
import { alsoIn, boardColumns, boardFoldWords, callNextId, callTopWords, cardChips, columnHeadLines, orderColumn, priorityWord, topIds } from './subsBoard'
import type { PlansChoice } from './subsStages'

type Card = { id: string; trades: string[] | null; created_at: string | null; last_contact: string | null; prospect_fit_status: string | null; priority?: number | null }
const card = (id: string, trades: string[], over: Partial<Card> = {}): Card => ({ id, trades, created_at: '2026-10-01', last_contact: null, prospect_fit_status: null, ...over })

const need = (trade: string, over: Partial<GcNeed> = {}): GcNeed => ({ trade, why: 'bench', asks: [], onBench: 1, dependable: 1, benchShort: 2, toCall: 1, unasked: 0, ...over })
const ask = { projectId: 'p1', projectName: 'Oak Run Clinic', bids: 0, short: 2, bidDue: '2026-10-30', daysLeft: 7, asked: 1, unasked: 0 }
const needs: Pick<GcNeeds, 'rows' | 'book'> = {
  rows: [need('Concrete', { why: 'quotes', asks: [ask] }), need('HVAC')],
  book: [
    { trade: 'Fire sprinkler', toCall: 2 },
    { trade: 'Sitework', toCall: 0 },
  ],
}
const picked: PlansChoice = { id: 'p1', name: 'Oak Run Clinic', bidDue: '2026-10-30', daysLeft: 7, trades: ['Fire sprinkler', 'Concrete'], packageByTrade: { 'fire sprinkler': 'k1', concrete: 'k2' } }

const subs = [card('a', ['Fire sprinkler']), card('b', ['Fire sprinkler', 'Sitework']), card('c', ['Concrete']), card('d', ['HVAC']), card('e', ['Masonry'])]

describe('subsBoard: the columns', () => {
  it('draws every trade the panel knows in its order, then the subs’ own, with nothing picked', () => {
    const { columns, folded } = boardColumns(subs, needs, null, false)
    expect(columns.map((c) => c.trade)).toEqual(['Concrete', 'HVAC', 'Fire sprinkler', 'Sitework', 'Masonry'])
    expect(columns.map((c) => c.subs.length)).toEqual([1, 1, 2, 1, 1])
    expect(folded).toBe(0)
    expect(columns[0]!.ask).toBeNull()
  })

  it('brings the picked project’s trades forward, folds the rest, and carries the project’s ask on a lit column', () => {
    const { columns, folded } = boardColumns(subs, needs, picked, false)
    expect(columns.map((c) => c.trade)).toEqual(['Concrete', 'Fire sprinkler'])
    expect(columns.every((c) => c.lit)).toBe(true)
    expect(columns[0]!.ask).toEqual(ask)
    expect(folded).toBe(3)
    expect(boardFoldWords(folded)).toBe('3 trades folded · Press to show all')
    const all = boardColumns(subs, needs, picked, true)
    expect(all.columns.map((c) => c.trade)).toEqual(['Concrete', 'Fire sprinkler', 'HVAC', 'Sitework', 'Masonry'])
    expect(all.folded).toBe(3)
  })

  it('heads a column with the project’s ask when picked, and the bench’s line always', () => {
    const { columns } = boardColumns(subs, needs, picked, false)
    const head = columnHeadLines(columns[0]!)
    expect(head.ask!.map((a) => a.text)).toEqual(['0 of 2 quotes', 'due Oct 30, in 7 days'])
    expect(head.bench).toBe('1 on the bench · everyone asked · 1 to call here')
    expect(columnHeadLines(columns[1]!)).toEqual({ ask: null, bench: 'nobody on the bench · 2 to call here' })
  })
})

describe('subsBoard: the order', () => {
  const records = new Map<string, SubRecord>([
    ['answers', { calls: 2, answered: 2, record: 'reliable' }],
    ['mixed', { calls: 2, answered: 1, record: 'mixed' }],
    ['silent', { calls: 3, answered: 0, record: 'silent' }],
    ['once', { calls: 1, answered: 0, record: 'new' }],
  ])
  const calledIds = new Set(['answers', 'mixed', 'silent', 'once'])
  const cards = [card('silent', ['X']), card('once', ['X']), card('never2', ['X']), card('answers', ['X']), card('never1', ['X']), card('mixed', ['X'])]

  it('puts who answers first, then hit or miss, then never called ahead of called once, then often silent, the queue’s order inside a tie', () => {
    expect(orderColumn(cards, { records, calledIds }).map((c) => c.id)).toEqual(['answers', 'mixed', 'never2', 'never1', 'once', 'silent'])
  })

  it('puts the office’s priority over the record, Later at the foot', () => {
    const withPriority = cards.map((c) => (c.id === 'silent' ? { ...c, priority: 1 } : c.id === 'answers' ? { ...c, priority: 3 } : c))
    expect(orderColumn(withPriority, { records, calledIds }).map((c) => c.id)).toEqual(['silent', 'mixed', 'never2', 'never1', 'once', 'answers'])
  })

  it('holds pinned cards at their rank over the flow', () => {
    const pins = new Map([
      ['once', 2],
      ['never1', 1],
    ])
    expect(orderColumn(cards, { records, calledIds, pins }).map((c) => c.id)).toEqual(['never1', 'once', 'answers', 'mixed', 'never2', 'silent'])
  })

  it('names the top three, call next, and the press’s words', () => {
    const ordered = orderColumn(cards, { records, calledIds })
    expect(topIds(ordered)).toEqual(['answers', 'mixed', 'never2'])
    expect(topIds(ordered, 2)).toEqual(['answers', 'mixed'])
    expect(callNextId(ordered, calledIds)).toBe('never2')
    expect(callNextId(ordered.filter((c) => calledIds.has(c.id)), calledIds)).toBeNull()
    expect(callTopWords(6)).toBe('Call the top 3 →')
    expect(callTopWords(2)).toBe('Call the 2 here →')
    expect(callTopWords(1)).toBe('Call now →')
    expect(callTopWords(0)).toBe('Nobody to call')
  })

  it('reads a card’s chips: the pin, the priority, call next, the other columns it sits in', () => {
    expect(cardChips(card('b', ['Fire sprinkler', 'Sitework'], { priority: 1 }), { pinned: true, callNext: true, columnTrade: 'Fire sprinkler' })).toEqual({ pinned: true, priority: 'Call first', callNext: true, alsoIn: ['Sitework'] })
    expect(cardChips(card('c', ['Concrete']), { pinned: false, callNext: false, columnTrade: 'Concrete' })).toEqual({ pinned: false, priority: null, callNext: false, alsoIn: [] })
    expect(alsoIn({ trades: ['a', 'B', 'c'] }, 'b')).toEqual(['a', 'c'])
    expect(priorityWord(3)).toBe('Later')
    expect(priorityWord(undefined)).toBe('Normal')
  })
})
