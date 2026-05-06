import { hourlyWageForUserName } from './bidBoardWeeklyEstimatorLaborCost'

export type LostBidSessionRow = {
  bid_id: string | null
  user_id: string
  clocked_in_at: string
  clocked_out_at: string | null
  approved_at: string | null
  rejected_at: string | null
  revoked_at: string | null
}

export function isLostSummarySessionIncluded(s: LostBidSessionRow): boolean {
  if (s.rejected_at || s.revoked_at) return false
  if (s.approved_at == null) return false
  return s.clocked_out_at != null
}

function approvedClosedHours(session: Pick<LostBidSessionRow, 'clocked_in_at' | 'clocked_out_at'>): number | null {
  const out = session.clocked_out_at
  if (out == null) return null
  const t0 = new Date(session.clocked_in_at).getTime()
  const t1 = new Date(out).getTime()
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) return null
  return (t1 - t0) / 3600000
}

export type LostBidLaborAgg = { laborUsd: number | null }

/**
 * Per bid: sum of approved closed session hours × wage (user display name → pay config).
 * - No qualifying sessions for a bid → laborUsd 0.
 * - Any qualifying session with missing/non-finite wage → laborUsd null (show em dash in UI).
 */
export function aggregateLostBidLaborUsd(args: {
  sessions: readonly LostBidSessionRow[]
  userIdToDisplayName: ReadonlyMap<string, string | null | undefined>
  wageByNormalizedName: Map<string, number | null>
}): Map<string, LostBidLaborAgg> {
  const { sessions, userIdToDisplayName, wageByNormalizedName } = args
  const acc = new Map<string, { sum: number; hadIncluded: boolean; missingWage: boolean }>()

  for (const s of sessions) {
    if (!isLostSummarySessionIncluded(s)) continue
    const bidId = s.bid_id
    if (!bidId) continue

    let row = acc.get(bidId)
    if (!row) {
      row = { sum: 0, hadIncluded: false, missingWage: false }
      acc.set(bidId, row)
    }
    row.hadIncluded = true

    const hours = approvedClosedHours(s)
    if (hours == null) continue

    const displayName = userIdToDisplayName.get(s.user_id)
    const wage = hourlyWageForUserName(displayName, wageByNormalizedName)
    if (wage == null || !Number.isFinite(wage)) {
      row.missingWage = true
    } else {
      row.sum += hours * wage
    }
  }

  const out = new Map<string, LostBidLaborAgg>()
  for (const [bidId, row] of acc) {
    if (!row.hadIncluded) out.set(bidId, { laborUsd: 0 })
    else if (row.missingWage) out.set(bidId, { laborUsd: null })
    else out.set(bidId, { laborUsd: row.sum })
  }
  return out
}

/** Labor for bids that never appeared in `sessions` defaults to { laborUsd: 0 } at render time. */
export function getLaborUsdForBid(laborByBid: ReadonlyMap<string, LostBidLaborAgg>, bidId: string): LostBidLaborAgg {
  return laborByBid.get(bidId) ?? { laborUsd: 0 }
}
