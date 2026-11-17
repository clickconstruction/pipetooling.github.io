import type { CallingOrderMode } from './callingOrder'
import type { CallRun } from './callRun'
import { subRecords } from './subRecord'
import { orderColumn, type BoardCard } from './subsBoard'
import { benchNeeds, orderSubsByNeed, subsForTrade, tradeKey } from './subsLane'
import { pinsByTrade, type RankRow } from './subsRanks'

export type SubsDeckIn = {
  /** The run the address names (`?run=`), or none. */
  run: CallRun | null
  /** The trade the address names (`?trade=`), or none. */
  trade: string | null
  mode: CallingOrderMode
  /** The bench's trades with how many each can count on; empty when the bench was not read. */
  benchTrades: readonly { trade: string; dependable: number }[]
  /** The prospects with a call on record. */
  called: ReadonlySet<string>
  /** The lane's call rows, for each sub's record (By rank). */
  calls: readonly { prospect_id: string; interaction_type: string }[]
  /** The board's pins, read for By rank alone. */
  ranks: readonly RankRow[]
}

/**
 * The Subs deck from the lane's queue (v2.5560, v2.5808, v2.5809). A run takes its ids in the order the address
 * holds them, and a card that landed or left is gone. Otherwise the deck shows one trade when the address names
 * it; By need puts the biggest gap on the bench first; By rank orders the column the way the Board does, with
 * the named trade's pins leading. The needs are counted on the whole queue, before the trade filter.
 *
 * Moved out of `loadFollowUpProspects` in `src/pages/Prospects.tsx`, where it sat between awaits.
 */
export function orderSubsDeck<T extends BoardCard>(queue: readonly T[], inp: SubsDeckIn): T[] {
  const needsNow = benchNeeds(inp.benchTrades, queue)
  if (inp.run) {
    // A run (v2.5808): the ids fixed at the press, in the column's order; a card that landed or left is gone.
    const byId = new Map(queue.map((p) => [p.id, p]))
    return inp.run.ids.map((id) => byId.get(id)).filter((p): p is T => !!p)
  }
  let deck = subsForTrade(queue, inp.trade)
  if (inp.mode === 'by_need') deck = orderSubsByNeed(deck, needsNow, inp.called)
  if (inp.mode === 'by_rank') {
    const pins = inp.trade ? pinsByTrade(inp.ranks).get(tradeKey(inp.trade)) : undefined
    deck = orderColumn(deck, { records: subRecords({ calls: inp.calls }), calledIds: inp.called, ...(pins ? { pins } : {}) })
  }
  return deck
}
