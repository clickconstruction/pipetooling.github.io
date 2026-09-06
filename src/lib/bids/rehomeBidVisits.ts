/**
 * Re-anchor bid visits to the job (journey map Tier 5 X10 / J15-F10).
 *
 * Schedule blocks can anchor to a bid (v2.1613) and the job→bid direction already moves them
 * when a job is folded back into its bid (`migrate_job_ledger_costs_to_bid_and_delete`, v2.1624).
 * Nothing moved them the other way: when a won bid became a job, its scheduled visits stayed on
 * the bid and the job's week read empty. This kernel owns the offer the Won-moment door makes
 * once a job exists, and the RPC `move_bid_schedule_blocks_to_job` (20260906140000) does the move.
 */

export type BidVisitRow = { work_date: string }

export type BidVisitsSummary = { total: number; upcoming: number }

/** Count the bid-anchored visits, and how many are today or later (company-calendar ymd compare). */
export function summarizeBidVisits(rows: ReadonlyArray<BidVisitRow>, todayYmd: string): BidVisitsSummary {
  let upcoming = 0
  for (const r of rows) if (r.work_date >= todayYmd) upcoming++
  return { total: rows.length, upcoming }
}

function visits(n: number): string {
  return `${n} scheduled visit${n === 1 ? '' : 's'}`
}

export type RehomeOffer = { line: string; button: string; confirm: string }

/** The offer beside the "J1007 opened from this bid" chip; null when there is nothing to move. */
export function rehomeOffer(summary: BidVisitsSummary, jobLabel: string): RehomeOffer | null {
  if (summary.total <= 0) return null
  const upcoming =
    summary.upcoming === 0 ? ' — all in the past' : summary.upcoming === summary.total ? '' : ` (${summary.upcoming} upcoming)`
  return {
    line: `${visits(summary.total)} still ${summary.total === 1 ? 'sits' : 'sit'} on the bid${upcoming}.`,
    button: `Move ${summary.total === 1 ? 'it' : 'them'} to ${jobLabel}`,
    confirm: `Move ${visits(summary.total)} from this bid to ${jobLabel}? ${summary.total === 1 ? 'It keeps its' : 'They keep their'} crew, date and time; the bid's schedule reads empty afterwards.`,
  }
}

/** Toast after the RPC returns the moved count. */
export function rehomeDoneToast(moved: number, jobLabel: string): string {
  if (moved <= 0) return 'Nothing to move — those visits were already on the job.'
  return `Moved ${visits(moved)} to ${jobLabel}.`
}
