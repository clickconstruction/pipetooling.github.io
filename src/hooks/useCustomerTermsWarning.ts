import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'
import { customerTermsWarning, parseCustomerTerms, type CustomerTermsRow, type TermsWarning, type UncollectibleHistory } from '../lib/customerPaymentTerms'
import { buildCustomerPromiseRecords, classifyPromises, parsePromiseRecordsRpc, type CustomerPromiseRecord } from '../lib/jobs/paymentPromises'

/**
 * "Their Word" PR 4 — the terms bar New Bid and New Job show for the customer
 * being picked (a GC too: both forms pass the GC when the GC is the payer).
 * Fetches the customer's terms columns, the promise record (office roles; the
 * RPC returns NULL for anyone else) and the bills given up on where they were
 * the customer or the GC the job billed, and folds them into one warning. Fail-soft everywhere: a missing column or an unpushed RPC just
 * means no bar. Re-runs when the customer changes; `refreshKey` forces a
 * reload after terms are edited.
 */
export function useCustomerTermsWarning(customerId: string | null | undefined, refreshKey = 0): {
  warning: TermsWarning | null
  terms: CustomerTermsRow | null
  record: CustomerPromiseRecord | null
} {
  const [state, setState] = useState<{ id: string | null; terms: CustomerTermsRow | null; record: CustomerPromiseRecord | null; uncollectible: UncollectibleHistory | null }>({ id: null, terms: null, record: null, uncollectible: null })
  useEffect(() => {
    let cancelled = false
    if (!customerId) {
      setState({ id: null, terms: null, record: null, uncollectible: null })
      return
    }
    void (async () => {
      let terms: CustomerTermsRow | null = null
      let record: CustomerPromiseRecord | null = null
      let uncollectible: UncollectibleHistory | null = null
      try {
        const { data } = await supabase
          .from('customers')
          .select('id, payment_terms, payment_terms_note, payment_terms_set_at, set_by:users!customers_payment_terms_set_by_fkey(name)' as never)
          .eq('id', customerId)
          .maybeSingle()
        const row = data as (Record<string, unknown> & { set_by?: { name?: string | null } | { name?: string | null }[] | null }) | null
        if (row) {
          const sb = Array.isArray(row.set_by) ? row.set_by[0] : row.set_by
          terms = parseCustomerTerms(row, sb?.name ?? null)
        }
      } catch {
        // column not there yet (deploy window) — no bar
      }
      try {
        const { data } = await supabase.rpc('list_payment_promise_records' as never)
        const records = parsePromiseRecordsRpc(data as unknown)
        if (records) {
          const today = new Date().toLocaleDateString('en-CA', { timeZone: APP_CALENDAR_TZ })
          record = buildCustomerPromiseRecords(classifyPromises(records, today)).get(customerId) ?? null
        }
      } catch {
        // not an office role, or RPC not pushed — no record
      }
      try {
        // Punch list #94 (v2.4795): bills the office gave up on — the nudge toward Deposit required on the next job.
        // Since v2.5015 (the owner's call of 2026-10-09) a GC the job billed counts them too: the debtor on a
        // GC-pays job is the GC (J1002 through Heron Construction Group, 881 through RMC- Dudley Mason).
        const { data } = await supabase
          .from('jobs_ledger')
          .select('revenue, payments_made' as never)
          .or(`customer_id.eq.${customerId},and(gc_customer_id.eq.${customerId},bill_to_party.eq.gc)`)
          .eq('status', 'billed')
          .not('collections_at', 'is', null)
          .not('uncollectible_at', 'is', null)
        const rows = (data ?? []) as unknown as Array<{ revenue: number | null; payments_made: number | null }>
        if (rows.length > 0) {
          uncollectible = { count: rows.length, total: rows.reduce((s, r) => s + Math.max(0, Number(r.revenue ?? 0) - Number(r.payments_made ?? 0)), 0) }
        }
      } catch {
        // column not there yet (deploy window) — no nudge
      }
      if (!cancelled) setState({ id: customerId, terms, record, uncollectible })
    })()
    return () => {
      cancelled = true
    }
  }, [customerId, refreshKey])
  const current = state.id === customerId ? state : { terms: null, record: null, uncollectible: null }
  return { warning: customerTermsWarning(current.terms, current.record, current.uncollectible), terms: current.terms, record: current.record }
}
