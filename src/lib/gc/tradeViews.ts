/**
 * GC mode, the real build (the Board's B3-b and B4-b): two small rules the dev views share. A
 * trade's card has an id to jump to (Trade partners' strip and Follow up's Who else?), and the
 * Follow up pill counts the asks that need a call.
 */
import { followUps } from './followUp'
import type { GcState } from './types'

/** The id of a trade's card on Trade partners: "gc-bench-fire-sprinkler". */
export function benchAnchor(trade: string): string {
  return `gc-bench-${trade.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

/** How many asks Follow up holds that need a call: every card but the ones waiting on a day not come yet. */
export function followUpsToCall(state: GcState): number {
  return followUps(state).filter((f) => f.why !== 'waiting').length
}
