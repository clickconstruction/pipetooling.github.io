import { useEffect, useState } from 'react'
import { chunkIds } from '../lib/supabasePaging'
import { lienBilledOpen } from '../lib/jobs/lienBilledOpen'
import { supabase } from '../lib/supabase'
import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'
import { assessLienWatch, type JobLienFilingRow, type LienWatchJob, type LienWatchResult } from '../lib/jobs/lienDeadlines'

/**
 * The Chapter 53 deadline watches (v2.2645, phase 4): notice windows closing
 * on unpaid sub jobs, filing windows closing on noticed/original jobs, and
 * filed-but-unserved affidavits. Small queries; null while loading, empty on
 * error so the cards stay quiet. The open balance is what the job's sent bills
 * owe (v2.4970, `lienBilledOpen`); property kind comes from the linked property record.
 */
export function useLienWatchNudge(enabled: boolean): { watch: LienWatchResult | null } {
  const [watch, setWatch] = useState<LienWatchResult | null>(null)

  useEffect(() => {
    if (!enabled) {
      setWatch(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const todayYmd = calendarYmdInAppTzFromIso(new Date().toISOString())
        const [{ data: jobRows, error: jobErr }, { data: filingRows, error: filErr }] = await Promise.all([
          supabase
            .from('jobs_ledger')
            .select('id, status, gc_customer_id, last_work_date, lien_last_work_on, revenue, payments_made, customer_address_id')
            .in('status', ['billed']),
          supabase.from('job_lien_filings').select('*').is('voided_at', null),
        ])
        if (jobErr) throw jobErr
        if (filErr) throw filErr
        if (cancelled) return
        const rawJobs = (jobRows ?? []) as {
          id: string
          status: string | null
          gc_customer_id: string | null
          last_work_date: string | null
          lien_last_work_on?: string | null
          revenue: number | null
          payments_made: number | null
          customer_address_id: string | null
        }[]
        // The money is what each job's sent bills owe (v2.4970), the rule the desk and the Deadlines count by — so the bills and their payments are read too.
        const invoiceRows: { id: string; job_id: string; status: string | null; amount: number | null; sequence_order: number | null; billed_at: string | null }[] = []
        const paymentRows: { job_id: string; invoice_id: string | null; amount: number | null }[] = []
        for (const chunk of chunkIds(rawJobs.map((j) => j.id))) {
          if (chunk.length === 0) continue
          const [{ data: invPart }, { data: payPart }] = await Promise.all([
            supabase.from('jobs_ledger_invoices').select('id, job_id, status, amount, sequence_order, billed_at').in('job_id', chunk),
            supabase.from('jobs_ledger_payments').select('job_id, invoice_id, amount').in('job_id', chunk),
          ])
          invoiceRows.push(...((invPart ?? []) as typeof invoiceRows))
          paymentRows.push(...((payPart ?? []) as typeof paymentRows))
        }
        const invByJob = new Map<string, typeof invoiceRows>()
        for (const i of invoiceRows) invByJob.set(i.job_id, [...(invByJob.get(i.job_id) ?? []), i])
        const payByJob = new Map<string, typeof paymentRows>()
        for (const p of paymentRows) payByJob.set(p.job_id, [...(payByJob.get(p.job_id) ?? []), p])
        const addressIds = [...new Set(rawJobs.map((j) => j.customer_address_id).filter((v): v is string => Boolean(v)))]
        const kindById = new Map<string, string>()
        if (addressIds.length > 0) {
          const { data: addrRows } = await supabase
            .from('customer_addresses')
            .select('id, property_kind')
            .in('id', addressIds)
          for (const r of (addrRows ?? []) as { id: string; property_kind: string }[]) {
            kindById.set(r.id, r.property_kind ?? '')
          }
        }
        if (cancelled) return
        const jobs: LienWatchJob[] = rawJobs.map((j) => ({
          id: j.id,
          isSub: Boolean(j.gc_customer_id),
          // The day set by hand counts first (v2.4830), as the runway and the desk count it.
          lastWorkYmd: j.lien_last_work_on || j.last_work_date,
          openBalance: lienBilledOpen(j, invByJob.get(j.id) ?? [], payByJob.get(j.id) ?? []),
          propertyKind: j.customer_address_id ? kindById.get(j.customer_address_id) ?? '' : '',
        }))
        setWatch(assessLienWatch(jobs, (filingRows ?? []) as JobLienFilingRow[], todayYmd))
      } catch {
        if (!cancelled) setWatch({ noticeDue: [], filingDue: [], serveDue: [], suitDue: [], trackingOwed: [] })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])

  return { watch }
}
