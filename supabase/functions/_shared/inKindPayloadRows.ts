/**
 * Which open bills an in-kind deal pays, for the money emails (punch list #301).
 *
 * The payload RPCs behind the Payment forecast and Money waiting emails
 * (get_payment_forecast_email_payload, get_money_waiting_email_payload) list
 * every open billed row and do not say which job is on a deal. On screen the
 * board's own job rows carry `jobs_ledger.in_kind_arrangement_id`, and
 * `jobIsScheduledInKind` sets such a bill apart. This reads the same column for
 * the payload's jobs and stamps it on the rows, so the cores
 * (paymentForecastCore.ts, moneyWaitingCore.ts) can set those bills apart too.
 *
 * A failed read throws: an email that calls a credit money coming is the wrong
 * the stamp exists to stop, so the send waits for the next try instead.
 */

// deno-lint-ignore no-explicit-any
type Admin = any

/** Job ids per read. A uuid is 36 characters, so 100 keeps the request line well under a proxy's limit. */
export const IN_KIND_READ_CHUNK = 100

type JobRow = { id: string; in_kind_arrangement_id: string | null }

/** The deal of each job that is on one. A job on no deal is not in the map. */
export async function readInKindDealByJob(admin: Admin, jobIds: readonly string[]): Promise<Map<string, string>> {
  const ids = [...new Set(jobIds.filter((id) => typeof id === 'string' && id.length > 0))]
  const out = new Map<string, string>()
  for (let i = 0; i < ids.length; i += IN_KIND_READ_CHUNK) {
    const { data, error } = await admin
      .from('jobs_ledger')
      .select('id, in_kind_arrangement_id')
      .in('id', ids.slice(i, i + IN_KIND_READ_CHUNK))
      .not('in_kind_arrangement_id', 'is', null)
    if (error) throw new Error(`jobs_ledger in kind read: ${error.message}`)
    for (const row of (data ?? []) as JobRow[]) {
      if (row.in_kind_arrangement_id) out.set(row.id, row.in_kind_arrangement_id)
    }
  }
  return out
}

/** The rows with each one's deal on it, null for a bill paid with money. Pure. */
export function withInKindDeals<T extends { job_id: string }>(
  rows: readonly T[],
  dealByJob: ReadonlyMap<string, string>,
): Array<T & { in_kind_arrangement_id: string | null }> {
  return rows.map((r) => ({ ...r, in_kind_arrangement_id: dealByJob.get(r.job_id) ?? null }))
}

/** A money email's payload with the deal stamped on every row. */
export async function stampInKindDeals<P extends { rows: Array<{ job_id: string }> }>(admin: Admin, payload: P): Promise<P> {
  const dealByJob = await readInKindDealByJob(
    admin,
    payload.rows.map((r) => r.job_id),
  )
  return { ...payload, rows: withInKindDeals(payload.rows, dealByJob) }
}
