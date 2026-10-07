/**
 * GC mode, the real build: lookups the kernels share, moved word for word from the GC mode prototype
 * (branch spike/gc-mode, `gcLookups.ts`) by the schedule's PR 1a.
 */
import type { GcState, Partner, TradePackage } from './types'

export function partnerById(state: GcState, id: string): Partner | undefined {
  return state.partners.find((p) => p.id === id)
}

/**
 * Our own trade has a real number: its bid in Trades mode is priced. A missing `priced` means
 * priced, so projects written before it are unchanged. False for a trade we hire out.
 */
export function ownBidPriced(pkg: TradePackage): boolean {
  return pkg.selfPerform !== null && pkg.selfPerform.priced !== false
}
