/**
 * Projects-card bid chips: one dot color per `bids.outcome` value (the cheap
 * on-row field the Bid Board / Submission & Followup tabs bucket by — no join
 * needed). Pending (null/unknown) reads neutral; won green; lost red;
 * started_or_complete teal (matches the jobs pill's ready-to-bill teal family).
 */
const BID_OUTCOME_DOT_COLORS: Record<string, string> = {
  won: '#22c55e',
  lost: '#ef4444',
  started_or_complete: '#14b8a6',
}

export function bidOutcomeDotColor(raw: string | null | undefined): string {
  const k = raw?.trim().toLowerCase()
  return (k && BID_OUTCOME_DOT_COLORS[k]) || '#9ca3af'
}
