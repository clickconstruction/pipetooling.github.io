import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { fetchAllRows } from '../supabasePaging'
import type { EstimateSent } from './estimateWins'
import { isLeftOut, type LeftOutRule } from './leftOut'

/**
 * The read behind the estimates' won coefficient (spike candidate 5, punch list #303): every estimate ever sent,
 * with its send day, its status and its dollars. All of them, not the page's window: the coefficient needs the ones
 * old enough to have an answer, and each one's customer and address, for the estimates a customer did not choose. Change orders and bid proposals share the table and are left out, as the Market
 * step leaves them out. Estimates have no ZZ rule, as `loadDemandPace.ts` says.
 */

type Row = { id: string; sent_at: string | null; status: string; total_cents: number | null; doc_kind: string | null; customer_id: string | null; customer_email: string | null; for_address: string | null; acceptor_consented_at: string | null; updated_at: string | null }

export async function loadEstimatesSent(db: SupabaseClient<Database>, opts: { leftOut: ReadonlyArray<LeftOutRule> }): Promise<EstimateSent[]> {
  const rows = await fetchAllRows(
    async (from, to) => ({
      data: (await withSupabaseRetry(async () => db.from('estimates').select('id, sent_at, status, total_cents, doc_kind, customer_id, customer_email, for_address, acceptor_consented_at, updated_at').not('sent_at', 'is', null).order('id').range(from, to), 'bridge estimates sent')) as Row[] | null,
      error: null,
    }),
    'bridge estimates sent',
  )
  const out: EstimateSent[] = []
  for (const r of rows) {
    if (r.doc_kind && r.doc_kind !== 'estimate') continue
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
