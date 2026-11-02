/**
 * Which job a clock-out sends (punch list #228). The clock-out window opens with an empty pick and then
 * reads the session's job or bid from the server. With no signal that read fails and the pick stays
 * empty, so the kept press carried `jobLedgerId: null`; `land_field_press` keeps a session's job only
 * when the key is absent from the payload, so it wrote null over the job and the session's hours read
 * *No Job or Bid* (v2.6198's live check on clicktooling.com, 2026-10-31). The window also has Clear,
 * which removes the job on purpose, so an empty pick alone cannot be read as "keep the job".
 *
 * The rule: when the person touched the pick, meaning they picked a job or a bid or pressed Clear, the
 * pick stands, empty or not. When they did not, the clock-out sends the session's own job and bid, which
 * the clock knows with no signal from the open session it already drew. Typing in the search box without
 * picking is not a touch. Pure.
 */

/** The window's pick as drawn: a job, a bid, or none. */
export type ClockOutPick = { source: 'job' | 'bid'; id: string }

export interface ClockOutJobInput {
  /** The pick as drawn when Complete clock out was pressed. */
  pick: ClockOutPick | null
  /** Whether the person picked a job or bid, or pressed Clear, since the window opened. */
  touched: boolean
  /** The session the clock-out closes, as the clock drew it. */
  session: { job_ledger_id: string | null; bid_id: string | null }
}

export interface ClockOutJob {
  jobLedgerId: string | null
  bidId: string | null
  /** True when the pick was never touched and the session's own job and bid go out in its place. */
  kept: boolean
}

export function clockOutJob({ pick, touched, session }: ClockOutJobInput): ClockOutJob {
  if (touched) {
    return {
      jobLedgerId: pick?.source === 'job' ? pick.id : null,
      bidId: pick?.source === 'bid' ? pick.id : null,
      kept: false,
    }
  }
  return { jobLedgerId: session.job_ledger_id ?? null, bidId: session.bid_id ?? null, kept: true }
}

/** The window's pick from a search row; a customer or an estimate row, which the clock never offers, is no pick. */
export function clockOutPickOf(row: { source: string; id: string } | null | undefined): ClockOutPick | null {
  if (!row) return null
  return row.source === 'job' || row.source === 'bid' ? { source: row.source, id: row.id } : null
}
