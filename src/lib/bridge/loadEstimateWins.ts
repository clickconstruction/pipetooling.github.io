import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { fetchAllRows } from '../supabasePaging'
import type { EstimateSent } from './estimateWins'
import { isLeftOut, type LeftOutRule } from './leftOut'
import { isZzTestName } from '../jobs/zzTestJobSweep'
import type { BridgeZzTestJobIds } from './zzTestJobs'

/**
 * The read behind the estimates' won coefficient (punch list #318): every estimate ever sent,
 * with its send day, its status and its dollars. All of them, not the page's window: the coefficient needs the ones
 * old enough to have an answer, and each one's customer and address, for the estimates a customer did not choose. Change orders and bid proposals share the table and are left out, as the Market
 * step leaves them out.
 *
 * A ZZ test estimate is left out too (punch list #334, PR 3), for the viewer who leaves ZZ test jobs out. The owner,
 * reading the estimates behind the won rate, saw test estimates among them: eight were inside the rate. Before this
 * the estimates had no ZZ rule (`loadDemandPace.ts` still reads them all for the count of asks).
 */

/**
 * A test estimate by the convention: its customer's name is a ZZ name, or its title is once the usual opening
 * *Estimate for* is taken off. The title alone would miss one whose title was typed over.
 */
export function isZzEstimate(row: { title?: string | null; customerName?: string | null }): boolean {
  return isZzTestName(row.customerName) || isZzTestName((row.title ?? '').replace(/^\s*estimate\s+for\s+/i, ''))
}

type Row = { id: string; title: string | null; customers: { name: string | null } | null; sent_at: string | null; status: string; total_cents: number | null; doc_kind: string | null; customer_id: string | null; customer_email: string | null; for_address: string | null; acceptor_consented_at: string | null; updated_at: string | null }

export async function loadEstimatesSent(db: SupabaseClient<Database>, opts: { leftOut: ReadonlyArray<LeftOutRule>; /** The viewer's ZZ switch, as the bids read it: null keeps the ZZ test estimates. */ zzTestJobIds?: BridgeZzTestJobIds }): Promise<EstimateSent[]> {
  const rows = await fetchAllRows(
    async (from, to) => ({
      data: (await withSupabaseRetry(async () => db.from('estimates').select('id, title, customers(name), sent_at, status, total_cents, doc_kind, customer_id, customer_email, for_address, acceptor_consented_at, updated_at').not('sent_at', 'is', null).order('id').range(from, to), 'bridge estimates sent')) as Row[] | null,
      error: null,
    }),
    'bridge estimates sent',
  )
  const out: EstimateSent[] = []
  for (const r of rows) {
    if (r.doc_kind && r.doc_kind !== 'estimate') continue
    // A ZZ test estimate is no part of the count, for the viewer who leaves ZZ tests out.
    if (opts.zzTestJobIds && isZzEstimate({ title: r.title, customerName: r.customers?.name ?? null })) continue
    // An estimate for a customer or an address the Bridge leaves out (`leftOut.ts`) is no part of the count.
    if (isLeftOut({ customerId: r.customer_id, address: r.for_address }, opts.leftOut)) continue
    const sentYmd = r.sent_at ? calendarYmdInAppTzFromIso(r.sent_at) : ''
    if (!sentYmd) continue
    // Who it went to and where the work is, for the not-chosen rule: the customer's row, or the email it went to when there is none.
    const customerKey = r.customer_id ?? (r.customer_email ? `email:${r.customer_email.trim().toLowerCase()}` : `estimate:${r.id}`)
    const addressKey = (r.for_address ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
    const answeredIso = r.acceptor_consented_at ?? r.updated_at
    out.push({ sentYmd, status: r.status, usd: (r.total_cents ?? 0) / 100, customerKey, addressKey, answeredYmd: answeredIso ? calendarYmdInAppTzFromIso(answeredIso) || null : null })
  }
  return out
}
