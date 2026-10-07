/**
 * GC mode, the real build, the Board's B2: who is asked to the pre-bid meeting, read from the asks, moved word for word from the
 * GC mode prototype (branch spike/gc-mode, `gcPlans.ts`).
 */
import { partnerById } from './lookups'
import type { GcProject, GcState, Partner } from './types'

/** The companies asked to the pre-bid meeting: every company still quoting a trade, each once, with its trades. */
export function preBidInvited(state: GcState, project: GcProject): { partner: Partner; trades: string[] }[] {
  const out = new Map<string, { partner: Partner; trades: string[] }>()
  for (const pkg of project.packages) {
    if (pkg.selfPerform) continue
    for (const inv of pkg.invites) {
      if (inv.status === 'declined') continue
      const partner = partnerById(state, inv.partnerId)
      if (!partner) continue
      const row = out.get(partner.id) ?? { partner, trades: [] }
      if (!row.trades.includes(pkg.trade)) row.trades.push(pkg.trade)
      out.set(partner.id, row)
    }
  }
  return [...out.values()].sort((a, b) => a.partner.company.localeCompare(b.partner.company))
}
