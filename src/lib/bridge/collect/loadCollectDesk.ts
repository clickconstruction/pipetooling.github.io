import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../types/database'
/**
 * The Collect desk, PR B (v2.5853): the three reads the Bridge does not
 * already make for the pile. Which of the pile's jobs carry a live pay
 * application (decision 1: that payer reads as a GC); which customers are a
 * GC by record (some job names them as its GC); and which of the pile's
 * bills went out through the app, so a bill marked billed by hand can say
 * so. Plus the Payment Chase touches the AR window reads. Everything else
 * the modal needs is already on the page: the AR rows, the pay speeds, the
 * promises, the window's flows.
 */
import { withSupabaseRetry } from '../../../utils/errorHandling'
import { fetchAllRowsChunkedIn } from '../../supabasePaging'
import { parseChaseTouchesRpc, type ChaseTouch } from '../../jobs/paymentChaseTouches'
import { loadPaceFacts } from '../../jobs/payPaceIo'

export type CollectDeskReads = {
  payAppJobIds: ReadonlySet<string>
  gcPayerIds: ReadonlySet<string>
  /** Invoice id → went out through the app. */
  sentByInvoice: ReadonlyMap<string, boolean>
  touches: ChaseTouch[] | null
}

type SentRow = { id: string; sent_to_customer_at: string | null }

export async function loadCollectDeskReads(db: SupabaseClient<Database>, args: { jobIds: ReadonlyArray<string>; invoiceIds: ReadonlyArray<string>; canReadTouches: boolean }): Promise<CollectDeskReads> {
  const jobIds = [...new Set(args.jobIds)]
  const invoiceIds = [...new Set(args.invoiceIds)]
  // The GC facts through the one loader the Stages tab reads too (v2.6034), so both read decision 1 from the same rows.
  const [facts, sentRows, touchesRaw] = await Promise.all([
    loadPaceFacts(db, { jobIds }),
    invoiceIds.length
      ? fetchAllRowsChunkedIn<SentRow, string>(
          invoiceIds,
          async (chunk, from, to) => ({
            data: (await withSupabaseRetry(async () => db.from('jobs_ledger_invoices').select('id, sent_to_customer_at').in('id', chunk).order('id').range(from, to), 'collect desk sent bills')) as SentRow[] | null,
            error: null,
          }),
          'collect desk sent bills',
        )
      : Promise.resolve([] as SentRow[]),
    args.canReadTouches
      ? (async (): Promise<unknown> => {
          try {
            return (await db.rpc('list_payment_chase_touches' as never)).data
          } catch {
            return null
          }
        })()
      : Promise.resolve(null),
  ])
  const sentByInvoice = new Map<string, boolean>()
  for (const r of sentRows) sentByInvoice.set(r.id, !!r.sent_to_customer_at)
  return { payAppJobIds: facts.payAppJobIds, gcPayerIds: facts.gcPayerIds, sentByInvoice, touches: touchesRaw == null ? null : parseChaseTouchesRpc(touchesRaw) }
}
