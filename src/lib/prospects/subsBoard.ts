/**
 * The board by trade (v2.5808, punch list #153, PR 2): Hiring's columns for the Subs lane, built
 * for the moment a set of plans lands. The owner, 2026-10-23: "we are looking for specific kinds
 * of subs at any given time. And often we will get a set of plans and then have the need to
 * contact that particular sub as swiftly as we can." One column a trade in the needs panel's
 * order; pick the project in For and its trades' columns come forward, the rest fold; each column
 * orders its cards by what only a person knows (a pin, a priority) and then by what the lane
 * records (the record, never called, coldest), and Call the top 3 → runs the deck through the best
 * three. Pure; the page feeds it the lane, the needs and the records.
 */
import type { GcAskIn, GcNeeds } from './gcNeeds'
import { benchLineParts, dueWords, quotesWords } from './gcNeeds'
import { SUB_RECORD_ORDER, type SubRecord } from './subRecord'
import { tradeKey } from './subsLane'
import { groupSubsByTrade, type PlansChoice, type TradeGroup } from './subsStages'

export const TOP_N = 3

export interface BoardCard {
  id: string
  trades: string[] | null
  created_at: string | null
  last_contact: string | null
  prospect_fit_status: string | null
  /** The office's priority (PR 3): 1 Call first, null Normal, 3 Later. Absent until the column exists. */
  priority?: number | null
}

export interface BoardColumn<T> extends TradeGroup<T> {
  /** The picked project's ask on this trade, when it has one short of quotes. */
  ask: GcAskIn | null
}

/**
 * The columns: every trade the panel knows (short of quotes, the bench, the book), in its order,
 * then trades only a sub names; with a project picked, its trades come first and light, and the
 * rest are folded behind a count unless `showAll`.
 */
export function boardColumns<T extends { id: string; trades: string[] | null }>(
  subs: readonly T[],
  needs: Pick<GcNeeds, 'rows' | 'book'>,
  picked: PlansChoice | null,
  showAll: boolean,
): { columns: BoardColumn<T>[]; folded: number; noTrade: T[] } {
  const { groups, noTrade } = groupSubsByTrade(subs, needs, picked?.trades ?? null)
  const all: BoardColumn<T>[] = groups.map((g) => ({
    ...g,
    ask: picked && g.need ? g.need.asks.find((a) => a.projectId === picked.id) ?? null : null,
  }))
  if (!picked || showAll) return { columns: all, folded: picked && showAll ? all.filter((c) => !c.lit).length : 0, noTrade }
  const lit = all.filter((c) => c.lit)
  return { columns: lit, folded: all.length - lit.length, noTrade }
}

export interface RankIn {
  /** A card's hand-set place in this column (PR 3), by prospect id. Absent: flows. */
  pins?: ReadonlyMap<string, number>
  records: ReadonlyMap<string, SubRecord>
  calledIds: ReadonlySet<string>
}

function priorityRank(p: number | null | undefined): number {
  return p === 1 ? 0 : p === 3 ? 2 : 1
}

/**
 * The column's order: pinned cards first in their rank, then the office's priority (Call first,
 * Normal, Later), then the record (answers, hit or miss, new to us, often silent), then never
 * called before called, then the queue's own order (coldest first, the index the page passes).
 */
export function orderColumn<T extends BoardCard>(cards: readonly T[], inp: RankIn): T[] {
  const pinned = cards.filter((c) => inp.pins?.has(c.id)).sort((a, b) => (inp.pins!.get(a.id) ?? 0) - (inp.pins!.get(b.id) ?? 0) || cards.indexOf(a) - cards.indexOf(b))
  const flow = cards
    .map((c, i) => ({ c, i }))
    .filter((x) => !inp.pins?.has(x.c.id))
    .sort((a, b) => {
      const p = priorityRank(a.c.priority) - priorityRank(b.c.priority)
      if (p !== 0) return p
      const ra = inp.records.get(a.c.id)?.record ?? 'new'
      const rb = inp.records.get(b.c.id)?.record ?? 'new'
      const r = SUB_RECORD_ORDER[ra] - SUB_RECORD_ORDER[rb]
      if (r !== 0) return r
      const called = Number(inp.calledIds.has(a.c.id)) - Number(inp.calledIds.has(b.c.id))
      if (called !== 0) return called
      return a.i - b.i
    })
    .map((x) => x.c)
  return [...pinned, ...flow]
}

/** The ids Call the top N → runs: the column's first N. */
export function topIds<T extends { id: string }>(ordered: readonly T[], n: number = TOP_N): string[] {
  return ordered.slice(0, n).map((c) => c.id)
}

/** The press's words: the top three, the two here, or Call now → on a column of one. */
export function callTopWords(count: number, n: number = TOP_N): string {
  if (count <= 0) return 'Nobody to call'
  if (count === 1) return 'Call now →'
  if (count < n) return `Call the ${count} here →`
  return `Call the top ${n} →`
}

/** The first never-called card in the column's order: Hiring's *call next*. */
export function callNextId<T extends { id: string }>(ordered: readonly T[], calledIds: ReadonlySet<string>): string | null {
  return ordered.find((c) => !calledIds.has(c.id))?.id ?? null
}

/** The sub's other trades: it sits in those columns too. */
export function alsoIn(card: { trades: string[] | null }, columnTrade: string): string[] {
  const here = tradeKey(columnTrade)
  return (card.trades ?? []).map((t) => t.trim()).filter((t) => t && tradeKey(t) !== here)
}

export type PriorityWord = 'Call first' | 'Normal' | 'Later'

export const PRIORITY_CHOICES: readonly { value: 1 | null | 3; word: PriorityWord }[] = [
  { value: 1, word: 'Call first' },
  { value: null, word: 'Normal' },
  { value: 3, word: 'Later' },
]

export function priorityWord(p: number | null | undefined): PriorityWord {
  return p === 1 ? 'Call first' : p === 3 ? 'Later' : 'Normal'
}

export interface CardChips {
  pinned: boolean
  priority: PriorityWord | null
  callNext: boolean
  alsoIn: string[]
}

/** Why a card sits where it does, as the chips on its second line. Normal says nothing. */
export function cardChips(card: BoardCard, opts: { pinned: boolean; callNext: boolean; columnTrade: string }): CardChips {
  const p = priorityWord(card.priority)
  return { pinned: opts.pinned, priority: p === 'Normal' ? null : p, callNext: opts.callNext, alsoIn: alsoIn(card, opts.columnTrade) }
}

/** The column's head: the project's ask on it when picked, and the bench's line. */
export function columnHeadLines(col: Pick<BoardColumn<unknown>, 'need' | 'book' | 'ask' | 'subs'>): { ask: { text: string; tone: string }[] | null; bench: string } {
  const ask = col.ask ? [quotesWords(col.ask), dueWords(col.ask.bidDue, col.ask.daysLeft)] : null
  const bench = col.need ? benchLineParts({ ...col.need, toCall: col.subs.length }).join(' · ') : `nobody on the bench · ${col.subs.length} to call here`
  return { ask, bench }
}

export const BOARD_SENTENCE = 'One column a trade. Pick the project in For and its trades come first. Call the top 3 → runs the deck through the best three in order.'
export const BOARD_ORDER_NOTE = 'A column puts Call first on top, then who answers, then never called, then coldest. A drag pins a card where you put it.'

export function boardFoldWords(folded: number): string {
  return `${folded} ${folded === 1 ? 'trade' : 'trades'} folded · Press to show all`
}

export const BOARD_SHOW_LIT = 'Show the project’s trades only'
export const BOARD_EMPTY_COLUMN = 'Nobody here yet.'

/** The deck's By rank order (the column's order over the whole lane, one trade when filtered). */
export const BY_RANK_NOTE = 'By rank: pinned cards, then Call first, then who answers, then never called, then coldest.'
