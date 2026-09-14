import { formatDenverCalendarDayShort } from '../../utils/dateUtils'

/**
 * The red "% done" box on the Pipeline (v2.3411). Once a bill has gone out on
 * a job, an empty % done is a gap the office should close: the bar cannot say
 * what is done-but-unbilled, and the Dashboard's % Complete reads blank. The
 * rule is one function so the desktop table and the phone card agree.
 *
 * Fires when a bill has actually gone out on the job — an invoice in `billed`
 * (a Ready to Bill draft does not count), or the job itself sits in Billed /
 * Collections (`status = 'billed'`, which older rows reach with no invoice
 * row) — and no percent is recorded. A Working job with a break-off bill
 * already sent counts too: the ask is "once a bill has been sent for a job",
 * not "once the job is in Billed". A typed 0 is an answer and clears it.
 * Paid jobs never flag.
 */

export type StagesBillSentPctAlertJob = {
  status: string | null
  pct_complete: number | null
  invoices?: ReadonlyArray<{ status: string; billed_at: string | null; sent_to_customer_at: string | null; created_at: string | null }> | null
}

export type StagesBillSentPctAlert = {
  /** ISO instant the first bill went out, when any invoice carries one. */
  sentAt: string | null
  /** The line under the box: "Bill sent Sep 2 · set % done". */
  label: string
  /** Hover text on the box and the line. */
  title: string
}

function invoiceSentAt(inv: { billed_at: string | null; sent_to_customer_at: string | null; created_at: string | null }): string | null {
  return inv.billed_at ?? inv.sent_to_customer_at ?? inv.created_at ?? null
}

export function stagesBillSentPctAlert(job: StagesBillSentPctAlertJob): StagesBillSentPctAlert | null {
  const status = job.status ?? 'working'
  if (status === 'paid') return null
  if (job.pct_complete != null && Number.isFinite(Number(job.pct_complete))) return null
  const sent = (job.invoices ?? []).filter((i) => i.status === 'billed')
  if (sent.length === 0 && status !== 'billed') return null
  const sentAt =
    sent
      .map(invoiceSentAt)
      .filter((s): s is string => s != null && Number.isFinite(Date.parse(s)))
      .sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null
  const when = sentAt != null ? ` ${formatDenverCalendarDayShort(Date.parse(sentAt))}` : ''
  return {
    sentAt,
    label: `Bill sent${when} · set % done`,
    title: 'A bill is out on this job but no % done is recorded — how far along is the work? Type a number (0 counts) to clear this.',
  }
}
