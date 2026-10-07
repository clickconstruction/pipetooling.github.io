/**
 * GC mode, the real build: the number we carry for a trade, moved word for word from the GC mode
 * prototype (branch spike/gc-mode, `gcBids.ts`) by the schedule's PR 1a, which reads it for a line's
 * worth before the trade has a statement of work. The Board lane's lift (B2) adds the rest of
 * `gcBids.ts` here.
 */
import { exclusionCoversTotal } from './exclusions'
import { ownBidPriced } from './lookups'
import type { Invite, SubBid, TradePackage } from './types'

/** What the alternates the office took add to the number (negative: take off). 0 when none. */
export function takenAlternatesTotal(bid: SubBid): number {
  const taken = new Set(bid.takenAlternates ?? [])
  return (bid.alternates ?? []).filter((a) => taken.has(a.label)).reduce((sum, a) => sum + a.amount, 0)
}

/** The bid plus the office's plug for every scope item it does not clearly include, and any alternate it took. */
export function leveledTotal(pkg: TradePackage, invite: Invite): number | null {
  const bid = invite.bid
  if (!bid) return null
  const plugs = pkg.scope.reduce((sum, item) => {
    return bid.includes[item.id] === 'yes' ? sum : sum + (bid.plugs[item.id] ?? 0)
  }, 0)
  // A cover cost on what their quote excludes (the owner, 2026-10-04) counts like a plug.
  return bid.amount + plugs + takenAlternatesTotal(bid) + exclusionCoversTotal(pkg, bid)
}

export function carriedAmount(pkg: TradePackage): number | null {
  // Our own bid counts once it is priced (the owner, 2026-10-02): until then its value is our guess, a hole.
  if (pkg.selfPerform) return ownBidPriced(pkg) ? pkg.selfPerform.value : null
  if (pkg.sow) return pkg.sow.price
  if (pkg.carried === 'plug') return pkg.budget
  const invite = pkg.invites.find((i) => i.id === (pkg.awardedInviteId ?? pkg.carried))
  return invite ? leveledTotal(pkg, invite) : null
}
