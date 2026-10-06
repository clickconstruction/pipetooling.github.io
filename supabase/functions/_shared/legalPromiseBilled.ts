/**
 * What was billed on a job when a promise was made (punch list #85, item 9). A
 * promise is kept when the job is paid off by its date, measured against what
 * was billed at the time it was made. The office's desk reads that from the
 * `list_payment_promise_records` RPC: billed or paid lines whose
 * `COALESCE(billed_at, created_at)` is at or before the promise's `created_at`.
 * `legal-portal` summed every bill on the job instead, so a promise kept on a
 * first draw read as broken on the firm's page once the final bill went out.
 * This is the RPC's rule for the function's rows.
 *
 * Lives in `_shared` so the function and its test read one rule;
 * `src/lib/legal/legalPromiseBilled.ts` is the client's door.
 */

type InvoiceLike = { job_id?: unknown; status?: unknown; amount?: unknown; billed_at?: unknown; created_at?: unknown }

function instantMs(v: unknown): number | null {
  if (typeof v !== 'string' || !v) return null
  const ms = Date.parse(v)
  return Number.isFinite(ms) ? ms : null
}

/**
 * The sum of the job's billed or paid lines dated at or before the promise. A
 * line's date is `COALESCE(billed_at, created_at)`, exactly the RPC's; a line
 * with neither counts (it was billed before anyone dated it).
 */
export function billedAtPromise(invoices: ReadonlyArray<InvoiceLike>, jobId: string, promiseCreatedAt: string): number {
  const cutoff = instantMs(promiseCreatedAt)
  let sum = 0
  for (const i of invoices) {
    if (i.job_id !== jobId || (i.status !== 'billed' && i.status !== 'paid')) continue
    const when = instantMs(i.billed_at) ?? instantMs(i.created_at)
    if (cutoff != null && when != null && when > cutoff) continue
    sum += Number(i.amount ?? 0)
  }
  return Math.round(sum * 100) / 100
}
