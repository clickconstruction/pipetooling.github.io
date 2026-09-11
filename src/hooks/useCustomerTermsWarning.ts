import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'
import { customerTermsWarning, parseCustomerTerms, type CustomerTermsRow, type TermsWarning } from '../lib/customerPaymentTerms'
import { buildCustomerPromiseRecords, classifyPromises, parsePromiseRecordsRpc, type CustomerPromiseRecord } from '../lib/jobs/paymentPromises'

/**
 * "Their Word" PR 4 — the terms bar New Bid and New Job show for the customer
 * being picked. Fetches the customer's terms columns and the promise record
 * (office roles; the RPC returns NULL for anyone else) and folds them into
 * one warning. Fail-soft everywhere: a missing column or an unpushed RPC just
 * means no bar. Re-runs when the customer changes; `refreshKey` forces a
 * reload after terms are edited.
 */
export function useCustomerTermsWarning(customerId: string | null | undefined, refreshKey = 0): {
  warning: TermsWarning | null
  terms: CustomerTermsRow | null
  record: CustomerPromiseRecord | null
} {
  const [state, setState] = useState<{ id: string | null; terms: CustomerTermsRow | null; record: CustomerPromiseRecord | null }>({ id: null, terms: null, record: null })
  useEffect(() => {
    let cancelled = false
    if (!customerId) {
      setState({ id: null, terms: null, record: null })
      return
    }
    void (async () => {
      let terms: CustomerTermsRow | null = null
      let record: CustomerPromiseRecord | null = null
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
      if (!cancelled) setState({ id: customerId, terms, record })
    })()
    return () => {
      cancelled = true
    }
  }, [customerId, refreshKey])
  const current = state.id === customerId ? state : { terms: null, record: null }
  return { warning: customerTermsWarning(current.terms, current.record), terms: current.terms, record: current.record }
}
