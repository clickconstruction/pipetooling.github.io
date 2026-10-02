import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllRowsChunkedIn } from '../lib/supabasePaging'
import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'
import { buildLienSupplierJobs, type LienSupplierAccountInput, type LienSupplierJob, type LienSupplierWord } from '../lib/jobs/lienJobSuppliers'
import { useJobAccountStrips } from './useJobAccountStrips'

type AllocationRow = { invoice_id: string; job_id: string; pct: number | null }
type InvoiceRow = { id: string; supply_house_id: string; amount: number | null; is_paid: boolean; invoice_date: string | null; paid_at: string | null; on_job_account: boolean | null }
type PaymentRow = { job_id: string; paid_on: string | null; amount: number | null }
type WordRow = { job_id: string; supply_house_id: string; their_balance: number | null; notice_on: string | null; said_by: string | null; note: string | null; noted_by_name: string | null; noted_at: string | null }

type Loaded = { allocations: AllocationRow[]; invoices: InvoiceRow[]; houses: Array<{ id: string; name: string }>; payments: PaymentRow[]; words: WordRow[] }

const EMPTY: ReadonlyMap<string, LienSupplierJob> = new Map()

/**
 * The supply houses on a set of jobs (v2.4404): the Lien desk's read of what
 * each house is paid and owed per job. Reads only the given jobs' invoice
 * allocations, their invoices, the houses' names, the jobs' customer payments
 * and — through `useJobAccountStrips` — each job's accounts; since v2.4411 also
 * what each house told us (`job_supply_house_words`; a missing table, before the
 * push, reads as no words). A failed read (a role that cannot see supply-house
 * invoices) answers an empty map: the desk then draws no mark and no card, never
 * an error. `reload` re-reads after a word is written.
 */
export function useLienJobSuppliers(
  jobIds: readonly string[],
  enabled = true,
  refreshKey = 0,
): { byJob: ReadonlyMap<string, LienSupplierJob>; loaded: boolean; reload: () => void } {
  const idsKey = useMemo(() => [...new Set(jobIds.filter(Boolean))].sort().join(','), [jobIds])
  const ids = useMemo(() => (idsKey ? idsKey.split(',') : []), [idsKey])
  const [rows, setRows] = useState<Loaded | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])
  const strips = useJobAccountStrips(ids, enabled, refreshKey)

  useEffect(() => {
    if (!enabled || !idsKey) {
      setRows(null)
      setLoaded(enabled)
      return
    }
    const jobList = idsKey.split(',')
    let cancelled = false
    void (async () => {
      try {
        const allocations = await fetchAllRowsChunkedIn<AllocationRow, string>(
          jobList,
          (chunk, from, to) => supabase.from('supply_house_invoice_job_allocations').select('invoice_id, job_id, pct').in('job_id', chunk).order('invoice_id').order('job_id').range(from, to),
          'load lien job supplier allocations',
        )
        const invoiceIds = [...new Set(allocations.map((a) => a.invoice_id))]
        const [invoices, housesRes, payments, words] = await Promise.all([
          fetchAllRowsChunkedIn<InvoiceRow, string>(
            invoiceIds,
            (chunk, from, to) => supabase.from('supply_house_invoices').select('id, supply_house_id, amount, is_paid, invoice_date, paid_at, on_job_account').in('id', chunk).order('id').range(from, to),
            'load lien job supplier invoices',
          ),
          supabase.from('supply_houses').select('id, name').order('name'),
          fetchAllRowsChunkedIn<PaymentRow, string>(
            jobList,
            (chunk, from, to) => supabase.from('jobs_ledger_payments').select('job_id, paid_on, amount').in('job_id', chunk).order('id').range(from, to),
            'load lien job customer payments',
          ).catch(() => [] as PaymentRow[]),
          fetchAllRowsChunkedIn<WordRow, string>(
            jobList,
            (chunk, from, to) =>
              supabase
                .from('job_supply_house_words')
                .select('job_id, supply_house_id, their_balance, notice_on, said_by, note, noted_by_name, noted_at')
                .in('job_id', chunk)
                .order('job_id')
                .order('supply_house_id')
                .range(from, to),
            'load what the houses told us',
          ).catch(() => [] as WordRow[]),
        ])
        if (cancelled) return
        setRows({ allocations, invoices, houses: (housesRes.data ?? []) as Array<{ id: string; name: string }>, payments, words })
      } catch {
        if (!cancelled) setRows(null)
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, idsKey, refreshKey, tick])

  const byJob = useMemo(() => {
    if (!rows) return EMPTY
    const accountsByJob = new Map<string, LienSupplierAccountInput[]>()
    for (const [jobId, entries] of strips.byJob) {
      accountsByJob.set(
        jobId,
        entries.map((e) => ({ houseId: e.houseId, state: e.state, accountRef: e.accountRef, rep: e.rep ? { name: e.rep.name, phone: e.rep.phone } : null })),
      )
    }
    const firstCustomerPaidByJob = new Map<string, string>()
    for (const p of rows.payments) {
      const ymd = (p.paid_on ?? '').slice(0, 10)
      if (!ymd || Number(p.amount ?? 0) <= 0) continue
      const have = firstCustomerPaidByJob.get(p.job_id)
      if (!have || ymd < have) firstCustomerPaidByJob.set(p.job_id, ymd)
    }
    const wordsByJob = new Map<string, Array<LienSupplierWord & { houseId: string }>>()
    for (const w of rows.words) {
      const list = wordsByJob.get(w.job_id) ?? []
      list.push({
        houseId: w.supply_house_id,
        balance: w.their_balance == null ? null : Number(w.their_balance),
        noticeYmd: w.notice_on ? w.notice_on.slice(0, 10) : null,
        saidBy: (w.said_by ?? '').trim(),
        note: (w.note ?? '').trim(),
        notedByName: (w.noted_by_name ?? '').trim(),
        notedYmd: w.noted_at ? calendarYmdInAppTzFromIso(w.noted_at) : '',
      })
      wordsByJob.set(w.job_id, list)
    }
    return buildLienSupplierJobs({
      invoices: rows.invoices.map((i) => ({
        id: i.id,
        supply_house_id: i.supply_house_id,
        amount: i.amount,
        is_paid: i.is_paid,
        invoice_date: i.invoice_date,
        paidYmd: i.paid_at ? calendarYmdInAppTzFromIso(i.paid_at) : null,
        on_job_account: Boolean(i.on_job_account),
      })),
      allocations: rows.allocations,
      houses: rows.houses,
      accountsByJob,
      firstCustomerPaidByJob,
      wordsByJob,
    })
  }, [rows, strips.byJob])

  return { byJob, loaded, reload }
}
